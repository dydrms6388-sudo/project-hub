"""외부 데이터 소스 연결·인증 점검 (보고 전용 — 기본 종료코드 0).

점검 항목
  DART   list.json (공시목록, DART_API_KEY)           — 키 유효성 + 쿼터 힌트
  KIS    oauth2/tokenP + 현재가 1건 (KIS_APP_KEY/SECRET) — 토큰 발급은 1분 1회 제한 주의
  pykrx  get_market_ticker_list 1회 (KRX 웹, 키 불필요)
  Supabase (선택) stocks count — SUPABASE_URL/SERVICE_ROLE_KEY 있을 때만

결과: OK / FAIL / SKIPPED(no key). --strict 이면 FAIL 이 하나라도 있으면 종료코드 1.
사용: python verify_sources.py [--strict] [--timeout 20] [--kis-mock]  (실전 대신 모의투자 도메인)
"""
from __future__ import annotations

import argparse
import sys
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable

import requests

from common import env, get_logger, kst_today
from transforms import to_yyyymmdd, weekdays_back

log = get_logger("verify_sources")

DART_BASE = "https://opendart.fss.or.kr/api"
KIS_REAL = "https://openapi.koreainvestment.com:9443"
KIS_MOCK = "https://openapivts.koreainvestment.com:29443"


@dataclass
class Result:
    name: str
    status: str  # OK | FAIL | SKIPPED
    detail: str
    hint: str = ""
    ms: int = 0


def _timed(fn: Callable[[], tuple[str, str, str]]) -> Result:
    t0 = time.time()
    try:
        status, detail, hint = fn()
    except requests.exceptions.ProxyError as e:
        status, detail, hint = "FAIL", f"프록시 차단: {str(e)[:120]}", "샌드박스/사내망 프록시가 외부 도메인을 막는지 확인"
    except requests.exceptions.SSLError as e:
        status, detail, hint = "FAIL", f"TLS 오류: {str(e)[:120]}", "CA 번들/프록시 설정 확인 (TLS 검증 해제 금지)"
    except requests.exceptions.ConnectionError as e:
        status, detail, hint = "FAIL", f"연결 실패: {str(e)[:120]}", "네트워크/방화벽 확인"
    except requests.exceptions.Timeout:
        status, detail, hint = "FAIL", "타임아웃", "--timeout 늘려 재시도"
    except Exception as e:  # noqa: BLE001 — 보고 전용
        status, detail, hint = "FAIL", f"{type(e).__name__}: {str(e)[:140]}", ""
    return Result("", status, detail, hint, int((time.time() - t0) * 1000))


def check_dart(timeout: int) -> Result:
    key = env("DART_API_KEY")
    if not key:
        return Result("DART", "SKIPPED", "DART_API_KEY 없음", "opendart.fss.or.kr 에서 무료 키 발급 (1일 10,000건 — 공식 문서 확인 필요)")

    def go():
        end = kst_today()
        r = requests.get(
            f"{DART_BASE}/list.json",
            params={"crtfc_key": key, "bgn_de": to_yyyymmdd(end - timedelta(days=7)), "end_de": to_yyyymmdd(end), "page_count": 1},
            timeout=timeout,
        )
        if r.status_code != 200:
            return "FAIL", f"HTTP {r.status_code}: {r.text[:100]}", "프록시(403) 또는 DART 장애"
        js = r.json()
        st = str(js.get("status"))
        if st == "000":
            return "OK", f"list.json 정상 (total_count={js.get('total_count')})", "쿼터: 키당 1일 10,000건(추정) — 전 종목 재무 2건/종목 ≈ 5,400건"
        if st == "010" or st == "011":
            return "FAIL", f"키 오류 status={st}: {js.get('message')}", "DART_API_KEY 재확인/재발급"
        if st == "020":
            return "FAIL", "일일 한도 초과(020)", "내일 재시도 또는 키 추가"
        return "FAIL", f"status={st}: {js.get('message')}", ""

    res = _timed(go)
    res.name = "DART"
    return res


