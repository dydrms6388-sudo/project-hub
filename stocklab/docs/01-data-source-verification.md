# 01. 데이터 소스 검증 — DART · KIS · pykrx/FinanceDataReader · KRX

> 작성: Wave 0 검증팀 (데이터) · 2026-09-02 · 상태: **문서 검증만 완료, 엔드포인트 실호출 미완료**
>
> **⚠️ 이 샌드박스에서 실제로 확인한 것과 못 한 것**
>
> | 대상 | 결과 | 비고 |
> |---|---|---|
> | `opendart.fss.or.kr` | **접속 불가** — 프록시 `CONNECT tunnel failed, response 403` | 인증·엔드포인트·한도는 공개 문서 기억에 근거. 실호출 **확인 필요** |
> | `openapi.koreainvestment.com` | **접속 불가** (403 CONNECT) | 동일 |
> | `data.krx.co.kr` | **접속 불가** (403 CONNECT) | pykrx 동작 여부 실측 불가 |
> | `finance.naver.com` | **접속 불가** (403 CONNECT) | FinanceDataReader 폴백 경로 실측 불가 |
> | `pypi.org` | **접속 가능** — `pykrx 1.2.8` (2026-05-04), `finance-datareader 0.9.202` (2026-05-13), `OpenDartReader 0.3.3` 최신 버전 메타데이터 확인 | 패키지가 살아있고 최근(4개월 내) 릴리즈됨 = 유지보수 중 신호 |
> | `registry.npmjs.org` | 접속 가능 | |
>
> 따라서 본 문서의 한도·필드명·응답 형식은 **로컬에서 `python pipeline/verify_sources.py` 로 반드시 재검증**해야 한다(§7 런북).

---

## 1. 소스 요약 및 P1 확정 결정표

| 데이터 항목 | P1 1차 소스 | 폴백 | P2 이후 | 갱신 주기(P1) |
|---|---|---|---|---|
| 전 상장사 목록(코드·명·시장·업종) | **pykrx** (`get_market_ticker_list`, `get_market_ticker_name`) | **FinanceDataReader** `StockListing('KRX')` | KIS 종목마스터 파일 | 일 1회(06:00 KST 배치 전) |
| 일봉(OHLCV, 시총) | **pykrx** (`get_market_ohlcv_by_date`, `get_market_cap_by_date`) | FinanceDataReader `DataReader(code)` | KIS 일별시세 API | 일 1회 |
| 시세(현재가) | **전일 종가(지연)** — 일봉의 마지막 행 | — | **KIS 실시간(웹소켓)** — P2 알림용 | 일 1회 |
| 재무제표 주요 계정(매출·영업이익·순이익·자본·부채) | **DART OpenAPI** `fnlttSinglAcntAll` / `fnlttSinglAcnt` | pykrx 펀더멘털(`get_market_fundamental` — PER/PBR/EPS/BPS/DIV/DPS 만) | — | 분기(공시 후) + 일 1회 신규 공시 체크 |
| 배당(DPS, 배당수익률) | **pykrx** `get_market_fundamental` (DIV, DPS) | DART `alotMatter`(배당에 관한 사항) | — | 일 1회 |
| 파생 지표(PER/PBR/ROE/부채비율) | 자체 계산(DART 계정 + 전일 종가 + 주식수) | pykrx PER/PBR 직접 값 | — | 일 1회 |
| 공시 원문 링크 | DART `list` + `rcept_no` | — | — | 일 1회 |

**결정:** 재무 = DART, 종목목록/일봉/배당 = pykrx → FinanceDataReader 폴백, 시세 = 전일 종가(지연), KIS = P2 실시간 및 pykrx 장기 대체 후보.

---

## 2. DART OpenAPI (금융감독원 전자공시)

