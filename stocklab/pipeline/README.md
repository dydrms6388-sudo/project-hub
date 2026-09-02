# 스톡랩 데이터 파이프라인 (Python 3.11)

KOSPI/KOSDAQ 종목·시세·재무·배당을 수집해 Supabase(`supabase/migrations/0001_init.sql`)에 적재하고,
Next.js 크론 라우트(`/api/cron/daily-pick`)를 호출해 "오늘의 종목"을 선정한다.
**프레임워크 없음, 비용 $0** (GitHub Actions 무료 분 + Supabase Free + 무료 공개 API).

```
pipeline/
├── common.py            env·Supabase(service role)·재시도·500행 배치 upsert·로깅
├── transforms.py        순수 계산 로직 (PER/PBR/ROE/부채비율/연속배당/KST 날짜) — pytest 대상
├── load_stocks.py       종목 마스터 (pykrx → FDR fallback, 상장폐지 is_active=false)
├── load_prices.py       일봉 OHLCV + 시가총액 (기본 최근 5영업일, --full 20년 백필)
├── load_financials.py   DART 주요계정 → financials (pykrx fundamental fallback)
├── load_dividends.py    DART 배당사항 → dividends (pykrx DIV/DPS fallback)
├── trigger_daily_pick.py  POST $SITE_URL/api/cron/daily-pick (Bearer CRON_SECRET)
├── verify_sources.py    DART/KIS/pykrx/Supabase 연결 점검표
├── run_daily.py         오케스트레이터 (GitHub Actions 진입점)
├── tests/test_transforms.py
└── requirements.txt
```

## 1. 설치

```bash
cd stocklab/pipeline
python3.11 -m venv .venv && source .venv/bin/activate   # .venv 는 gitignore
pip install -r requirements.txt
python -m pytest -q                                      # 네트워크 불필요, 27 tests
```

## 2. 환경변수

`pipeline/.env`(gitignore) 또는 `stocklab/.env.local` 에 두면 자동 로드된다 (`NEXT_PUBLIC_*` 별칭도 인식).

| 변수 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_URL` | ✅ | 프로젝트 URL (`NEXT_PUBLIC_SUPABASE_URL` 도 인식) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **service role** — RLS 우회 쓰기. 서버/CI 전용, 브라우저 노출 금지 |
| `DART_API_KEY` | 권장 | 금감원 OpenDART 키. 없으면 financials/dividends 가 pykrx fallback(ROE·부채비율 없음) |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 선택 | 한국투자증권 OpenAPI — 현재는 `verify_sources.py` 점검에만 사용 (실시간 시세 도입 대비) |
| `SITE_URL` | 권장 | 예 `https://stocklab.tomatoeggcat.com` (`NEXT_PUBLIC_SITE_URL` 별칭) |
| `CRON_SECRET` | 권장 | 크론 라우트 Bearer 토큰 (Vercel 환경변수와 동일 값) |
| `DRY_RUN=1` | 선택 | DB 쓰기 없이 로그만 (모든 스크립트 `--dry-run` 과 동일) |
| `LOG_LEVEL` | 선택 | 기본 INFO |

## 3. 로컬 실행

```bash
python verify_sources.py              # 소스 점검표 (키 없으면 SKIPPED, 실패해도 exit 0; --strict 로 1)
python load_stocks.py                 # 종목 ~2,700
python load_prices.py                 # 최근 5영업일
python load_prices.py --full          # 최초 1회 20년 백필 (수 시간, 날짜당 sleep 2s)
python load_financials.py --limit 20  # DART 테스트 (20종목)
python load_dividends.py --source pykrx
python trigger_daily_pick.py
python run_daily.py --dry-run         # 전체 흐름 (쓰기 없음)
```

초기 적재 순서: `load_stocks` → `load_prices`(FK: stocks 필요) → `load_financials`(가격·주식수 필요) → `load_dividends`.

## 4. GitHub Actions 스케줄

