"""일봉 OHLCV + 시가총액 적재 → daily_prices.

날짜 단위로 전 종목을 한 번에 받는다 (pykrx by-date API):
  stock.get_market_ohlcv(date, market=...)  → 시가/고가/저가/종가/거래량
  stock.get_market_cap(date, market=...)    → 시가총액(원)/상장주식수
휴장일은 빈 DataFrame 또는 전부 0 → 스킵.

사용:
  python load_prices.py                      # 최근 5 영업일(평일)
  python load_prices.py --from 20260101 --to 20260131
  python load_prices.py --full               # 20년 백필 (날짜당 sleep, 수 시간 소요)
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from typing import Any

from common import get_logger, kst_today, polite_sleep, upsert_rows, with_retry
from transforms import date_range, from_yyyymmdd, normalize_code, to_number, to_yyyymmdd, weekdays_back

log = get_logger("load_prices")

OHLCV_COLS = {"시가": "open", "고가": "high", "저가": "low", "종가": "close", "거래량": "volume"}


@with_retry(attempts=3, min_wait=2, max_wait=30)
def _ohlcv(date_str: str, market: str):
    from pykrx import stock

    return stock.get_market_ohlcv(date_str, market=market)


@with_retry(attempts=3, min_wait=2, max_wait=30)
def _cap(date_str: str, market: str):
    from pykrx import stock

    return stock.get_market_cap(date_str, market=market)


def fetch_day(d: date, known_codes: set[str] | None = None) -> list[dict[str, Any]]:
    """하루치 전 종목 행. known_codes 가 주어지면 stocks 에 있는 코드만(FK 보호)."""
    ds = to_yyyymmdd(d)
    rows: dict[str, dict[str, Any]] = {}
    for market in ("KOSPI", "KOSDAQ"):
        df = _ohlcv(ds, market)
        if df is None or df.empty:
            continue
        # 휴장일: 거래량 전부 0
        if "거래량" in df.columns and int(df["거래량"].sum()) == 0:
            continue
        for ticker, r in df.iterrows():
            code = normalize_code(ticker)
            if not code or (known_codes is not None and code not in known_codes):
                continue
            row: dict[str, Any] = {"code": code, "trade_date": d.isoformat()}
            for k, col in OHLCV_COLS.items():
                v = to_number(r.get(k))
                row[col] = int(v) if (v is not None and col == "volume") else v
            rows[code] = row
        try:
            cap = _cap(ds, market)
            if cap is not None and not cap.empty:
                for ticker, r in cap.iterrows():
                    code = normalize_code(ticker)
                    if code in rows:
                        mc = to_number(r.get("시가총액"))
                        sh = to_number(r.get("상장주식수"))
                        rows[code]["market_cap"] = mc
                        rows[code]["listed_shares"] = int(sh) if sh else None
        except Exception as e:
            log.warning("%s %s 시가총액 조회 실패(OHLCV 만 저장): %s", ds, market, repr(e)[:160])
    return list(rows.values())


def run(start: date, end: date, sleep_sec: float = 1.0, restrict_to_stocks: bool = True) -> dict[str, Any]:
    known: set[str] | None = None
    if restrict_to_stocks:
        from common import active_codes, select_all

        rows = select_all("stocks", "code")  # 비활성 포함(과거 시세 FK)
        known = {r["code"] for r in rows} or None
        if known is None:
            log.warning("stocks 테이블이 비어 있음 — FK 위반 방지를 위해 load_stocks 먼저 실행 권장")
    days = [d for d in date_range(start, end) if d.weekday() < 5]
    total, skipped = 0, 0
    for d in days:
        try:
            rows = fetch_day(d, known)
        except Exception as e:
            log.error("%s 조회 실패: %s", d, repr(e)[:200])
            skipped += 1
            continue
        if not rows:
            log.info("%s 휴장/데이터 없음 — 스킵", d)
            skipped += 1
            continue
        total += upsert_rows("daily_prices", rows, on_conflict="code,trade_date")
        polite_sleep(sleep_sec)
    summary = {"from": start.isoformat(), "to": end.isoformat(), "days": len(days), "rows": total, "skipped_days": skipped}
    log.info("완료 %s", summary)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="start", help="YYYYMMDD")
    ap.add_argument("--to", dest="end", help="YYYYMMDD (기본: 전일 KST)")
    ap.add_argument("--full", action="store_true", help="20년 백필 (--from 무시)")
    ap.add_argument("--sleep", type=float, default=None, help="날짜 간 대기(초). 기본 1.0, --full 은 2.0")
    ap.add_argument("--no-fk-filter", action="store_true", help="stocks 에 없는 코드도 저장 시도(FK 오류 가능)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if a.dry_run:
        os.environ["DRY_RUN"] = "1"

    end = from_yyyymmdd(a.end) if a.end else kst_today() - timedelta(days=1)
    if a.full:
        start = end.replace(year=end.year - 20)
        sleep = a.sleep if a.sleep is not None else 2.0
    elif a.start:
        start = from_yyyymmdd(a.start)
        sleep = a.sleep if a.sleep is not None else 1.0
    else:
        start = weekdays_back(end, 5)[-1]
        sleep = a.sleep if a.sleep is not None else 1.0
    run(start, end, sleep_sec=sleep, restrict_to_stocks=not a.no_fk_filter)
    return 0


if __name__ == "__main__":
    sys.exit(main())
