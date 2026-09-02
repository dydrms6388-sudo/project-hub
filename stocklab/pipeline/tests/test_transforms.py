"""transforms.py 순수 함수 단위 테스트 (네트워크 불필요).

실행: cd stocklab/pipeline && python -m pytest -q
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import transforms as t  # noqa: E402


# ── 날짜 ──
def test_kst_date_string_crosses_midnight():
    # UTC 2026-09-01 16:00 = KST 2026-09-02 01:00
    assert t.kst_date_string(datetime(2026, 9, 1, 16, 0, tzinfo=timezone.utc)) == "2026-09-02"
    # UTC 14:59 → KST 23:59 같은 날
    assert t.kst_date_string(datetime(2026, 9, 1, 14, 59, tzinfo=timezone.utc)) == "2026-09-01"
    # naive 는 UTC 로 간주
    assert t.kst_date_string(datetime(2026, 9, 1, 15, 0)) == "2026-09-02"


def test_yyyymmdd_roundtrip():
    assert t.to_yyyymmdd(date(2026, 1, 5)) == "20260105"
    assert t.to_yyyymmdd("2026-01-05") == "20260105"
    assert t.from_yyyymmdd("20260105") == date(2026, 1, 5)


def test_weekdays_back_skips_weekend():
    # 2026-09-07 은 월요일 → 5 평일: 9/7, 9/4(금), 9/3, 9/2, 9/1
    days = t.weekdays_back(date(2026, 9, 7), 5)
    assert days == [date(2026, 9, 7), date(2026, 9, 4), date(2026, 9, 3), date(2026, 9, 2), date(2026, 9, 1)]


# ── 배치 ──
def test_chunked():
    assert list(t.chunked(range(1201), 500)) == [list(range(500)), list(range(500, 1000)), list(range(1000, 1201))]
    assert list(t.chunked([], 500)) == []
    with pytest.raises(ValueError):
        list(t.chunked([1], 0))


# ── 숫자 파싱 ──
@pytest.mark.parametrize(
    "raw,expected",
    [("1,234,567", 1234567.0), ("-", None), ("", None), (None, None), ("(1,000)", -1000.0), (float("nan"), None), (12, 12.0), ("abc", None)],
)
def test_to_number(raw, expected):
    assert t.to_number(raw) == expected


def test_won_to_eok():
    assert t.won_to_eok(282_571_700_000_000) == 2825717
    assert t.won_to_eok(None) is None


def test_normalize_market_and_code():
    assert t.normalize_market("KOSPI") == "KOSPI"
    assert t.normalize_market("STK") == "KOSPI"
    assert t.normalize_market("KOSDAQ GLOBAL") == "KOSDAQ"
    assert t.normalize_market("KONEX") is None
    assert t.normalize_code("5930") == "005930"
    assert t.normalize_code("005930.0") == "005930"
    assert t.normalize_code("A005930") is None


# ── 재무 지표 ──
def test_compute_ratios_basic():
    # 주가 10,000원, 1,000주, 순이익 1,000,000 → eps 1,000, per 10
    r = t.compute_ratios(price=10_000, shares=1_000, net_income=1_000_000, total_equity=5_000_000, total_liabilities=2_500_000)
    assert r["eps"] == 1000
    assert r["bps"] == 5000
    assert r["per"] == 10.0
    assert r["pbr"] == 2.0
    assert r["roe"] == 20.0
    assert r["debt_ratio"] == 50.0


def test_compute_ratios_loss_and_negative_equity():
    r = t.compute_ratios(price=10_000, shares=1_000, net_income=-500_000, total_equity=5_000_000, total_liabilities=1_000_000)
    assert r["eps"] == -500
    assert r["per"] is None  # 적자 → PER 없음
    assert r["roe"] == -10.0
    r2 = t.compute_ratios(price=10_000, shares=1_000, net_income=100, total_equity=-1, total_liabilities=10)
    assert r2["pbr"] is None and r2["roe"] is None and r2["debt_ratio"] is None


def test_compute_ratios_shares_from_market_cap():
    r = t.compute_ratios(price=10_000, shares=None, net_income=1_000_000, total_equity=5_000_000, total_liabilities=0, market_cap_won=10_000_000)
    assert r["eps"] == 1000  # shares = 1,000 추정
    assert r["debt_ratio"] == 0.0


def test_compute_ratios_missing():
    r = t.compute_ratios(price=None, shares=None, net_income=None, total_equity=None, total_liabilities=None)
    assert all(v is None for v in r.values())


def test_extract_dart_financials_prefers_cfs_then_ofs():
    items = [
        {"fs_div": "OFS", "sj_div": "BS", "account_nm": "자본총계", "thstrm_amount": "100"},
        {"fs_div": "OFS", "sj_div": "BS", "account_nm": "부채총계", "thstrm_amount": "50"},
        {"fs_div": "CFS", "sj_div": "BS", "account_nm": "자본총계", "thstrm_amount": "1,000"},
        {"fs_div": "CFS", "sj_div": "BS", "account_nm": "부채총계", "thstrm_amount": "500"},
        {"fs_div": "CFS", "sj_div": "IS", "account_nm": "매출액", "thstrm_amount": "300", "thstrm_add_amount": "900"},
        {"fs_div": "CFS", "sj_div": "IS", "account_nm": "당기순이익", "thstrm_amount": "30"},
    ]
    r = t.extract_dart_financials(items)
    assert r["fs_div"] == "CFS"
    assert r["total_equity"] == 1000 and r["total_liabilities"] == 500
    assert r["revenue"] == 900  # IS 는 누적(add) 우선
    assert r["net_income"] == 30
    only_ofs = t.extract_dart_financials([i for i in items if i["fs_div"] == "OFS"])
    assert only_ofs["fs_div"] == "OFS" and only_ofs["total_equity"] == 100
    empty = t.extract_dart_financials([])
    assert empty["fs_div"] is None and empty["total_equity"] is None


def test_build_financial_row_units():
    dart = {"total_equity": 5e12, "total_liabilities": 2.5e12, "net_income": 1e12, "revenue": 1e13, "operating_income": 2e12}
    row = t.build_financial_row(code="005930", fiscal_year=2025, price=100_000, market_cap_won=1e14, shares=1e9, dart=dart, as_of="2026-09-02")
    assert row["market_cap"] == 1_000_000  # 억원
    assert row["revenue"] == 100_000 and row["net_income"] == 10_000
    assert row["eps"] == 1000 and row["per"] == 100.0
    assert row["as_of"] == "2026-09-02" and row["code"] == "005930"


# ── 배당 ──
def test_consecutive_dividend_years():
    hist = {2025: 100, 2024: 90, 2023: 80, 2022: 0, 2021: 50}
    assert t.consecutive_dividend_years(hist, 2025) == 3
    assert t.consecutive_dividend_years({2025: 0}, 2025) == 0
    assert t.consecutive_dividend_years({}, 2025) == 0
    assert t.consecutive_dividend_years({2025: 10, 2024: None}, 2025) == 1


def test_payout_and_yield():
    assert t.payout_ratio(1000, 5000) == 20.0
    assert t.payout_ratio(1000, 0) is None
    assert t.payout_ratio(1000, -100) is None
    assert t.dividend_yield(1000, 50_000) == 2.0
    assert t.dividend_yield(None, 50_000) is None


def test_default_ex_dividend_date():
    # 2025-12-31 수요일 → 마지막 평일 12/31, 배당락일 = 12/30
    assert t.default_ex_dividend_date(2025) == date(2025, 12, 30)
    # 2023-12-31 일요일 → 마지막 평일 12/29(금), 배당락일 = 12/28(목)
    assert t.default_ex_dividend_date(2023) == date(2023, 12, 28)
    # 실제 거래일 목록이 주어지면 뒤에서 두 번째
    days = [date(2024, 12, 26), date(2024, 12, 27), date(2024, 12, 30)]
    assert t.default_ex_dividend_date(2024, days) == date(2024, 12, 27)


def test_parse_alot_matter():
    items = [
        {"se": "주당 현금배당금(원)", "stock_knd": "보통주", "thstrm": "1,500", "frmtrm": "1,000", "lwfr": "-"},
        {"se": "주당 현금배당금(원)", "stock_knd": "우선주", "thstrm": "1,550", "frmtrm": "1,050", "lwfr": "1,050"},
        {"se": "(연결)주당순이익(원)", "stock_knd": "", "thstrm": "5,000", "frmtrm": "4,000", "lwfr": "3,000"},
    ]
    assert t.parse_alot_matter(items, 2025) == {2025: 1500.0, 2024: 1000.0, 2023: None}
    assert t.parse_alot_eps(items) == 5000.0


def test_build_dividend_row():
    row = t.build_dividend_row(
        code="005930", fiscal_year=2025, dps=1500, price=50_000, eps=5000,
        dps_history={2024: 1000, 2023: 900}, as_of="2026-09-02",
    )
    assert row["dividend_yield"] == 3.0
    assert row["payout_ratio"] == 30.0
    assert row["consecutive_years"] == 3
    assert row["ex_dividend_date"] == "2025-12-30"
    no_div = t.build_dividend_row(code="000001", fiscal_year=2025, dps=0, price=1000, eps=10, dps_history={}, as_of="2026-09-02")
    assert no_div["consecutive_years"] == 0 and no_div["ex_dividend_date"] is None
    override = t.build_dividend_row(code="000001", fiscal_year=2025, dps=100, price=1000, eps=10, dps_history={}, as_of="2026-09-02", yield_override=9.87)
    assert override["dividend_yield"] == 9.87


# ── 종목 ──
def test_diff_delisted():
    assert t.diff_delisted(["000001", "000002", "000003"], ["000002", "000003", "000004"]) == ["000001"]
    assert t.diff_delisted([], ["000001"]) == []


def test_report_year_helpers():
    assert t.latest_annual_report_year(date(2026, 9, 2)) == 2025
    assert t.latest_annual_report_year(date(2026, 2, 1)) == 2024
    assert t.latest_quarter_report(date(2026, 9, 2)) == (2026, "11012")  # 반기
    assert t.latest_quarter_report(date(2026, 6, 10)) == (2026, "11013")  # 1분기
    assert t.latest_quarter_report(date(2026, 12, 5)) == (2026, "11014")  # 3분기
    assert t.latest_quarter_report(date(2026, 4, 5)) == (2025, "11011")  # 사업
    assert t.latest_quarter_report(date(2026, 2, 5)) == (2025, "11014")
