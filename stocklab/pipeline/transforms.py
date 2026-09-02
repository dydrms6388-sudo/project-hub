"""순수 변환 로직 (네트워크/IO 없음) — tests/test_transforms.py 로 검증.

단위 규약 (types.ts 와 동일):
  - price/eps/bps/dps: 원
  - market_cap/revenue/operating_income/net_income (financials): 억원
  - daily_prices.market_cap: 원 (KRX 원본)
  - per/pbr: 배, roe/debt_ratio/dividend_yield/payout_ratio: %
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable, Iterator, Sequence

KST = timezone(timedelta(hours=9))
EOK = 100_000_000  # 1억


# ─────────────────────────── 날짜 ───────────────────────────
def kst_now(now: datetime | None = None) -> datetime:
    """UTC/naive datetime → KST aware datetime. naive 는 UTC 로 간주."""
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(KST)


def kst_date_string(now: datetime | None = None) -> str:
    """YYYY-MM-DD (KST). 앱 kstDateString() 과 동일 규칙."""
    return kst_now(now).date().isoformat()


def kst_today(now: datetime | None = None) -> date:
    return kst_now(now).date()


def to_yyyymmdd(d: date | str) -> str:
    """date 또는 'YYYY-MM-DD' → 'YYYYMMDD' (pykrx 인자 형식)."""
    if isinstance(d, str):
        return d.replace("-", "")
    return d.strftime("%Y%m%d")


def from_yyyymmdd(s: str) -> date:
    s = str(s).replace("-", "")[:8]
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def weekdays_back(end: date, n: int) -> list[date]:
    """end 포함 과거 방향으로 평일(월~금) n 개. 공휴일은 pykrx 가 빈 응답을 주므로 로더가 스킵."""
    out: list[date] = []
    d = end
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= timedelta(days=1)
    return out


def date_range(start: date, end: date) -> Iterator[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


# ─────────────────────────── 배치 ───────────────────────────
def chunked(items: Sequence[Any] | Iterable[Any], size: int = 500) -> Iterator[list[Any]]:
    """size 개씩 잘라 리스트로 yield. size<=0 이면 ValueError."""
    if size <= 0:
        raise ValueError("size must be > 0")
    buf: list[Any] = []
    for it in items:
        buf.append(it)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


# ─────────────────────────── 숫자 ───────────────────────────
def to_number(v: Any) -> float | None:
    """DART/KRX 문자열 금액 → float. '' / '-' / None / NaN → None. 쉼표·공백 제거."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        if v != v:  # NaN
            return None
        return float(v)
    s = str(v).strip().replace(",", "").replace(" ", "")
    if s in ("", "-", "–", "N/A", "nan", "None"):
        return None
    neg = s.startswith("(") and s.endswith(")")  # 회계식 음수 (1,234)
    if neg:
        s = s[1:-1]
    try:
        f = float(s)
    except ValueError:
        return None
    return -f if neg else f


def safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return a / b


def round_or_none(v: float | None, nd: int = 2) -> float | None:
    return None if v is None else round(v, nd)


def won_to_eok(won: float | None, nd: int = 0) -> float | None:
    """원 → 억원."""
    if won is None:
        return None
    return round(won / EOK, nd)


def normalize_market(v: Any) -> str | None:
    """KRX/FDR/pykrx 시장 표기 → 'KOSPI' | 'KOSDAQ' | None (KONEX 등 제외)."""
    if v is None:
        return None
    s = str(v).strip().upper()
    if s in ("KOSPI", "STK", "유가증권", "유가증권시장"):
        return "KOSPI"
    if s in ("KOSDAQ", "KSQ", "코스닥", "KOSDAQ GLOBAL"):
        return "KOSDAQ"
    if s.startswith("KOSDAQ"):
        return "KOSDAQ"
    return None


def normalize_code(v: Any) -> str | None:
    """종목코드 6자리 zero-pad. 숫자 6자리가 아니면 None."""
    if v is None:
        return None
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    if not s.isdigit() or len(s) > 6:
        return None
    return s.zfill(6)