| 항목 | 내용 | 확인 상태 |
|---|---|---|
| 개요 | 상장·비상장 공시 원문 및 정형화된 재무 데이터(XBRL 기반) 제공. 공공기관 무료 API | 확실 |
| URL | `https://opendart.fss.or.kr/api/{endpoint}.json` (또는 `.xml`) | 확실 |
| 인증 | 회원가입 → 인증키(`crtfc_key`, 40자) 발급 → 모든 요청에 쿼리스트링으로 전달. OAuth 없음 | 확실 |
| 비용 | 무료 | 확실 |
| 일 한도 | **일 10,000회/키** (공개 문서 기준 기억) | **확인 필요** (마이페이지 > 인증키 사용현황) |
| 고유번호 | 종목코드가 아닌 **8자리 `corp_code`** 사용. `corpCode.xml` (zip) 를 받아 종목코드↔corp_code 매핑 필요 | 확실 |
| 응답 상태 | `status: "000"` 정상, `"013"` 데이터 없음, `"020"` 한도 초과, `"010"` 키 오류 | 확인 필요(코드 표 최신본) |

### 2.1 P1 필요 엔드포인트

| 용도 | 엔드포인트 | 주요 파라미터 | 비고 |
|---|---|---|---|
| 종목코드↔corp_code 매핑 | `corpCode.xml` | `crtfc_key` | zip 응답. 하루 1회 캐시 |
| 단일회사 전체 재무제표 | `fnlttSinglAcntAll` | `corp_code`, `bsns_year`, `reprt_code`(11011 사업/11012 반기/11013 1분기/11014 3분기), `fs_div`(CFS 연결/OFS 별도) | 계정별 `account_nm`, `thstrm_amount`. **계정명이 회사별로 조금씩 다름** → `account_id`(IFRS 표준 태그) 기준 매핑 권장 |
| 다중회사 주요계정 | `fnlttMultiAcnt` | `corp_code`(콤마 구분, **최대 100개?**), `bsns_year`, `reprt_code` | 최대 개수 **확인 필요**. 전 상장사(≈2,600) 처리 시 호출 수 절감용 |
| 배당에 관한 사항 | `alotMatter` | `corp_code`, `bsns_year`, `reprt_code` | 주당 현금배당금, 배당수익률(회사 기재) |
| 주식 총수 | `stockTotqySttus` | 동일 | 발행주식수 → 시총·EPS 자체 계산 |
| 공시 목록 | `list` | `corp_code`, `bgn_de`, `end_de`, `pblntf_ty=A`(정기공시) | 신규 보고서 감지 → 재무 갱신 트리거 |

### 2.2 호출량 추정(P1)

| 작업 | 호출 수 | 빈도 |
|---|---|---|
| 초기 적재: 2,600사 × (사업보고서 1 + 배당 1 + 주식수 1) | ≈ 7,800 | 1회 (1일 한도 안에 들어가지만 **2일로 분할 권장**) |
| 분기 갱신: 2,600사 × 1 | ≈ 2,600 | 분기 1회 |
| 일일 신규 공시 체크 (`list`, 날짜 범위 전체) | ≈ 10 | 매일 |
| 여유 | 충분 (일 10,000 기준) | |

### 2.3 리스크·대안

| 리스크 | 영향 | 대응 |
|---|---|---|
| 계정명 비표준(회사별 "매출액"/"수익(매출액)"/"영업수익") | ROE·부채비율 결측 | `account_id` 우선 매핑 + 결측 시 pykrx 펀더멘털 값 사용 + 결측 종목은 스크리너에서 "데이터 없음" 표기(0 처리 금지) |
| 금융업(은행·보험) 계정 구조 상이 | 부채비율 무의미 | 업종 플래그로 스크리너 기본 제외 옵션 |
| 정정공시로 값 변경 | 과거 값 불일치 | `rcept_no` 저장, 정정 시 덮어쓰기 + 변경 로그 |
| 한도 초과(020) | 배치 실패 | 지수 백오프 + 다음날 재시도, 호출 카운터 저장 |
| 공공데이터 이용약관 | 재배포 | DART 데이터는 공공데이터로 **출처 표기 조건 하에 활용 가능**한 것으로 이해 — 약관 원문 **확인 필요** |

---

