# G3 — 배포 러너 (GitHub Actions → Vercel ×2 · Supabase 마이그레이션 · 사전 검증)

> 입력: `G2_security.md`(§G3 1~12), `G1_e2e.md`(§G3 1~10), `26_fe_company.md`(§G3), `20_notifications.md`(§G3 18~22), `14_schema.md` §5, `15_auth.md` §4~5, `21_admin.md` §18, `27_fe_quality.md`(§G3 12~15), `06_PRD.md` §8, 상위 리포 `.github/workflows/deploy-isitnormal.yml`·`DEPLOY-CHECKLIST.md`.
> 산출물: `/.github/workflows/{deploy-duckmate-web,deploy-duckmate-company,duckmate-ci,duckmate-supabase-migrate}.yml`, `apps/{web,company}/vercel.json`, `apps/{web,company}/.vercelignore`, `supabase/config.toml`(`[functions.*]` 3개 + 주석), `docs/DEPLOY_LOG.md`, `docs/PHASE_REPORT_1.md`, 이 문서.
> 기준일 2026-09-02. **환경 제약**: Vercel 토큰·Supabase 토큰·프로젝트 ID·Docker 없음, 네트워크 npm·GitHub 만 → 프로덕션 배포 미실행. git commit 없음. 비밀값 없음. E6 동시 작업 파일(`scripts/check-*.mjs`, `app/{sitemap,robots}.ts`, `next.config.ts`)·다른 에이전트 코드 미수정.

## 다음 에이전트에게 넘기는 결정사항

### 오케스트레이터 → 소유자에게 물을 질문 (답이 오기 전에는 게이트 통과 불가)

1. **Vercel**: 계정/팀은 무엇이며 프로젝트 2개(web·company)를 만들었는가? 만들었으면 GitHub Secrets 6개 — `DM_WEB_VERCEL_TOKEN`, `DM_WEB_VERCEL_ORG_ID`, `DM_WEB_VERCEL_PROJECT_ID`, `DM_COMPANY_VERCEL_TOKEN`, `DM_COMPANY_VERCEL_ORG_ID`, `DM_COMPANY_VERCEL_PROJECT_ID` — 를 등록했는가? Vercel Git 자동배포는 껐는가(워크플로와 이중 배포 방지)?
2. **Supabase**: 프로젝트를 만들었는가(리전 `ap-northeast-2` 권장, PG 17)? GitHub Secrets `DM_SUPABASE_ACCESS_TOKEN`, `DM_SUPABASE_PROJECT_REF`, `DM_SUPABASE_DB_PASSWORD` 를 등록했는가? staging 용 두 번째 프로젝트(G1 phase1 E2E 전용 — 헬퍼가 auth 유저를 삭제하므로 prod 금지)를 둘 것인가?
3. **SMS 공급자**: Supabase Phone Auth 용 공급자(Twilio / Twilio Verify / MessageBird / Textlocal / Vonage) 계정이 있는가? 없으면 실 가입이 불가하고 대시보드 "Test phone numbers" 로 소유자 번호만 통과시키는 베타만 가능하다.
4. **Vercel(web) env 값 준비**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_COMPANY_URL`, `IDENTITY_VERIFIER=mock`, `IDENTITY_MOCK_ALLOWLIST`(초대 번호 sha256 목록), `IDENTITY_CI_SALT`(회전 금지), `PHONE_HASH_SALT`, `CONSENT_HASH_SALT`, `AUTH_GATE_SECRET`, `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. company env: `NEXT_PUBLIC_COMPANY_URL`, `NEXT_PUBLIC_WEB_APP_URL`, `NEXT_PUBLIC_CONTACT_ENDPOINT`.
5. **Supabase Edge secrets 값 준비**: `PHOTO_REVIEW_WEBHOOK_SECRET`, `DAILY_RECO_WEBHOOK_SECRET`, `MODERATION_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET`, `CONTACT_IP_SALT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`(+ 선택 `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`). 워크플로는 이 값을 다루지 않는다 — 대시보드 또는 `supabase secrets set --env-file` 로 소유자가 직접.
6. **도메인**: web·company 도메인을 살 것인가, `*.vercel.app` 으로 시작할 것인가? 확정 시 env 4개 + Supabase Auth Site URL/Redirect + `company.ts DOMAIN` 을 갱신하고 재배포.
7. **서비스명·사업자 정보**: 가칭 "덕메이트" 확정? `apps/company/config/company.ts` 22 키(상호·대표·사업자번호·통신판매업·주소·책임자 3인 등)를 언제 채울 것인가? Phase 1 은 플레이스홀더 노출 허용(절대 규칙 4), Phase 3 결제 전 필수.
8. **초대 번호(allowlist)**: 게이트의 "실계정 2개" 를 위해 소유자 번호 + 테스터 번호 최소 2개 필요 — E.164 숫자만 전달받아 `sha256` 해시로 `IDENTITY_MOCK_ALLOWLIST` 에 넣는다(값은 소유자가 Vercel 에 직접 입력).
9. **운영 결정**: 검수·신고 온콜(소유자 1인) 시간대, 위치정보사업자 신고 여부(법무), 문의 폼 Turnstile 도입 여부, 시드 500명 확보 계획(공개 런칭 게이트).