# ─────────────────────────── 재무 지표 ───────────────────────────
def compute_ratios(
    *,
    price: float | None,
    shares: float | None,
    net_income: float | None,
    total_equity: float | None,
    total_liabilities: float | None,
    market_cap_won: float | None = None,
) -> dict[str, float | None]:
    """원 단위 원천값 → per/pbr/roe/debt_ratio/eps/bps.

    - eps = 당기순이익 / 주식수, bps = 자본총계 / 주식수
    - per = price / eps (eps>0 일 때만), pbr = price / bps (bps>0)
    - roe = 순이익 / 자본총계 * 100 (자본총계>0), debt_ratio = 부채총계 / 자본총계 * 100
    - shares 가 없고 market_cap_won·price 가 있으면 shares = market_cap / price 로 추정
    적자(eps<=0)·자본잠식(equity<=0) 은 per/pbr/roe 를 None 으로 둔다 (앱 필터 `per > 0` 와 정합).
    """
    if (shares is None or shares <= 0) and market_cap_won and price:
        shares = market_cap_won / price
    if shares is not None and shares <= 0:
        shares = None

    eps = safe_div(net_income, shares)
    bps = safe_div(total_equity, shares)
    per = safe_div(price, eps) if (eps is not None and eps > 0) else None
    pbr = safe_div(price, bps) if (bps is not None and bps > 0) else None
    roe = None
    debt_ratio = None
    if total_equity is not None and total_equity > 0:
        if net_income is not None:
            roe = net_income / total_equity * 100
        if total_liabilities is not None:
            debt_ratio = total_liabilities / total_equity * 100

    return {
        "eps": round_or_none(eps, 0),
        "bps": round_or_none(bps, 0),
        "per": round_or_none(per, 2),
        "pbr": round_or_none(pbr, 2),
        "roe": round_or_none(roe, 2),
        "debt_ratio": round_or_none(debt_ratio, 2),
    }


# DART fnlttSinglAcnt 계정명 매핑 (표기 변형 포함)
_DART_ACCOUNTS: dict[str, tuple[str, ...]] = {
    "total_assets": ("자산총계",),
    "total_liabilities": ("부채총계",),
    "total_equity": ("자본총계",),
    "revenue": ("매출액", "수익(매출액)", "영업수익", "매출"),
    "operating_income": ("영업이익", "영업이익(손실)"),
    "net_income": ("당기순이익", "당기순이익(손실)", "연결당기순이익", "당기순손익"),
}


def extract_dart_financials(items: list[dict[str, Any]], prefer: str = "CFS") -> dict[str, Any]:
    """DART 단일회사 주요계정(fnlttSinglAcnt) list → 표준 키(원 단위).

    연결(CFS) 우선, 없으면 개별(OFS) fallback. 반환에 'fs_div' 포함.
    사용 금액 필드: thstrm_amount (당기). 분기 보고서 IS 항목은 thstrm_add_amount(누적)가
    있으면 그것을 우선 사용한다.
    """
    order = [prefer, "OFS" if prefer == "CFS" else "CFS"]
    for fs_div in order:
        rows = [r for r in items if str(r.get("fs_div", "")).upper() == fs_div]
        if not rows:
            continue
        out: dict[str, Any] = {"fs_div": fs_div}
        for key, names in _DART_ACCOUNTS.items():
            val = None
            for r in rows:
                nm = str(r.get("account_nm", "")).replace(" ", "")
                if nm in names:
                    amt = None
                    if r.get("sj_div") == "IS":
                        amt = to_number(r.get("thstrm_add_amount"))
                    if amt is None:
                        amt = to_number(r.get("thstrm_amount"))
                    if amt is not None:
                        val = amt
                        break
            out[key] = val
        # 핵심 항목(자본총계) 이 있으면 채택
        if out.get("total_equity") is not None:
            return out
    return {"fs_div": None, **{k: None for k in _DART_ACCOUNTS}}


def build_financial_row(
    *,
    code: str,
    fiscal_year: int,
    price: float | None,
    market_cap_won: float | None,
    shares: float | None,
    dart: dict[str, Any],
    as_of: str,
) -> dict[str, Any]:
    """financials 테이블 upsert 행 (억원 환산 포함)."""
    ratios = compute_ratios(
        price=price,
        shares=shares,
        net_income=dart.get("net_income"),
        total_equity=dart.get("total_equity"),
        total_liabilities=dart.get("total_liabilities"),
        market_cap_won=market_cap_won,
    )
    return {
        "code": code,
        "fiscal_year": int(fiscal_year),
        "price": price,
        "market_cap": won_to_eok(market_cap_won),
        **ratios,
        "revenue": won_to_eok(dart.get("revenue")),
        "operating_income": won_to_eok(dart.get("operating_income")),
        "net_income": won_to_eok(dart.get("net_income")),
        "as_of": as_of,
    }


# ─────────────────────────── 배당 ───────────────────────────
def consecutive_dividend_years(dps_by_year: dict[int, float | None], end_year: int) -> int:
    """end_year 부터 과거로 연속해서 dps>0 인 연수. end_year 자체가 0/None 이면 0."""
    n = 0
    y = end_year
    while True:
        v = dps_by_year.get(y)
        if v is None or v <= 0:
            break
        n += 1
        y -= 1
    return n


def payout_ratio(dps: float | None, eps: float | None) -> float | None:
    """배당성향 % = dps / eps * 100 (eps>0 일 때만)."""
    if dps is None or eps is None or eps <= 0:
        return None
    return round(dps / eps * 100, 2)


def dividend_yield(dps: float | None, price: float | None) -> float | None:
    """배당수익률 % = dps / price * 100."""
    if dps is None or price is None or price <= 0:
        return None
    return round(dps / price * 100, 2)