## 3. 한국투자증권 KIS Developers (REST + WebSocket)

| 항목 | 내용 | 확인 상태 |
|---|---|---|
| 개요 | 증권사 공식 Open API. 국내/해외 시세·주문·잔고. **계좌 개설 필수**(개인 무료) | 확실 |
| URL | 실전 `https://openapi.koreainvestment.com:9443`, 모의 `https://openapivts.koreainvestment.com:29443`, 웹소켓 `ws://ops.koreainvestment.com:21000`(실전) | 포트 **확인 필요** |
| 인증 | (1) KIS Developers 포털에서 앱 등록 → `appkey`/`appsecret` (2) `POST /oauth2/tokenP` 로 **접근토큰 발급(유효 24시간, 발급 간격 제한 — 1분 1회 수준으로 기억)** (3) 요청 헤더 `authorization: Bearer`, `appkey`, `appsecret`, `tr_id` (4) 웹소켓은 `POST /oauth2/Approval` 로 approval_key 별도 발급 | 토큰 발급 간격 **확인 필요** |
| 비용 | 무료(개인). 실시간 시세 이용료 없음(개인 한도 내) | 확인 필요 |
| 한도 | REST **초당 20건**(실전) / 모의 초당 2~5건 수준으로 기억. 웹소켓 **동시 등록 종목 수 제한(41개?)** | **확인 필요** (포털 공지) |
| 약관 | **개인 이용 목적**. 제3자에게 시세 재배포·상업적 서비스 제공은 **약관 위반 가능성 높음** → 스톡랩(다수 사용자 서비스)에서 KIS 시세를 재전송하는 것은 **P2 에서도 법인 계약/명시 허용 확인 전까지 금지** | **확인 필요 — 핵심 리스크** |

### 3.1 P1/P2 필요 엔드포인트 (참고, P1 미사용)

| 용도 | tr_id / 경로 | 비고 |
|---|---|---|
| 주식 현재가 | `FHKST01010100` `/uapi/domestic-stock/v1/quotations/inquire-price` | 종목당 1호출 → 2,600종목 전체 스캔은 초당 20건 기준 ≈ 2~3분 |
| 일별 시세(일봉) | `FHKST03010100` `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice` | 최대 100건/호출 → 장기 히스토리는 반복 호출 |
| 종목 마스터 | 포털 제공 `kospi_code.mst`/`kosdaq_code.mst` 파일(API 아님) | 전 상장사 목록 대체 가능 |
| 실시간 체결가 | 웹소켓 `H0STCNT0` | 알림용(P2). 등록 종목 수 제한 → 사용자 알림 종목 합집합이 한도 초과 시 폴링 혼합 필요 |

### 3.2 리스크·대안

| 리스크 | 대응 |
|---|---|
| 개인 계정으로 다수 사용자 서비스 → 약관 위반·키 정지 | P2 진입 전 KIS 고객센터/법인 API 채널로 **서면 확인**. 대안: 사용자 본인 키 입력(BYOK) 구조 — 그러면 서버가 시세를 재배포하지 않음 |
| 토큰 만료/재발급 제한 | Redis에 토큰 캐시(TTL 23h), 발급 실패 시 재시도 큐 |
| 장중 API 점검·지연 | 알림은 "지연 가능" 고지 |
| 웹소켓 종목 수 한도 | 사용자 알림 조건을 종목 단위가 아니라 **일봉 기준 조건(장 마감 후 1회 평가)** 으로 P1 설계 → 실시간 불필요 |

---

## 4. pykrx (KRX 정보데이터시스템 스크래핑)

