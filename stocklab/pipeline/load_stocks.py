"""종목 마스터 적재 — KOSPI + KOSDAQ 전 종목.

1차: pykrx.stock.get_market_ticker_list / get_market_ticker_name
2차(fallback): FinanceDataReader.StockListing('KRX') (+ 'KRX-DESC' 로 섹터 보강 시도)
이번 목록에 없는 기존 활성 종목 → is_active=false (상장폐지·시장이전 등)

사용: python load_stocks.py [--date YYYYMMDD] [--dry-run]
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import timedelta
from typing import Any

from common import active_codes, get_logger, kst_today, polite_sleep, update_where_in, upsert_rows, with_retry
from transforms import diff_delisted, normalize_code, normalize_market, to_yyyymmdd, weekdays_back

log = get_logger("load_stocks")


@with_retry(attempts=3)
def _pykrx_tickers(date_str: str, market: str) -> list[str]:
    from pykrx import stock

    return list(stock.get_market_ticker_list(date_str, market=market))


def fetch_via_pykrx(date_str: str) -> list[dict[str, Any]]:
    """pykrx 로 종목 목록 + 이름. 섹터는 pykrx 가 제공하지 않아 None."""
    from pykrx import stock

    rows: list[dict[str, Any]] = []
    for market in ("KOSPI", "KOSDAQ"):
        tickers = _pykrx_tickers(date_str, market)
        log.info("pykrx %s %d 종목 (%s)", market, len(tickers), date_str)
        for t in tickers:
            code = normalize_code(t)
            if not code:
                continue
            try:
                name = stock.get_market_ticker_name(code)
            except Exception as e:  # 개별 이름 조회 실패는 스킵하지 않고 코드로 대체
                log.debug("이름 조회 실패 %s: %s", code, e)
                name = code
            rows.append({"code": code, "name": str(name), "market": market, "sector": None})
        polite_sleep(0.5)
    return rows


def fetch_sector_via_fdr() -> dict[str, str]:
    """FDR 'KRX-DESC' 목록에서 코드→섹터 (실패 시 빈 dict)."""
    try:
        import FinanceDataReader as fdr

        df = fdr.StockListing("KRX-DESC")
        col_code = "Code" if "Code" in df.columns else "Symbol"
        col_sector = "Sector" if "Sector" in df.columns else None
        if col_sector is None:
            return {}
        out: dict[str, str] = {}
        for _, r in df.iterrows():
            code = normalize_code(r.get(col_code))
            sec = r.get(col_sector)
            if code and isinstance(sec, str) and sec.strip():
                out[code] = sec.strip()
        log.info("FDR 섹터 %d건", len(out))
        return out
    except Exception as e:
        log.warning("FDR 섹터 조회 실패(무시): %s", repr(e)[:200])
        return {}


def fetch_via_fdr() -> list[dict[str, Any]]:
    """FinanceDataReader.StockListing('KRX') fallback."""
    import FinanceDataReader as fdr

    df = fdr.StockListing("KRX")
    col_code = "Code" if "Code" in df.columns else "Symbol"
    rows: list[dict[str, Any]] = []
    for _, r in df.iterrows():
        market = normalize_market(r.get("Market"))
        code = normalize_code(r.get(col_code))
        if not market or not code:
            continue  # KONEX 등 제외
        rows.append({
            "code": code,
            "name": str(r.get("Name", code)),
            "market": market,
            "sector": (str(r["Sector"]).strip() if "Sector" in df.columns and isinstance(r.get("Sector"), str) else None),
        })
    log.info("FDR KRX %d 종목", len(rows))
    return rows


def fetch_stocks(date_str: str) -> list[dict[str, Any]]:
    try:
        rows = fetch_via_pykrx(date_str)
        if len(rows) < 1000:  # 비정상적으로 적으면(휴장일 빈 응답 등) fallback
            raise RuntimeError(f"pykrx 종목 수 비정상 ({len(rows)})")
    except Exception as e:
        log.warning("pykrx 실패 → FDR fallback: %s", repr(e)[:200])
        rows = fetch_via_fdr()
    sectors = fetch_sector_via_fdr()
    for r in rows:
        if r.get("sector") is None:
            r["sector"] = sectors.get(r["code"])
    return rows


def run(date_str: str | None = None) -> dict[str, Any]:
    if date_str is None:
        # 오늘이 휴장일일 수 있으니 최근 평일 사용 (05:30 KST 실행 → 전 영업일 기준)
        date_str = to_yyyymmdd(weekdays_back(kst_today() - timedelta(days=1), 1)[0])
    rows = fetch_stocks(date_str)
    if not rows:
        raise RuntimeError("종목 목록이 비어 있음")

    codes = [r["code"] for r in rows]
    for r in rows:
        r["is_active"] = True
    n = upsert_rows("stocks", rows, on_conflict="code")

    prev = active_codes()
    delisted = diff_delisted(prev, codes) if prev else []
    if delisted:
        log.info("비활성 처리 %d 종목: %s%s", len(delisted), delisted[:10], " ..." if len(delisted) > 10 else "")
        # 부분 upsert 는 NOT NULL(name/market) 위반 → UPDATE ... WHERE code IN (...) 사용
        update_where_in("stocks", {"is_active": False}, "code", delisted)

    summary = {"date": date_str, "upserted": n, "delisted": len(delisted)}
    log.info("완료 %s", summary)
    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="기준일 YYYYMMDD (기본: 최근 평일)")
    ap.add_argument("--dry-run", action="store_true", help="DB 쓰기 없이 로그만")
    a = ap.parse_args(argv)
    if a.dry_run:
        os.environ["DRY_RUN"] = "1"
    run(a.date)
    return 0


if __name__ == "__main__":
    sys.exit(main())