def default_ex_dividend_date(fiscal_year: int, trading_days_dec: Sequence[date] | None = None) -> date:
    """12월 결산법인 기본 규칙: 배당기준일 = 12월 마지막 거래일, 배당락일 = 그 전 영업일.

    trading_days_dec 가 주어지면(해당 연도 12월 실제 거래일 목록) 뒤에서 두 번째 날을 반환.
    없으면 평일 기준 근사(12/31 부터 역산해 평일 2개 중 이전 것). 공휴일은 반영되지 않음.
    TODO: KRX 배당 일정(배당기준일·배당락일) 데이터 확보 시 이 규칙을 교체.
    """
    if trading_days_dec:
        days = sorted(set(trading_days_dec))
        if len(days) >= 2:
            return days[-2]
        return days[-1]
    d = date(fiscal_year, 12, 31)
    found: list[date] = []
    while len(found) < 2:
        if d.weekday() < 5:
            found.append(d)
        d -= timedelta(days=1)
    return found[1]


def parse_alot_matter(items: list[dict[str, Any]], bsns_year: int, stock_knd: str = "보통주") -> dict[int, float | None]:
    """DART 배당에 관한 사항(alotMatter) list → {회계연도: 주당 현금배당금(원)}.

    한 번의 호출에 당기(thstrm)/전기(frmtrm)/전전기(lwfr) 3개년이 담긴다.
    행 선택: se 에 '주당 현금배당금' 포함 + stock_knd 가 지정 종류(보통주) 또는 비어있음.
    """
    out: dict[int, float | None] = {}
    for r in items:
        se = str(r.get("se", "")).replace(" ", "")
        if "주당현금배당금" not in se:
            continue
        knd = str(r.get("stock_knd", "") or "").strip()
        if knd and stock_knd not in knd:
            continue
        out[bsns_year] = to_number(r.get("thstrm"))
        out[bsns_year - 1] = to_number(r.get("frmtrm"))
        out[bsns_year - 2] = to_number(r.get("lwfr"))
        break
    return out


def parse_alot_eps(items: list[dict[str, Any]], stock_knd: str = "보통주") -> float | None:
    """alotMatter 에서 (연결)주당순이익(원) 당기 값."""
    for r in items:
        se = str(r.get("se", "")).replace(" ", "")
        if "주당순이익" in se:
            knd = str(r.get("stock_knd", "") or "").strip()
            if knd and stock_knd not in knd:
                continue
            return to_number(r.get("thstrm"))
    return None


def build_dividend_row(
    *,
    code: str,
    fiscal_year: int,
    dps: float | None,
    price: float | None,
    eps: float | None,
    dps_history: dict[int, float | None],
    as_of: str,
    yield_override: float | None = None,
    ex_dividend_date: date | None = None,
) -> dict[str, Any]:
    """dividends upsert 행. yield_override 가 있으면(pykrx DIV) 그 값을 사용."""
    hist = dict(dps_history)
    hist.setdefault(fiscal_year, dps)
    dy = yield_override if yield_override is not None else dividend_yield(dps, price)
    exd = ex_dividend_date or default_ex_dividend_date(fiscal_year)
    return {
        "code": code,
        "fiscal_year": int(fiscal_year),
        "dps": dps,
        "dividend_yield": round_or_none(dy, 2),
        "payout_ratio": payout_ratio(dps, eps),
        "consecutive_years": consecutive_dividend_years(hist, fiscal_year),
        "ex_dividend_date": exd.isoformat() if (dps and dps > 0) else None,
        "as_of": as_of,
    }


# ─────────────────────────── 종목 ───────────────────────────
def diff_delisted(previous_codes: Iterable[str], current_codes: Iterable[str]) -> list[str]:
    """이전 활성 코드 중 이번 목록에 없는 코드 = 상장폐지/제외 → is_active=false 대상."""
    return sorted(set(previous_codes) - set(current_codes))


def latest_annual_report_year(today: date) -> int:
    """가장 최근 사업보고서(11011) 회계연도 추정. 사업보고서는 익년 3월 말 제출 → 4월부터 전년도 확정."""
    return today.year - 1 if today.month >= 4 else today.year - 2


def latest_quarter_report(today: date) -> tuple[int, str]:
    """가장 최근 제출됐을 분·반기 보고서 (bsns_year, reprt_code).

    제출 마감: 1분기(11013) 5/15, 반기(11012) 8/14, 3분기(11014) 11/14, 사업(11011) 3/31.
    여유 있게 다음 달 초부터 반영한다.
    """
    y, m = today.year, today.month
    if m >= 12:
        return y, "11014"
    if m >= 9:
        return y, "11012"
    if m >= 6:
        return y, "11013"
    if m >= 4:
        return y - 1, "11011"
    return y - 1, "11014"
