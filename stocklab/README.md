# 스톡랩 (StockLab) — 주식 데이터 도구 플랫폼

> 데이터로 종목을 찾고, 시뮬레이션으로 검증하고, 알림으로 놓치지 않는 개인 투자자용 올인원 도구.
> **추천을 팔지 않고 검증 도구를 판다.** (법적 포지션 A안 — 유사투자자문업 신고 없는 데이터 도구)

TomatoEggCat 허브의 서브프로젝트. 허브(`gen-pages.mjs`) 파이프라인과 무관하며 **별도 Vercel 프로젝트(root=`stocklab`)** 로 배포한다.

## 스택
Next.js 15 App Router · TypeScript strict · Tailwind v4 · Supabase(Postgres/RLS) · Vercel Cron · Python 파이프라인(pykrx + DART)

## 디렉터리
| 경로 | 내용 |
|---|---|
| `src/app/` | 페이지: `/`, `/calc/compound`, `/screener/value`, `/screener/dividend`, `/today`, `/about`, `/terms`, `/privacy`, `/disclaimer`, `/api/cron/daily-pick` |
| `src/lib/data/` | 데이터 소스 추상화 — Supabase ↔ 샘플 데이터 자동 폴백 |
| `src/lib/strategies.ts` | 사전 정의 전략 20종 + 오늘의 주식 선정 로직 |
| `supabase/migrations/` | 스키마·뷰·RPC·RLS |
| `pipeline/` | Python 일배치 (종목·일봉·재무·배당 적재, 소스 검증) |
| `docs/` | Wave 0 검증(법률·데이터·시장·수익성) → PRD → 설계 → P2/P3 핸드오프 |
| `scripts/check-expressions.mjs` | 금지 표현 가드 (`npm run lint:expr`) |

## 로컬 실행
```bash
cd stocklab
npm install
cp .env.example .env.local   # Supabase env 비우면 샘플 데이터 모드
npm run dev
npm run check                # typecheck + 금지 표현 검사
npm run build
```

## 배포 (Vercel)
- Root Directory: `stocklab`, Framework: Next.js. 환경변수는 `.env.example` 참고.
- `vercel.json` 크론: `/api/cron/daily-pick` 매일 21:00 UTC(=06:00 KST). `CRON_SECRET` 필수.
- 파이프라인: `.github/workflows/stocklab-pipeline.yml` (평일 05:30 KST) — 시크릿 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DART_API_KEY`, `SITE_URL`, `CRON_SECRET`.

## 법적·콘텐츠 규칙 (요약)
- 금지: 추천 / 매수 / 매도 / 목표가 제시 / 급등 / 수익·원금 보장. 허용: 조건 충족 종목 / 스크리닝 결과 / 계산 결과.
- 모든 화면 하단 면책 고지(`components/Disclaimer.tsx`). 광고는 결과 하단 1개만, 입력 화면 금지.
- 자세한 가이드: `docs/00-legal-expression-guide.md`, 게이트 판정: `docs/P0-GATE-DECISION.md`.