### G1 / E 그룹 (배포 후)
10. **phase1.spec 실행 대상은 staging** (`E2E_SUPABASE=1` + staging URL/키, `IDENTITY_VERIFIER=mock`, `NODE_ENV≠production`). staging Auth → Phone → Test phone numbers 에 `821000000011→000011`, `821000000012→000012` 등록(prod 에는 금지). 결과 `e2e/artifacts/phase1-*.png` → `docs/screenshots/`.
11. **`lib/env.ts` 분리 권장(비차단)**: 브라우저 클라이언트(`lib/supabase/client.ts`)가 `publicEnv()` 때문에 `lib/env.ts` 를 import 해 `serverSchema` 의 **키 이름**이 클라이언트 청크 4개에 포함된다(값 아님 — 더미 값 grep 0, CI `Bundle guard` 로 고정). `lib/env.public.ts` / `lib/env.server.ts`(server-only) 로 나누면 G2 §G3-9 의 "= 0" 을 만족한다. D2/E 소관.
12. E2E 스모크의 `/dev/*` 그룹은 프로덕션에서 404 라 `E2E_BASE_URL=<prod>` 로는 공개 화면·게이트 그룹만 의미가 있다. 프로덕션 스모크는 `DEPLOY_LOG.md` §7 curl 세트가 1차.

### Phase 2 선행조건 (F 그룹 착수 전, PRD §8)
13. 프로덕션 URL 2개 200 + Supabase prod 마이그레이션 25개 적용 + 실계정 2개 가입→인증→매칭→채팅 1회 스크린샷 + 수동 QA(신고 파이프라인·사진 검수→L3·마스킹/차단·07:00 배치·푸시 1건) + `DEPLOY_LOG.md` §9~10 기록. 이 중 하나라도 비면 `packages/game-engine` 은 스텁(현재 `src/index.ts` 1줄) 유지.
14. `pnpm audit` postcss 4건(빌드타임) — Next 패치 업데이트(`pnpm update next --filter @duckmate/company`) 를 Phase 2 첫 PR 에 포함(G2-15).

---

## 1. 워크플로

| 파일 | 트리거 | 시크릿 | 단계 | 실패/스킵 정책 |
|---|---|---|---|---|
| `deploy-duckmate-web.yml` | `push: master, paths: duckmate/**` + `workflow_dispatch` | `DM_WEB_VERCEL_TOKEN/ORG_ID/PROJECT_ID` | pnpm 10(`package_json_file`) → Node 22 → `pnpm install --frozen-lockfile` → `pnpm -r typecheck` → `pnpm -r test` → `check-legal-placeholders` → `vercel pull --environment=production` → `vercel build --prod` → 산출물 위치 확인 → `vercel deploy --prebuilt --prod` → URL job summary | 시크릿 없으면 `::warning` + skip(초록). `concurrency: vercel-duckmate-web` |
| `deploy-duckmate-company.yml` | 동일 | `DM_COMPANY_VERCEL_*` | 동일(정적 export) | 동일 |
| `duckmate-ci.yml` | `pull_request paths: duckmate/**` + dispatch | 없음(더미 env) | **checks**: typecheck · `e2e:typecheck` · vitest · `check:legal` · `check:copy` · company build · web build · 번들 값 가드 · `check:noindex --no-build`(70) · `npx playwright install --with-deps chromium` · `e2e:smoke`(46) · 실패 시 리포트 artifact. **db-test**: `postgres:16` 서비스 → `bash scripts/db-test.sh duckmate_ci` | 전부 차단(exit≠0 = 빨간 X). `check:legal` 만 경고 |
| `duckmate-supabase-migrate.yml` | `workflow_dispatch`(`dry_run`, `deploy_functions`) | `DM_SUPABASE_ACCESS_TOKEN/PROJECT_REF/DB_PASSWORD` | `supabase/setup-cli` → `link` → `migration list`(summary) → `db push [--dry-run]` → `functions deploy`(전체, `config.toml [functions.*]` 기준) → 후속 수동 단계 summary | 시크릿 없으면 skip. `secrets set`·`config push`·seed 미실행(의도) |

## 2. Vercel/Supabase 설정 판정

