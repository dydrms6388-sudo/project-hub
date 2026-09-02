# PHASE_REPORT_1 — 덕메이트 Phase 1 보고 (2026-09-02, G3 작성)

## 1. 요약

| 구분 | 상태 |
|---|---|
| **게이트 판정** | **미통과** — 프로덕션 URL 2개·Supabase 프로덕션·실계정 E2E 스크린샷 없음(자격증명·계정 부재, `DEPLOY_LOG.md` §2) |
| 코드·문서 | 그룹 A~E 산출물 전부 존재(문서 28 + G1·G2·G3). 앱 2개 빌드 통과, 마이그레이션 25, Edge Function 9, 테스트 338(vitest) + 46(스모크) + DB S1~S11 |
| 파이프라인 | GitHub Actions 4개 + `vercel.json` 2개 완성. `duckmate-ci.yml` 은 PR #46 run #3(`9fbca77`)에서 **2/2 잡 성공**(첫 실행의 셰임 순서 결함은 `db-test.sh` 수정으로 해소). 배포 3개는 시크릿 등록 즉시 동작 |
| 남은 것 | 소유자 체크리스트 16단계(`DEPLOY_LOG.md` §3, 3~4h + 계약) |

## 2. 게이트 체크리스트 (PRD §8 Phase 1 → 2)

| # | 항목 | 판정 | 근거 / 막힌 이유 |
|---|---|---|---|
| 1 | Vercel 프로덕션 URL 2개 200, 법적 페이지 5종 노출 | ✗ | Vercel 프로젝트·토큰 없음. 로컬 빌드: web 20 페이지·company 15 페이지 생성, `/legal/*` 200(check-noindex 70/70) |
| 2 | Supabase 프로덕션 마이그레이션 전부 적용, RLS 100%, service role 키 번들 미포함 | ✗(부분) | 프로젝트 없음. 로컬 PG16: 25개 적용·RLS 52/52(G2 §2.2). 번들: 키 **값** 미포함(더미 값 grep 0) — 키 **이름**은 4 청크에 포함(G3 관찰 1, 비차단) |
| 3 | Playwright P1 시나리오 프로덕션 통과 + 실계정 2개 스크린샷 | ✗ | `phase1.spec.ts` 작성·타입체크 완료, 실 Supabase 없어 skip(6). 스모크 46 통과. 실계정 = SMS 공급자 + allowlist 필요 |
| 4 | `check-legal-placeholders` 경고 확인, `check-noindex` 통과, `광고 영역`/`REPLACE_` 0 | ✓ | 경고 4파일(의도된 `{{KEY}}`), noindex 70/70, 잔재 0 |
| 5 | 신고 1건 → 증거 → 어드민 큐 → 판정 → 통보 수동 QA | ✗ | DB 레벨(S9)·목 라우트 스모크만. 실환경 필요 |
| 6 | 사진 업로드 → 검수 승인 → L3 → 데이팅 모드 수동 QA | ✗ | Storage·Edge `photo-review` 실행 환경 없음(Docker 없음) |
| 7 | 마스킹·차단 양방향 수동 QA | ✗(DB ✓) | DB S8·S10·S11 PASS, 스모크 마스킹 확인. 실 Realtime 미검증 |
| 8 | 07:00 배치 1회 성공 로그 + 온디맨드 폴백 | ✗(DB ✓) | `ensure_today_recommendations` S5 PASS. pg_cron 실행 환경 없음 |
| 9 | `DEPLOY_LOG.md` 작성, `.env.example` 최신, 비밀값 커밋 0 | ✓ | 작성됨(URL 없음 명시). `.env.example` G2 보강분 포함. git 히스토리 grep 0 |
| 10 | 게임/결제/Capacitor 코드 0줄 | ✓ | `packages/game-engine/src/index.ts` 1줄 스텁, 결제는 스키마·상태머신·문서만(19), Capacitor 없음 |

## 3. 그룹별 산출물

| 그룹 | 에이전트 | 산출물 | 상태 |
|---|---|---|---|
| A 분석 | A1~A6 | `docs/agents/01_market` · `02_persona` · `03_core_loop` · `04_monetization` · `05_trust_safety` · `06_PRD`(F-001~F-0xx, 게이트) | 완료 |
| B 법무 | B1~B3 | `07_legal_checklist` · `08_legal_docs` · `09_store_policy`, `apps/web/content/legal/*.md` 7종(+README 변수 18) | 완료(사업자 정보는 플레이스홀더) |
| C 디자인 | C1~C4 | `10_brand` · `11_design_system`(`packages/ui`) · `12_flows` · `13_company_site` | 완료 |
| D 백엔드 | D1~D8 | `14_schema`(마이그레이션 0001~0014·seed·`packages/db`) · `15_auth`(0014, 미들웨어·게이트·mock 인증) · `16_matching`(0020·0021, `daily-recommendations`) · `17_chat`(0030, Realtime·마스킹) · `18_moderation`(0040~0043, `moderation-*`) · `19_payments`(0006 스키마만, `toss-webhook` 501) · `20_notifications`(0050·0051, `push-send`·`push-dispatch`, sw) · `21_admin`(0060, `/admin/*`) | 완료(로컬 PG 검증). 실 Supabase 미검증 |
| E 프론트 | E1~E6 | `22_fe_onboarding` · `23_fe_discover` · `24_fe_chat` · `25_fe_profile` · `26_fe_company`(`apps/company`) · `27_fe_quality`(check 스크립트 3·sitemap/robots·아이콘) — `apps/web` 라우트 50 page.tsx | 완료(E6 미달 항목 §4) |
| F 게임 | F1~ | `packages/game-engine` 스텁 | **Phase 2** — 착수 금지 유지 |
| G 게이트 | G1 | `G1_e2e`: `smoke.spec`(46) · `phase1.spec`(실환경) · `phase1_flow.sql`(S1~S11) · `scripts/db-test.sh` | 완료(실환경 실행 대기) |
| | G2 | `G2_security`: 0070 보안 수정(P1 1·P2 4), 보안 헤더, `.env.example` | 완료(잔여 P3 §4) |
| | G3 | `G3_deploy`: 워크플로 4 · `vercel.json` 2 · `.vercelignore` 2 · `config.toml` · `DEPLOY_LOG.md` · 이 문서 | 완료(배포 실행은 소유자) |

