# HANDOFF — P2 (구독·결제 + 백테스트 + 알림) Claude Code 프롬프트

- 전제: P1(MVP) 출시 완료. 코드 사실: `src/lib/types.ts` 컬럼명, `getDataSource()` 추상화, `/api/cron/daily-pick`(CRON_SECRET), `consume_usage` RPC, `usage_limits`·`profiles` 등 P1 7테이블.
- 참조 문서: `11-feature-specs.md §2·§3·§5`, `20-db-schema.md`(🟦), `21-api-design.md`, `22-backtest-engine-design.md`, `23-ux-flows.md §3~5`, `24-design-system.md`, `26-security-rls.md`.
- 아래 블록을 그대로 Claude Code 에 붙여 넣는다.

```
너는 시니어 풀스택 개발자다. 아래 명세로 주식 데이터 도구 플랫폼 "스톡랩"의 P2(구독·결제 + 백테스트 + 알림)를 구현한다. 작업 디렉터리는 /stocklab (Next.js 15 서브프로젝트) 와 /stocklab/worker (Python) 이다. 먼저 stocklab/docs/11-feature-specs.md, 20-db-schema.md, 21-api-design.md, 22-backtest-engine-design.md, 26-security-rls.md 를 읽고 시작한다.

[스택] Next.js 15 App Router, TypeScript strict, Supabase (Auth+Postgres+RLS, @supabase/ssr), Tailwind v4(globals.css 토큰만 사용), Vercel 배포. 백테스트 워커: Python 3.12 + FastAPI + pandas/numpy + pyarrow, Fly.io(nrt) 배포, Supabase 테이블 폴링 큐(claim_backtest_job RPC, FOR UPDATE SKIP LOCKED). 캐시/레이트리밋/멱등: Upstash Redis. 결제: 토스페이먼츠 빌링(빌링키 자동결제). 이메일: Resend. 알림톡: 솔라피(정보성 템플릿). 기존 P1 코드(src/lib/types.ts 컬럼명, getDataSource, kst.ts, usage.ts, Disclaimer, EmptyState)를 재사용하고 깨뜨리지 않는다.

[법적 제약] "매수 추천/매도/추천 종목/수익 보장/목표가 제시/급등" 계열 표현 금지(scripts/check-expressions.mjs 가 CI 기준). 사용 가능: "조건 충족 종목", "스크리닝 결과", "시그널(조건 충족) 발생", "지정가 도달 알림", "과거 시점 보유 목록". 백테스트·랭킹 결과 화면 상단에 고정 고지 "과거 성과가 미래 수익을 보장하지 않습니다" + 비용·데이터 가정 문구. 모든 페이지 푸터 Disclaimer 유지. 알림 본문은 거래관계 정보만(프로모션 문구 금지), 이메일 하단 1클릭 수신거부 링크 /u/[token] 필수, 채널별 동의 시각·문구 버전 저장. 전화번호는 프로 알림톡 선택 시에만 SMS 인증 후 AES-GCM 암호화 저장(phone_enc) 하고 마스킹 표시. 결제 화면에 환불 정책 체크박스와 /legal/refund 링크.

[구현 범위 — P2]
1. Auth 정리: 카카오·구글·이메일 OTP 로그인, /login?redirect=, profiles 트리거, /account. 로그인 사용자 스크리너 한도 20/일(usage key 'u:{uid}').
2. 권한 계층: src/lib/entitlements.ts 에 11-feature-specs.md §5.2 매트릭스를 상수로, getViewer()/can(viewer, feature) 서버 함수, v_plan 뷰 기반. 잠금 카드(LockCard)·한도 카드(QuotaCard)·잔여 배지(QuotaBadge) 컴포넌트.
3. 구독·결제: /pricing, /checkout(+confirm/fail), /account/billing. API: /api/billing/checkout·confirm(Idempotency-Key)·subscription·cancel·change-plan·update-card·refund-request, /api/webhooks/toss(webhook_events 멱등 + 결제조회 API 재확인), /api/cron/billing-renew(03:00 KST, orderId=sub_{id}_{YYYYMM} UNIQUE, past_due 3일 유예). 유료 사용자 AdSlot 미렌더.
4. 저장 조건식·시그널: saved_screens CRUD(개수 한도 트리거), 멀티팩터(프로, 백분위 가중합), 공개 공유 /s/[slug](프로, 표현 가드+신고), /api/cron/evaluate-screens(06:30 KST) 가 전 활성 조건식을 평가해 signals diff(enter/exit) 기록.
5. 백테스트: worker/ 에 22-backtest-engine-design.md 의 엔진(PricePanel, point-in-time 재무 merge_asof, DSL lark 파서 화이트리스트, t+1 시가 체결, 수수료 1.5bps·세금 18bps·슬리피지 10bps 기본, 배당 재투자, 상폐 종목 강제 청산), 20 기본 전략 seeds/builtin_strategies.json → strategies 시드, /health, /jobs/*, /internal/validate-strategy, /internal/rankings/run, HMAC 인증, pytest 정합성 테스트 12종(§9). Next: /backtest(목록·잠금), /backtest/new, /backtest/[id](SSE 진행률, KPI 4, 자산곡선/드로다운/월별 히트맵, 거래 내역, 과거 시점 보유 목록, 공유 카드 canvas PNG 워터마크 stocklab.tomatoeggcat.com), /backtest/compare(프로 2~4), /share/bt/[id], /rankings(무료는 전월 1위만, 나머지 마스킹), /strategies/[id](프로 편집·복제·랭킹 참가). 사용량 차감은 done 수신 시 consume_usage(feature='backtest', 월초 날짜). params_hash 24h 캐시.
6. 알림: /alerts (유형 signal/holding_move/ex_dividend/price_level/ranking_change, 채널 email/kakao/push 권한, 개수 한도 5/50 트리거), /api/alerts/*, /api/consents, /api/phone/verify/*, /api/cron/dispatch-alerts(06:30/16:30 KST 다이제스트, 쿨다운, 무음시간 21~08), Resend 템플릿 + 솔라피 알림톡 템플릿 코드 env, /u/[token] 수신거부, /api/webhooks/resend·solapi 로 alert_deliveries 상태 갱신.
7. 포트폴리오 진단: /portfolios, /portfolios/[id] (섹터 비중·HHI·60일 변동성·배당 캘린더 = 베이직, 상관관계 매트릭스·리밸런싱 비중 계산 = 프로). 문구는 "비중 계산 결과".
8. 데이터 확장: 파이프라인에 financial_statements(published_at), dividend_history, index_prices, daily_prices 2006~ 백필(연도 파티션 함수 ensure_price_partition), adj_close/trading_value 컬럼.
9. (선택, 시간 남으면) KIS 웹소켓 릴레이 relay/ (Node, Fly.io): 종목 구독 ≤41/연결, Upstash quote:{code} 15s, SSE /sse?token= (프로 JWT 검증), /api/quotes 폴백.

[DB] 마이그레이션 0010_billing.sql(subscriptions, payments, webhook_events, v_plan, profiles.plan 동기화 트리거), 0011_screens_alerts.sql(saved_screens, signals, alerts, alert_deliveries + 한도 트리거), 0012_backtest.sql(strategies+20 seed, backtests, rankings, financial_statements, dividend_history, index_prices, 파티션 백필, claim_backtest_job, cancel_backtest). RLS: 26-security-rls.md §2 의 SQL 그대로 — 공개 시장 데이터 anon select, 사용자 테이블은 auth.uid() 본인만, subscriptions/payments 는 본인 read 만, webhook_events·usage_limits 는 클라이언트 접근 차단, billing_key_enc·phone_enc 컬럼 revoke. 마이그레이션 끝에 RLS 미적용 테이블 점검 쿼리를 CI 에 추가.

[품질 기준] Lighthouse 90+ 유지, 모바일 우선(표는 컨테이너 내부 스크롤), 다크모드(토큰만), 에러 바운더리·빈 상태·로딩 스켈레톤, 상승 빨강(--up)/하락 파랑(--down) + 부호 병기, 숫자 .tnum, WCAG AA. npm run check(typecheck + lint:expr) 통과. worker: pytest 전부 통과, 20전략 스모크. 결제: 토스 테스트 키로 카드 등록→첫 결제→웹훅 중복 전송→해지 E2E 수동 시나리오 문서화(docs/RUNBOOK-P2.md). 시크릿은 .env.example 에 키 이름만 추가.

작업 순서: (1) 마이그레이션 0010~0012 + RLS + CI 점검 → (2) entitlements/getViewer/게이팅 컴포넌트 → (3) Auth·/account → (4) 결제(체크아웃→웹훅→갱신 cron) → (5) 저장 조건식·evaluate-screens cron → (6) worker 엔진·DSL·테스트·20전략 시드 → (7) 백테스트 UI·SSE·공유 카드·랭킹 → (8) 알림(이메일→알림톡)·수신거부 → (9) 포트폴리오 진단 → (10) 데이터 백필 파이프라인 → (11) 선택: KIS 릴레이. 각 단계 완료 시 npm run check 후 커밋하고 다음으로 진행. 스펙이 모호하면 docs 를 우선하고, docs 도 없으면 보수적(추천 표현 금지·서버 게이팅) 으로 결정한 뒤 docs/DECISIONS-P2.md 에 기록한다.
```
