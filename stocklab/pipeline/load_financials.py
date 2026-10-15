"""재무 스냅샷 적재 → financials (DART OpenAPI 우선, pykrx fundamental fallback).

DART (opendart.fss.or.kr, DART_API_KEY 필요):
  1) corpCode.xml (zip) 다운로드 → pipeline/.cache/CORPCODE.xml 캐시(7일) → stock_code→corp_code 매핑
  2) 종목별 fnlttSinglAcnt.json (단일회사 주요계정)
       - 최신 사업보고서(11011): 손익(매출/영업이익/순이익) + 재무상태
       - 최신 분·반기 보고서: 재무상태(자본/부채) 최신화 (있으면 BS 항목만 교체)
     연결(CFS) 우선 → 개별(OFS) fallback
  3) 최신 종가·시가총액·상장주식수(daily_prices) 로 per/pbr/roe/debt_ratio/eps/bps 계산
  4) as_of = KST 오늘, fiscal_year = 사업보고서 연도

쿼터: DART 무료 키 1일 10,000건(공식 문서 확인 필요). 종목당 2건 → 전 종목 ~5,400건.
      --quarter-off 로 1건/종목. status '020'(한도 초과) 응답 시 즉시 중단·요약 출력.

pykrx fallback (--source pykrx 또는 DART 키 없음):
  stock.get_market_fundamental(date, market) → PER/PBR/EPS/BPS/DIV/DPS 전 종목 1회 호출.
  roe/debt_ratio/revenue 등은 None (KRX 미제공).

사용: python load_financials.py [--source auto|dart|pykrx] [--limit N] [--codes 005930,000660]
                                 [--quarter-off] [--sleep 0.15] [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
from datetime import timedelta
from pathlib import Path
from typing import Any

import requests

from common import (
    active_codes,
    ensure_cache_dir,
    env,
    fetch_latest_prices,
    get_logger,
    kst_date_string,
    kst_today,
    polite_sleep,
    upsert_rows,
    with_retry,
)
from transforms import (
    build_financial_row,
    extract_dart_financials,
    latest_annual_report_year,
    latest_quarter_report,
    normalize_code,
    to_number,
    to_yyyymmdd,
    weekdays_back,
    won_to_eok,
)

log = get_logger("load_financials")

DART_BASE = "https://opendart.fss.or.kr/api"
CORP_CACHE_TTL_DAYS = 7
HTTP_TIMEOUT = 30


class DartQuotaExceeded(RuntimeError):
    """status 020 — 일일 한도 초과."""


# ─────────────────────────── corp_code ───────────────────────────
@with_retry(attempts=3, min_wait=2)
def download_corp_code_xml(api_key: str, dest: Path) -> Path:
    r = requests.get(f"{DART_BASE}/corpCode.xml", params={"crtfc_key": api_key}, timeout=60)
    r.raise_for_status()
    if not r.content[:2] == b"PK":
        # zip 이 아니면 에러 JSON (키 오류 등)
        raise RuntimeError(f"corpCode.xml 응답이 zip 이 아님: {r.text[:200]}")
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".xml"))
        dest.write_bytes(z.read(name))
    return dest


def load_corp_map(api_key: str) -> dict[str, str]:
    """stock_code(6) → corp_code(8). 캐시 7일."""
    cache = ensure_cache_dir() / "CORPCODE.xml"
    if not cache.exists() or (time.time() - cache.stat().st_mtime) > CORP_CACHE_TTL_DAYS * 86400:
        log.info("corpCode.xml 다운로드 …")
        download_corp_code_xml(api_key, cache)
    out: dict[str, str] = {}
    for el in ET.parse(cache).getroot().iter("list"):
        sc = normalize_code((el.findtext("stock_code") or "").strip())
        cc = (el.findtext("corp_code") or "").strip()
        if sc and cc:
            out[sc] = cc
    log.info("corp_code 매핑 %d 종목", len(out))
    return out


# ─────────────────────────── DART 호출 ───────────────────────────
def _dart_get(api_key: str, endpoint: str, **params: Any) -> dict[str, Any]:
    r = requests.get(f"{DART_BASE}/{endpoint}", params={"crtfc_key": api_key, **params}, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    js = r.json()
    status = str(js.get("status", ""))
    if status == "020":
        raise DartQuotaExceeded(js.get("message", "quota exceeded"))
    return js


@with_retry(attempts=3, min_wait=2, max_wait=15)
def fetch_single_acnt(api_key: str, corp_code: str, bsns_year: int, reprt_code: str) -> list[dict[str, Any]]:
    """단일회사 주요계정. 데이터 없음(013) → []."""
    try:
        js = _dart_get(api_key, "fnlttSinglAcnt.json", corp_code=corp_code, bsns_year=str(bsns_year), reprt_code=reprt_code)
    except DartQuotaExceeded:
        raise
    if str(js.get("status")) == "000":
        return list(js.get("list") or [])
    if str(js.get("status")) in ("013", "014"):
        return []
    raise RuntimeError(f"DART {js.get('status')}: {js.get('message')}")


def fetch_financial_dart(api_key: str, corp_code: str, annual_year: int, quarter: tuple[int, str] | None) -> tuple[int, dict[str, Any]] | None:
    """사업보고서(당해 없으면 전년) + 최신 분기 BS 병합. 반환 (fiscal_year, 표준 dict) 또는 None."""
    items: list[dict[str, Any]] = []
    fy = annual_year
    for y in (annual_year, annual_year - 1):
        items = fetch_single_acnt(api_key, corp_code, y, "11011")
        if items:
            fy = y
            break
    if not items:
        return None
    fin = extract_dart_financials(items)
    if fin.get("total_equity") is None:
        return None
    if quarter and quarter[0] >= fy and not (quarter[1] == "11011"):
        q_items = fetch_single_acnt(api_key, corp_code, quarter[0], quarter[1])
        if q_items:
            q = extract_dart_financials(q_items, prefer=fin["fs_div"] or "CFS")
            for k in ("total_assets", "total_liabilities", "total_equity"):
                if q.get(k) is not None:
                    fin[k] = q[k]
            fin["bs_report"] = f"{quarter[0]}/{quarter[1]}"
    return fy, fin


def run_dart(
    codes: list[str], api_key: str, *, with_quarter: bool = True, sleep_sec: float = 0.15, limit: int | None = None
) -> dict[str, Any]:
    corp_map = load_corp_map(api_key)
    prices = fetch_latest_prices()
    today = kst_today()
    as_of = kst_date_string()
    annual_year = latest_annual_report_year(today)
    quarter = latest_quarter_report(today) if with_quarter else None
    log.info("사업보고서 %d년, 분기 %s, 대상 %d 종목", annual_year, quarter, len(codes))

    rows: list[dict[str, Any]] = []
    stats = {"ok": 0, "no_corp": 0, "no_data": 0, "error": 0, "calls": 0}
    quota_hit = False
    for i, code in enumerate(codes[:limit] if limit else codes):
        cc = corp_map.get(code)
        if not cc:
            stats["no_corp"] += 1
            continue
        try:
            res = fetch_financial_dart(api_key, cc, annual_year, quarter)
            stats["calls"] += 2 if quarter else 1
        except DartQuotaExceeded as e:
            log.error("DART 일일 한도 초과 — 중단 (%s). 처리 %d/%d", e, i, len(codes))
            quota_hit = True
            break
        except Exception as e:
            stats["error"] += 1
            log.warning("%s DART 실패: %s", code, repr(e)[:160])
            continue
        if res is None:
            stats["no_data"] += 1
            continue
        fy, fin = res
        p = prices.get(code) or {}
        rows.append(
            build_financial_row(
                code=code,
                fiscal_year=fy,
                price=to_number(p.get("close")),
                market_cap_won=to_number(p.get("market_cap")),
                shares=to_number(p.get("listed_shares")),
                dart=fin,
                as_of=as_of,
            )
        )
        stats["ok"] += 1
        if len(rows) >= 500:
            upsert_rows("financials", rows, on_conflict="code,fiscal_year")
            rows = []
        polite_sleep(sleep_sec)
        if (i + 1) % 200 == 0:
            log.info("진행 %d/%d %s", i + 1, len(codes), stats)
    if rows:
        upsert_rows("financials", rows, on_conflict="code,fiscal_year")
    stats["quota_hit"] = quota_hit
    stats["as_of"] = as_of
    log.info("완료 %s", stats)
    return stats


# ─────────────────────────── pykrx fallback ───────────────────────────
@with_retry(attempts=3, min_wait=2)
def _fundamental(date_str: str, market: str):
    from pykrx import stock

    return stock.get_market_fundamental(date_str, market=market)


def run_pykrx(codes: list[str], date_str: str | None = None) -> dict[str, Any]:
    """KRX 기본지표(PER/PBR/EPS/BPS) 로 financials 를 채움 — roe/debt_ratio 는 None."""
    if date_str is None:
        date_str = to_yyyymmdd(weekdays_back(kst_today() - timedelta(days=1), 1)[0])
    prices = fetch_latest_prices()
    as_of = kst_date_string()
    fy = latest_annual_report_year(kst_today())
    known = set(codes)
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
            p = prices.get(code) or {}
            eps, bps = to_number(r.get("EPS")), to_number(r.get("BPS"))
            per, pbr = to_number(r.get("PER")), to_number(r.get("PBR"))
            rows.append({
                "code": code,
                "fiscal_year": fy,
                "price": to_number(p.get("close")),
                "market_cap": won_to_eok(to_number(p.get("market_cap"))),
                "per": per if (per and per > 0) else None,
                "pbr": pbr if (pbr and pbr > 0) else None,
                "roe": (round(eps / bps * 100, 2) if (eps is not None and bps and bps > 0) else None),
                "debt_ratio": None,
                "eps": eps,
                "bps": bps,
                "revenue": None,
                "operating_income": None,
                "net_income": None,
                "as_of": as_of,
            })
        polite_sleep(1.0)
    n = upsert_rows("financials", rows, on_conflict="code,fiscal_year")
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
    log.info("DART 키 없음 또는 --source pykrx → pykrx fundamental 사용")
    return run_pykrx(codes)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["auto", "dart", "pykrx"], default="auto")
    ap.add_argument("--limit", type=int, help="처리 종목 수 제한(테스트용)")
    ap.add_argument("--codes", help="쉼표 구분 종목코드 (활성 목록 대신)")
    ap.add_argument("--quarter-off", action="store_true", help="분기 BS 갱신 생략 (DART 1건/종목)")
    ap.add_argument("--sleep", type=float, default=0.15, help="DART 호출 간 대기(초)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if a.dry_run:
        os.environ["DRY_RUN"] = "1"
    codes = [c for c in (normalize_code(x) for x in (a.codes or "").split(",")) if c] or None
    kw: dict[str, Any] = {}
    if a.source != "pykrx":
        kw = {"with_quarter": not a.quarter_off, "sleep_sec": a.sleep, "limit": a.limit}
    run(a.source, codes, **kw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
