"""배당 요약 적재 → dividends.

1차(primary) DART alotMatter.json (배당에 관한 사항, DART_API_KEY 필요):
  - 사업보고서(11011) 기준, 1회 호출에 당기/전기/전전기 3개년 DPS → --years N 만큼 (N/3 회 호출)
  - consecutive_years = 최근 회계연도부터 연속 dps>0 연수
  - eps(주당순이익) 도 같은 응답에서 → payout_ratio = dps/eps*100
  - 쿼터: 종목당 ceil(years/3) 건. years=6 → 2건/종목 ≈ 5,400건 (financials 와 같은 날 돌리면 한도 초과 주의)
2차(fallback) pykrx get_market_fundamental(date, market): DIV(배당수익률%), DPS, EPS — 전 종목 1회 호출
  - 이력이 없어 consecutive_years 는 (dps>0 ? max(기존 DB값, 1) : 0) 로 보수적으로 유지
ex_dividend_date: 12월 결산법인 기본 규칙(12월 마지막 거래일의 전 영업일). TODO: KRX 배당 일정으로 교체.

사용: python load_dividends.py [--source auto|dart|pykrx] [--years 6] [--limit N] [--codes ...] [--dry-run]
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import timedelta
from typing import Any

from common import active_codes, env, fetch_latest_prices, get_logger, kst_date_string, kst_today, polite_sleep, select_all, upsert_rows, with_retry
from load_financials import DartQuotaExceeded, _dart_get, load_corp_map
from transforms import (
    build_dividend_row,
    latest_annual_report_year,
    normalize_code,
    parse_alot_eps,
    parse_alot_matter,
    to_number,
    to_yyyymmdd,
    weekdays_back,
)

log = get_logger("load_dividends")


@with_retry(attempts=3, min_wait=2, max_wait=15)
def fetch_alot_matter(api_key: str, corp_code: str, bsns_year: int) -> list[dict[str, Any]]:
    js = _dart_get(api_key, "alotMatter.json", corp_code=corp_code, bsns_year=str(bsns_year), reprt_code="11011")
    st = str(js.get("status"))
    if st == "000":
        return list(js.get("list") or [])
    if st in ("013", "014"):
        return []
    raise RuntimeError(f"DART {st}: {js.get('message')}")


def run_dart(codes: list[str], api_key: str, *, years: int = 6, sleep_sec: float = 0.15, limit: int | None = None) -> dict[str, Any]:
    corp_map = load_corp_map(api_key)
    prices = fetch_latest_prices()
    as_of = kst_date_string()
    fy = latest_annual_report_year(kst_today())
    calls_per = max(1, math.ceil(years / 3))
    log.info("회계연도 %d, 이력 %d년(%d건/종목), 대상 %d", fy, years, calls_per, len(codes))

    rows: list[dict[str, Any]] = []
    stats = {"ok": 0, "no_corp": 0, "no_data": 0, "error": 0, "calls": 0, "quota_hit": False}
    for i, code in enumerate(codes[:limit] if limit else codes):
        cc = corp_map.get(code)
        if not cc:
            stats["no_corp"] += 1
            continue
        hist: dict[int, float | None] = {}
        eps: float | None = None
        try:
            for k in range(calls_per):
                y = fy - 3 * k
                items = fetch_alot_matter(api_key, cc, y)
                stats["calls"] += 1
                if not items:
                    if k == 0:
                        break
                    continue
                hist.update(parse_alot_matter(items, y))
                if k == 0:
                    eps = parse_alot_eps(items)
                polite_sleep(sleep_sec)
        except DartQuotaExceeded as e:
            log.error("DART 일일 한도 초과 — 중단 (%s). 처리 %d/%d", e, i, len(codes))
            stats["quota_hit"] = True
            break
        except Exception as e:
            stats["error"] += 1
            log.warning("%s alotMatter 실패: %s", code, repr(e)[:160])
            continue
        if fy not in hist:
            stats["no_data"] += 1
            continue
        p = prices.get(code) or {}
        rows.append(build_dividend_row(code=code, fiscal_year=fy, dps=hist.get(fy), price=to_number(p.get("close")), eps=eps, dps_history=hist, as_of=as_of))
        stats["ok"] += 1
        if len(rows) >= 500:
            upsert_rows("dividends", rows, on_conflict="code,fiscal_year")
            rows = []
        if (i + 1) % 200 == 0:
            log.info("진행 %d/%d %s", i + 1, len(codes), stats)
    if rows:
        upsert_rows("dividends", rows, on_conflict="code,fiscal_year")
    stats["as_of"] = as_of
    log.info("완료 %s", stats)
    return stats


@with_retry(attempts=3, min_wait=2)
def _fundamental(date_str: str, market: str):
    from pykrx import stock

    return stock.get_market_fundamental(date_str, market=market)


def run_pykrx(codes: list[str], date_str: str | None = None) -> dict[str, Any]:
    if date_str is None:
        date_str = to_yyyymmdd(weekdays_back(kst_today() - timedelta(days=1), 1)[0])
    prices = fetch_latest_prices()
    as_of = kst_date_string()
    fy = latest_annual_report_year(kst_today())
    known = set(codes)
    existing = {r["code"]: r for r in select_all("dividends", "code,fiscal_year,consecutive_years")}
    rows: list[dict[str, Any]] = []
    for market in ("KOSPI", "KOSDAQ"):
        df = _fundamental(date_str, market)
        if df is None or df.empty:
            log.warning("%s fundamental 비어 있음 (%s)", market, date_str)
            continue
        for ticker, r in df.iterrows():
            code = normalize_code(ticker)
            if not code or code not in known:
                continue
            dps = to_number(r.get("DPS"))
            div = to_number(r.get("DIV"))
            eps = to_number(r.get("EPS"))
            p = prices.get(code) or {}
            row = build_dividend_row(code=code, fiscal_year=fy, dps=dps, price=to_number(p.get("close")), eps=eps, dps_history={}, as_of=as_of, yield_override=div if div else None)
            # 이력 없음 → 기존 값 보존 (dps>0 이면 최소 1)
            prev = existing.get(code)
            prev_years = int(prev["consecutive_years"]) if prev else 0
            row["consecutive_years"] = max(prev_years, 1) if (dps and dps > 0) else 0
            rows.append(row)
        polite_sleep(1.0)
    n = upsert_rows("dividends", rows, on_conflict="code,fiscal_year")
    stats = {"source": "pykrx", "date": date_str, "rows": n, "as_of": as_of}
    log.info("완료 %s", stats)
    return stats


def run(source: str = "auto", codes: list[str] | None = None, **kw: Any) -> dict[str, Any]:
    api_key = env("DART_API_KEY")
    codes = codes or active_codes()
    if not codes:
        raise RuntimeError("활성 종목이 없음 — load_stocks 먼저 실행")
    if source == "dart" or (source == "auto" and api_key):
        if not api_key:
            raise SystemExit("DART_API_KEY 없음")
        return run_dart(codes, api_key, **kw)
    log.info("DART 키 없음 또는 --source pykrx → pykrx fundamental(DIV/DPS) 사용")
    return run_pykrx(codes)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["auto", "dart", "pykrx"], default="auto")
    ap.add_argument("--years", type=int, default=6, help="연속배당 판정용 이력 연수 (3의 배수 권장)")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--codes")
    ap.add_argument("--sleep", type=float, default=0.15)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if a.dry_run:
        os.environ["DRY_RUN"] = "1"
    codes = [c for c in (normalize_code(x) for x in (a.codes or "").split(",")) if c] or None
    kw: dict[str, Any] = {} if a.source == "pykrx" else {"years": a.years, "sleep_sec": a.sleep, "limit": a.limit}
    run(a.source, codes, **kw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