- **web** `vercel.json`: `framework: nextjs`, `installCommand: cd ../.. && pnpm install --frozen-lockfile`, `buildCommand: cd ../.. && pnpm --filter @duckmate/web build`. Root Directory `duckmate/apps/web`, Node 22 는 대시보드. headers/rewrites 없음(`next.config.ts headers()` 가 처리).
- **company** `vercel.json`: 같은 형태, `@duckmate/company`. Framework **Next.js**(정적 export 자동 감지, Output Directory 비움). "Other"+`out` 은 대안.
- **`.vercelignore`**: `.next*`, `out`, `node_modules`, `playwright-report`, `test-results`, `e2e/artifacts`, `*.tsbuildinfo`, `.env*`(로컬 `.env.example` 은 Vercel 이 읽지 않음).
- **`supabase/config.toml`**: 로컬 전용 확인 — `[auth.sms.test_otp]` 는 `supabase start/db reset` 과 `config push` 만 읽고, 워크플로는 `config push` 를 호출하지 않는다(주석 추가). `[functions.contact|toss-webhook|identity-webhook] verify_jwt = false` 추가(E5 §G3-4 가 G3 에 위임; G2 §G3-3 과 일치). `[db] major_version = 17` 은 신규 프로젝트 기본과 같다(로컬 검증은 PG 16.13).

## 3. 검증 결과 (2026-09-02)

| 명령 | exit | 소요 | 결과 |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | 1s | lockfile 정합 |
| `pnpm -r typecheck` | 0 | 8s | 5/5 |
| `pnpm -r test` | 0 | 7s | db 70 · web 268 |
| `pnpm --filter @duckmate/web e2e:typecheck` | 0 | 2s | |
| `node scripts/check-legal-placeholders.mjs` | 0 | <1s | 경고 4파일(의도) |
| `node scripts/check-copy.mjs` | 0 | 1s | 228 파일 위반 0 |
| `pnpm --filter @duckmate/company build` | 0 | 32s | 15 페이지 `out/` |
| `pnpm --filter @duckmate/web build`(더미 env) | 0 | 70s | 20 정적 페이지 |
| `NEXT_DIST_DIR=.next node scripts/check-noindex.mjs --no-build` | 0 | 3s | 70/70 |
| `pnpm --filter @duckmate/web e2e:smoke` | 0 | 97s | 46 passed |
| `bash scripts/db-test.sh`(root) / 비-root+libpq env | 0 / 0 | 5s / 2s | 마이그레이션 25, S1~S11 PASS — 단 로컬 클러스터는 롤이 이미 있어 셰임 순서 결함을 놓쳤다(아래 CI 실측) |
| **GitHub Actions `duckmate-ci.yml` PR #46** | run #1 db-test ✗ → run #3 **✓ 2/2** | checks 3m55s · db-test 24s | #1: 빈 postgres:16 에서 `realtime_shim` 이 `supabase_shim` 보다 먼저 적용돼 `role "anon" does not exist` → 오케스트레이터가 `db-test.sh` 셰임 순서 고정(`2707329`). #3(`9fbca77`): typecheck 16s · vitest 5s · company 24s · web 48s · noindex 2s · smoke 93s(46) · db-test S1~S11 PASS. 워크플로 파일 수정 불필요 |
| `pnpm audit --prod` | 1 | 1s | postcss 4건(G2-15 기지) |
| `npx vercel@latest build`(토큰 없음) | 1 | 3s | `project_settings_required` — `.vercel/project.json` 없음 |
| `npx supabase@latest migration list` | 1 | 2s | `LegacyProjectNotLinkedError` |
| `npx supabase@latest db lint` | 1 | 2s | `ECONNREFUSED 127.0.0.1:54322`(Docker 없음) |
| 워크플로 YAML 파싱(PyYAML) 4개 | 0 | — | 문법 OK |
| git 히스토리 비밀값 grep(`duckmate/`) | — | — | 0건, `.env*` 미추적 |

미실행(환경): 실제 Vercel 배포, Supabase `db push`/Edge 실행, SMS 실발송, Realtime/Storage 실동작, phase1.spec(실 Supabase), 배포 워크플로 3개(시크릿 부재 → 실행 시 warning skip 경로만 검증 가능). 전부 `DEPLOY_LOG.md` §3 체크리스트로 소유자에게 넘김.

교훈(재발 방지): 로컬 검증 환경이 "깨끗한 클러스터"가 아니면 초기화 순서 결함을 놓친다. 셰임·마이그레이션 순서 변경 시 반드시 `duckmate-ci.yml` db-test 잡(빈 `postgres:16`)으로 확인.

## 4. 게이트 판정

**Phase 1 게이트: 미통과.** 사유 = 프로덕션 URL 2개 없음(Vercel 프로젝트·토큰 부재), Supabase 프로덕션 없음(토큰·ref 부재), SMS 공급자 없음, 실계정 E2E/스크린샷 없음. 코드·테스트·파이프라인 측은 준비 완료(위 표). 상세 `docs/DEPLOY_LOG.md` §2, `docs/PHASE_REPORT_1.md` §2.