`.github/workflows/stocklab-pipeline.yml` — `30 20 * * 1-5` UTC = **05:30 KST 평일** (`run_daily.py`).
Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DART_API_KEY`, `SITE_URL`, `CRON_SECRET`.
`workflow_dispatch` 입력: `full_backfill`(20년 시세), `with_financials`(요일 무관 DART 재무).

요일별 기본 동작(`run_daily.py`):

| 요일 | stocks | prices | financials | dividends |
|---|---|---|---|---|
| 월 | ✅ | ✅ | **DART** (≈5,400건) | pykrx |
| 화 | ✅ | ✅ | 스킵 | **DART** (years=6, ≈5,400건) |
| 수~금 | ✅ | ✅ | 스킵 | pykrx |

DART 키가 없으면 매일 financials·dividends 를 pykrx 로 채운다 (PER/PBR/EPS/BPS/DIV/DPS 만).
Vercel Cron(`vercel.json`, 06:00 KST)이 daily-pick 을 이미 돌리므로 Actions 의 트리거는 **보조**(중복 호출은 `pick_date` upsert 로 멱등).

## 5. 쿼터·제약

- **DART**: 무료 키 **1일 10,000건**(공식 안내 기준, 변경 여부 확인 필요). `status=020` 시 즉시 중단 후 요약. 종목당 재무 2건(사업+분기, `--quarter-off` 로 1건), 배당 `ceil(years/3)` 건. 재무·배당을 **같은 날** 전 종목 돌리면 초과 → 요일 분산.
- **pykrx**: KRX 정보데이터시스템 웹을 스크레이핑한다. 키 불필요이지만 **KRX 응답 형식이 바뀌면 깨진다**(빈 DataFrame·KeyError). 장중/휴장일에는 빈 응답 → 스킵 처리. 호출 간 `sleep` 을 유지해 차단을 피한다. 깨지면 `pip install -U pykrx` 후 컬럼명 확인.
- **KIS**: 토큰 발급 1분 1회, 실전 초당 20건. 현재 적재에는 미사용.
- **KRX 데이터 재배포 주의**: KRX 시세·지수 데이터는 상업적 재배포에 라이선스 제약이 있다. 본 서비스는 **지연 시세(전일 종가)·파생 지표(PER/PBR 등)만 화면에 표시**하고 원시 OHLCV 를 외부에 재배포(API/다운로드)하지 않는다. 표시 시 "데이터 기준일" 과 출처(KRX/DART) 고지 유지.
- **Supabase Free**: 500MB. `daily_prices` 20년 전 종목 ≈ 1,400만 행이면 초과 가능 → 기본은 최근 구간만, 백필은 `--from/--to` 로 범위 조절. 파티셔닝 전략은 `0001_init.sql` 주석 참고.
- **GitHub Actions**: 무료 2,000분/월. 일배치 ≈ 10~25분(DART 요일) → 월 ~400분.

## 6. 계산 규칙 (transforms.py)

- `eps = 순이익/주식수`, `bps = 자본총계/주식수`, `per = 종가/eps (eps>0)`, `pbr = 종가/bps (bps>0)`
- `roe = 순이익/자본총계×100`, `debt_ratio = 부채총계/자본총계×100` (자본총계>0)
- 금액: DART 원 → `financials` 억원(`market_cap/revenue/operating_income/net_income`). `daily_prices.market_cap` 은 원.
- 연결(CFS) 우선, 없으면 개별(OFS). 손익은 최신 사업보고서, 재무상태는 최신 분·반기로 갱신.
- `consecutive_years`: 최신 회계연도부터 연속 `dps>0`. `payout_ratio = dps/eps×100`.
- `ex_dividend_date`: 12월 결산 기본 규칙(12월 마지막 거래일의 전 영업일, 평일 근사). **TODO** KRX 배당일정으로 교체.
- 적자/자본잠식 종목은 per/pbr/roe 를 NULL 로 두어 앱 필터(`per > 0`)와 정합.

## 7. 알려진 한계 / TODO

- 12월 결산 외(3·6·9월) 법인의 배당락일이 부정확 — KRX 배당 일정 소스 확보 후 교체.
- 분기 IS 누적치로 TTM 계산은 미구현(사업보고서 연간치 사용).
- 우선주/스팩/리츠 구분 없음 — 필요 시 `stocks` 에 `kind` 컬럼 추가.
- 샌드박스(사내 프록시)에서는 DART/KIS/KRX 가 403 으로 차단되어 `verify_sources.py` 가 FAIL 을 보고한다 — 정상 동작(보고 전용).

## 8. 면책

수집 데이터는 공개 자료(KRX/DART) 기반의 참고 정보이며 투자 권유가 아니다. 오류·지연이 있을 수 있다.