| 항목 | 내용 | 확인 상태 |
|---|---|---|
| 개요 | `data.krx.co.kr` 의 내부 JSON 엔드포인트(`getJsonData.cmd`, `bld=dbms/MDC/STAT/...`)를 호출해 pandas DataFrame 으로 반환하는 비공식 라이브러리. 네이버 금융 일부 사용 | 확실 |
| 최신 버전 | **1.2.8 (2026-05-04)**, 2026-04 에 3회 릴리즈 → 활발히 유지보수 중 (PyPI 메타데이터 실측) | 확실 |
| 인증 | 없음(비로그인 스크래핑). User-Agent/Referer 헤더 의존 | 확실 |
| 비용 | 0 | |
| 한도 | 공식 한도 없음. KRX 측 **비공식 차단(IP rate-limit, 일시 403)** 사례 다수 보고. 호출 간 `time.sleep(0.5~1s)` 관행 | 확인 필요(실측) |
| 갱신 | KRX 는 장 마감 후 당일 데이터 확정(≈ 18:00 이후 안정). 배치는 **익일 06:00 KST 이전(예: 21:00 UTC = 06:00 KST)** 에 전일 기준으로 수집 — `vercel.json` cron `0 21 * * *` 와 일치 | 확실 |

### 4.1 P1 필요 함수

| 용도 | 함수 | 비고 |
|---|---|---|
| 종목 목록 | `stock.get_market_ticker_list(date, market="KOSPI"/"KOSDAQ")` + `get_market_ticker_name(code)` | 스팩·리츠·우선주 구분은 종목명 규칙으로 필터(우선주: 코드 끝자리 ≠ 0) |
| 일봉 전 종목(1일) | `stock.get_market_ohlcv_by_ticker(date, market)` | **1호출로 전 종목** → 일 배치에 최적 |
| 일봉 종목별 히스토리 | `stock.get_market_ohlcv_by_date(from, to, code)` | 백테스트용 초기 적재(2,600 × 1호출, 1초 간격 ≈ 45분) |
| 시총·주식수 | `stock.get_market_cap_by_ticker(date, market)` | 1호출 전 종목 |
| PER/PBR/EPS/BPS/DIV/DPS | `stock.get_market_fundamental_by_ticker(date, market)` | 1호출 전 종목. **DART 결측 폴백 및 배당 1차 소스** |
| 업종 | `stock.get_market_sector_classifications(date, market)` 또는 KRX 업종분류 | 함수명 버전별 상이 **확인 필요** |

→ **P1 일일 배치는 KRX 호출 약 6~8회로 끝난다**(전 종목 by_ticker 계열). 차단 위험이 매우 낮은 설계.

### 4.2 리스크·대안 (취약성 명시)

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| **KRX 사이트 개편으로 `bld` 코드/응답 스키마 변경 → pykrx 전면 중단** | 연 1~2회 발생 이력 | 배치 실패, 데이터 정지 | (1) 배치 결과 검증(행 수 < 전일의 90% 또는 NaN 비율 > 5% 이면 실패 처리, **전일 데이터 유지 + 관리자 알림**) (2) FinanceDataReader 폴백 자동 전환 (3) 화면에 "데이터 기준일" 상시 노출로 지연 투명화 |
| KRX IP 차단(클라우드 IP 대역) | 중 | 워커에서 403 | 워커 리전 선택(도쿄/서울), 호출 간격, 실패 시 폴백 |
| **KRX 시세정보 이용약관 — 재배포 규정** | **높음(법적)** | 서비스 중단 요구·손해배상 가능성 | §6 별도 상세. **P0 게이트 조건** |
| 휴장일 처리 | 확실 | 빈 DF | `get_nearest_business_day_in_a_week` 또는 자체 휴장일 테이블 |
| 신규상장/상장폐지 | 확실 | 코드 불일치 | 일일 목록 diff → 상폐 종목 `delisted_at` 기록(백테스트 생존자 편향 방지) |

---

## 5. FinanceDataReader (FDR)