def check_kis(timeout: int, mock: bool = False) -> Result:
    app_key, app_secret = env("KIS_APP_KEY"), env("KIS_APP_SECRET")
    if not app_key or not app_secret:
        return Result("KIS", "SKIPPED", "KIS_APP_KEY/KIS_APP_SECRET 없음", "한국투자증권 OpenAPI 는 선택(실시간 시세용). 현재 파이프라인은 pykrx 지연시세 사용")
    base = KIS_MOCK if mock else KIS_REAL

    def go():
        r = requests.post(
            f"{base}/oauth2/tokenP",
            json={"grant_type": "client_credentials", "appkey": app_key, "appsecret": app_secret},
            timeout=timeout,
        )
        if r.status_code != 200:
            return "FAIL", f"tokenP HTTP {r.status_code}: {r.text[:120]}", "토큰 발급은 1분 1회 제한 — 잠시 후 재시도"
        token = r.json().get("access_token")
        if not token:
            return "FAIL", f"tokenP 응답에 access_token 없음: {r.text[:120]}", ""
        q = requests.get(
            f"{base}/uapi/domestic-stock/v1/quotations/inquire-price",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": app_key,
                "appsecret": app_secret,
                "tr_id": "FHKST01010100",
                "custtype": "P",
            },
            params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": "005930"},
            timeout=timeout,
        )
        if q.status_code != 200:
            return "FAIL", f"inquire-price HTTP {q.status_code}: {q.text[:120]}", ""
        js = q.json()
        if str(js.get("rt_cd")) != "0":
            return "FAIL", f"rt_cd={js.get('rt_cd')} {js.get('msg1')}", ""
        prpr = (js.get("output") or {}).get("stck_prpr")
        return "OK", f"토큰 발급 + 005930 현재가={prpr}", "쿼터: 실전 초당 20건(모의 2건). 토큰 24h 유효 — 캐시 권장"

    res = _timed(go)
    res.name = "KIS" + (" (모의)" if mock else "")
    return res


def check_pykrx(timeout: int) -> Result:  # noqa: ARG001 — pykrx 는 자체 타임아웃
    def go():
        from pykrx import stock

        d = to_yyyymmdd(weekdays_back(kst_today() - timedelta(days=1), 1)[0])
        tickers = stock.get_market_ticker_list(d, market="KOSPI")
        n = len(tickers)
        if n == 0:
            return "FAIL", f"{d} KOSPI 종목 0개 (휴장일·KRX 응답 변경·로그인 필요)", "KRX_ID/KRX_PW 설정 또는 pykrx 업데이트 확인"
        auth = "로그인" if (env("KRX_ID") and env("KRX_PW")) else "비로그인(KRX_ID/KRX_PW 미설정)"
        return "OK", f"{d} KOSPI {n} 종목 [{auth}]", "API 키 없음. pykrx≥1.1 은 일부 조회에 KRX 로그인 필요 → KRX_ID/KRX_PW 권장. 과도한 호출 시 차단 → sleep 유지"

    res = _timed(go)
    res.name = "pykrx"
    return res


def check_supabase(timeout: int) -> Result:  # noqa: ARG001
    url, key = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return Result("Supabase", "SKIPPED", "SUPABASE_URL/SERVICE_ROLE_KEY 없음", "")

    def go():
        from supabase import create_client

        sb = create_client(url, key)
        res = sb.table("stocks").select("code", count="exact").limit(1).execute()
        return "OK", f"stocks count={res.count}", ""

    res = _timed(go)
    res.name = "Supabase"
    return res


def print_table(results: list[Result]) -> None:
    w = max(10, max(len(r.name) for r in results))
    print("\n" + "=" * 100)
    print(f"{'SOURCE':<{w}}  {'STATUS':<8} {'MS':>6}  DETAIL")
    print("-" * 100)
    for r in results:
        print(f"{r.name:<{w}}  {r.status:<8} {r.ms:>6}  {r.detail}")
        if r.hint:
            print(f"{'':<{w}}  {'':<8} {'':>6}  ↳ {r.hint}")
    print("=" * 100)
    ok = sum(r.status == "OK" for r in results)
    fail = sum(r.status == "FAIL" for r in results)
    skip = sum(r.status == "SKIPPED" for r in results)
    print(f"OK {ok} / FAIL {fail} / SKIPPED {skip}\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--strict", action="store_true", help="FAIL 있으면 종료코드 1")
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--kis-mock", action="store_true", help="KIS 모의투자 도메인 사용")
    ap.add_argument("--skip-supabase", action="store_true")
    a = ap.parse_args(argv)

    results = [check_dart(a.timeout), check_kis(a.timeout, a.kis_mock), check_pykrx(a.timeout)]
    if not a.skip_supabase:
        results.append(check_supabase(a.timeout))
    print_table(results)
    if a.strict and any(r.status == "FAIL" for r in results):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