## 4. 알려진 결함 · 잔여 리스크

| 출처 | 항목 | 심각도 | 조치 시점 |
|---|---|---|---|
| G3 | 프로덕션 미배포 — 자격증명 9·계정 4·결정 10(`DEPLOY_LOG.md` §2) | 게이트 차단 | 소유자 |
| G3 | SMS 공급자 없으면 실 가입 불가(Phone OTP 단일 로그인) | 게이트 차단 | 소유자 계약 |
| G3 관찰 1 | `lib/env.ts` serverSchema **키 이름**이 클라이언트 청크 4개에 포함(값 아님) | P3 | env 모듈 분리(D2/E), CI 번들 가드로 값 누출은 고정 |
| G3 | `config.toml` PG 17 vs 로컬 검증 PG 16 | P3 | prod `db push` 후 G2 §3 재검증 SQL |
| G2 잔여 | `active_sanction_level` 타인 조회(G2-12), 엄격 CSP 미도입(G2-06), `contact` 메모리 레이트리밋·XFF(G2-08), 비상수시간 비교·재생(G2-09), moderator 컬럼 노출(G2-11), analytics 남용(G2-16), 금칙어 DB 미러 없음 | P3 | Phase 2 스키마 정리 / Phase 3·4 전 |
| G2-15 | `pnpm audit` postcss 4건(빌드타임, `apps/company>next>postcss`) | P3 | Next 패치 업데이트 |
| E6 §6 | company 홈 JS 125KB gz(목표 80KB — Next 공통 102KB) → 목표 개정 제안 | 미달(비차단) | 13 결정 개정 또는 Phase 5 프레임워크 검토 |
| E6 §6 | Lighthouse Perf 랜딩 88~97(Pretendard CDN 렌더 차단), `/legal/terms` 77(HTML 134KB) | 미달 | Phase 2 폰트 self-host, 프로덕션 실측 후 재판정 |
| E6 §6·결정 21 | `/` 랜딩 메타데이터가 일반 UA 에서 `<body>` 로 스트리밍(Next 15.5) — 크롤러 UA 는 `htmlLimitedBots` 로 head 렌더 | 미달(SEO) | 배포 후 `curl -A Googlebot` 확인, Next 업스트림 |
| G1 §19 | `/blocked/age`·`/match/[id]` h1 없음(h2/h3) | P3 | E6 후속(`EmptyState as` prop) |
| E5 §14·15 | `Button asChild` 스피너 결함(company 는 LinkButton 우회), lucide 네임스페이스 import → E6 가 정적 map 으로 축소(306→125KB) | 해소/우회 | ui 정리 Phase 2 |
| D7 | Web Push 실전송·sw 실기기 미검증, pg_cron/pg_net 실동작 미검증 | 미검증 | `DEPLOY_LOG.md` §3-6·§3-15 |
| D8/G2 | `/admin` 실브라우저 미확인(Docker 없음), moderator = 소유자 1명으로 시작 | 미검증 | §3-7 후 확인 |
| 법무 | 사업자 정보 22 키 플레이스홀더 노출(의도), 위치정보사업자 신고 여부 미정 | Phase 3 전 필수 | 소유자·법무 |

## 5. Phase 2 선행조건

1. §2 체크리스트 10개 전부 ✓ — 특히 프로덕션 URL 2개, Supabase prod 마이그레이션 25 적용 기록(`DEPLOY_LOG.md` §10), 실계정 2개 가입→인증→매칭→채팅 스크린샷(`docs/screenshots/prod-*.png`).
2. 수동 QA 5건(신고 파이프라인·사진 검수→L3·마스킹/차단·07:00 배치·푸시 1건 수신) 결과를 `DEPLOY_LOG.md` 에 기록.
3. G1 `phase1.spec` 을 staging 에서 1회 통과(`e2e/artifacts/phase1-*.png`).
4. 소유자 결정: 서비스명 확정, 도메인, SMS 공급자, 초대 번호 allowlist, 온콜 시간대.
5. 기술 부채 착수 순서 제안: Next 패치(postcss) → `lib/env.ts` 분리 → 폰트 self-host → G2 잔여 P3(`active_sanction_level` 내부 분리, CSP) → `packages/db` 타입에 push 테이블 반영(`lib/push/db-types.ts` 삭제).
6. F 그룹(게임·리텐션)은 위 1~3 이 채워진 뒤에만 `packages/game-engine` 을 스텁에서 확장한다(절대 규칙 1).