| 항목 | 내용 | 확인 상태 |
|---|---|---|
| 개요 | 다중 소스(KRX, 네이버 금융, Yahoo, FRED 등) 통합 리더. `StockListing('KRX')`, `DataReader('005930')` | 확실 |
| 최신 버전 | **0.9.202 (2026-05-13)** — 유지보수 중 (PyPI 실측) | 확실 |
| 인증/비용 | 없음/0 | |
| 한도 | 없음(스크래핑). 네이버 금융 일봉은 비교적 안정적이지만 **네이버 역시 약관상 크롤링 금지 조항 존재 가능** → 폴백 용도로만 | **확인 필요** |
| P1 함수 | `fdr.StockListing('KRX')` (종목·시장·업종·시총), `fdr.DataReader(code, start, end)` (일봉), `fdr.StockListing('KRX-DELISTING')` (상폐 목록) | |
| 리스크 | pykrx 와 **같은 KRX 엔드포인트를 일부 공유** → 동시 장애 가능. 네이버 경로는 독립적이라 일봉 폴백으로 유효. 재무제표는 제공하지 않음 | |
| 갱신 | 일 1회, pykrx 실패 시에만 호출 | |

---

## 6. KRX 정보데이터시스템 — 라이선스/재배포 리스크 (⚠️ 핵심)

| 항목 | 내용 |
|---|---|
| 사실 | KRX 는 시세정보를 **유상 판매**(KRX 정보사업 — `data.krx.co.kr` 은 열람용, 실시간·지연 시세 제공 사업자에게 별도 계약·이용료). 증권사·포털이 시세를 서비스하는 것은 KRX 와의 **시세정보 이용계약**에 근거 |
| 리스크 | 스크래핑한 KRX 데이터를 **다수 이용자에게 재가공·재배포(특히 유료)** 하는 것은 KRX "시세정보 이용약관/재배포 규정" 위반으로 해석될 여지가 있음. 지연(전일 종가) 데이터라도 **면제된다는 근거를 확인하지 못함** |
| 현재 업계 관행 | 개인 개발자·소규모 서비스가 pykrx/FDR 로 사실상 사용 중이지만, 관행 ≠ 허용 |
| 완화 옵션 | (a) **KRX 정보사업 담당(데이터 상품)에 지연 시세·종목 기본정보의 소규모 서비스 이용 조건과 요금 문의** — 가장 확실 (b) 공공데이터포털의 **금융위원회 주식시세정보 API**(일 단위 종가·시총·주식수 제공, 공공데이터 이용허락) 를 1차 소스로 검토 — 재배포 문제를 크게 줄임, 커버리지·지연 **확인 필요** (c) 시세 노출을 **파생 지표(PER/PBR/배당수익률) 중심**으로 하고 원시 OHLCV 재배포 최소화 (d) 종가 표시에 "출처: KRX, 전일 종가" 명기 |
| **권고** | **P1 출시 전 (a)+(b) 병행 확인.** (b) 가 커버리지를 충족하면 pykrx 는 폴백으로 격하하고 공공데이터 API 를 1차 소스로 승격 |
| 상태 | **확인 필요 — P0 게이트 조건 D2** |

---

## 7. 로컬 검증 런북 (소유자 실행)

전제: Python 3.11+, 프로젝트 루트 `/home/user/project-hub/stocklab`. 다른 에이전트가 작성 중인 `pipeline/verify_sources.py` 는 아래 env 를 읽는다.

```bash
# 0. 환경
cd stocklab
python3 -m venv .venv && source .venv/bin/activate
pip install pykrx finance-datareader OpenDartReader requests pandas python-dotenv

# 1. 키 준비 (.env.example 참고, .env 는 gitignore)
export DART_API_KEY=...        # https://opendart.fss.or.kr → 인증키 신청
export KIS_APP_KEY=...         # https://apiportal.koreainvestment.com → 앱 등록 (계좌 필요)
export KIS_APP_SECRET=...

# 2. 통합 검증 (모든 소스 순차 호출, 표 형태 리포트 출력)
python pipeline/verify_sources.py

# 3. 개별 확인 (verify_sources.py 실패 시 원인 분리)
python - <<'EOF'
from pykrx import stock
d = stock.get_nearest_business_day_in_a_week()
print("영업일", d)
df = stock.get_market_ohlcv_by_ticker(d, market="ALL"); print("OHLCV rows", len(df)); print(df.head(3))
f = stock.get_market_fundamental_by_ticker(d, market="ALL"); print("FUND rows", len(f)); print(f.head(3))
c = stock.get_market_cap_by_ticker(d, market="ALL"); print("CAP rows", len(c))
EOF

python - <<'EOF'
import FinanceDataReader as fdr
l = fdr.StockListing('KRX'); print("FDR listing", len(l)); print(l.head(3))
print(fdr.DataReader('005930', '2026-08-01').tail(3))
EOF

python - <<'EOF'
import os, requests
k = os.environ["DART_API_KEY"]
r = requests.get("https://opendart.fss.or.kr/api/fnlttSinglAcnt.json",
  params=dict(crtfc_key=k, corp_code="00126380", bsns_year="2025", reprt_code="11011"), timeout=30).json()
print("DART status", r.get("status"), r.get("message")); print([x["account_nm"] for x in r.get("list", [])][:8])
EOF

python - <<'EOF'
import os, requests
r = requests.post("https://openapi.koreainvestment.com:9443/oauth2/tokenP", json=dict(
  grant_type="client_credentials", appkey=os.environ["KIS_APP_KEY"], appsecret=os.environ["KIS_APP_SECRET"]), timeout=30)
print("KIS token", r.status_code, list(r.json().keys()))
EOF
```

### 7.1 통과 기준 (체크리스트)

| # | 확인 항목 | 통과 기준 | 결과 기록 |
|---|---|---|---|
| V1 | pykrx 전 종목 OHLCV | 행 수 ≥ 2,400, 종가 NaN 0건 | ☐ |
| V2 | pykrx 펀더멘털 | PER/PBR/DIV 열 존재, 삼성전자(005930) 값 존재 | ☐ |
| V3 | pykrx 시총·주식수 | 행 수 V1 과 ±2% 이내 | ☐ |
| V4 | FDR 종목 목록 | 행 수 ≥ 2,400, `Market`/`Sector` 열 존재 | ☐ |
| V5 | FDR 일봉 폴백 | 005930 최근 20영업일 반환 | ☐ |
| V6 | DART 인증 | `status == "000"` | ☐ |
| V7 | DART 재무 계정 | 삼성전자 2025 사업보고서에서 매출액·영업이익·당기순이익·자산총계·부채총계·자본총계 6계정 매핑 성공 | ☐ |
| V8 | DART 한도 | 마이페이지 사용현황에서 일 한도 수치 기록 | 한도: ____ |
| V9 | KIS 토큰 | `access_token` 반환. 토큰 재발급 간격 제한 메시지 기록 | ☐ |
| V10 | KIS 현재가 1건 | 005930 `stck_prpr` 반환 | ☐ |
| V11 | KIS 약관 | 포털 이용약관에서 "재배포/제3자 제공" 조항 원문 캡처 | ☐ |
| V12 | KRX 재배포 | KRX 정보사업 문의 결과(메일/전화 기록) 또는 공공데이터포털 금융위 시세 API 커버리지 확인 | ☐ |
| V13 | 배치 소요시간 | 전 종목 일일 배치(V1~V3 + DART list) 10분 이내 | ____분 |

---

## 8. P1 파이프라인 설계 메모 (데이터팀 → 백엔드팀 인계)

| 항목 | 결정 |
|---|---|
| 실행 위치 | Python 워커(Fly.io/Railway) 크론 21:00 UTC. Vercel cron(`/api/cron/daily-pick`)은 **DB 적재 완료 후** `daily_picks` 계산만 수행(파이썬 워커가 완료 플래그 기록 → Vercel cron 이 확인) |
| 저장 | Supabase `stocks`, `prices_daily`, `financials`, `dividends`, `pipeline_runs`(성공/실패/행수/소요) |
| 검증 게이트 | 행 수·NaN 비율·전일 대비 종가 변동 ±30% 초과 종목 수 로그 → 실패 시 전일 스냅샷 유지 |
| 출처 표기 | 모든 표에 "출처: KRX(전일 종가), DART(공시)" |
| 금지 | 실시간 시세 표기, 장중 갱신 약속 |
