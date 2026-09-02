# DEPLOY_LOG — 덕메이트(DuckMate)

> ## Phase 1 게이트 상태: **미통과 — 프로덕션 URL 없음**
>
> 기준일 2026-09-02 · 브랜치 `claude/duckmate-dating-app-npva8t` (HEAD `97713ac` 이후 미커밋 변경 포함) · 작성 G3.
> 이 세션(샌드박스)에는 Vercel 토큰·Supabase 액세스 토큰·프로젝트 ID·도메인이 **없다**. 그래서 실제 배포는 실행되지 않았고, (1) 소유자가 시크릿만 넣으면 그대로 돌아가는 파이프라인, (2) 로컬에서 가능한 사전 검증 전부 실행·기록, (3) 막힌 지점의 정확한 목록을 남긴다. **아래 어디에도 실제 URL 은 없다** — 배포 후 소유자가 §9 표에 채운다.

## 0. 한눈에

| 항목 | 상태 |
|---|---|
| 프로덕션 URL (web / company) | **없음** — Vercel 프로젝트 미생성 |
| Supabase 프로덕션 | **없음** — 프로젝트 미생성(마이그레이션 25개는 로컬 PG16 에서 전부 적용·테스트 통과) |
| 배포 파이프라인 | **완성** — GitHub Actions 4개(§4) + `vercel.json` 2개 + `.vercelignore` 2개 + `config.toml` `[functions.*]` |
| 로컬 사전 검증 | **12/12 통과**(§5). 토큰 필요 명령 3개는 예상대로 실패(사유 기록) |
| 막힌 원인 | 자격증명 9개 + 계정 4개 + 소유자 결정 10개(§2) |

## 1. 이번에 만든/바꾼 파일

| 파일 | 내용 |
|---|---|
| `/.github/workflows/deploy-duckmate-web.yml` | master `duckmate/**` push → typecheck·test·legal scan → `vercel pull/build/deploy --prebuilt --prod`. 시크릿 `DM_WEB_VERCEL_*` 없으면 warning skip |
| `/.github/workflows/deploy-duckmate-company.yml` | 동일 패턴, `DM_COMPANY_VERCEL_*`, 정적 export |
| `/.github/workflows/duckmate-ci.yml` | PR `duckmate/**` → typecheck·e2e typecheck·vitest·check:legal·check:copy·company build·web build(더미 env)·번들 값 가드·check:noindex(70)·Playwright 스모크(46) + `postgres:16` 서비스 컨테이너로 `scripts/db-test.sh`(셰임+마이그레이션 25+phase1_flow S1~S11) |
| `/.github/workflows/duckmate-supabase-migrate.yml` | 수동 전용. `DM_SUPABASE_*` → `supabase link` → `migration list` → `db push`(`dry_run` 입력) → `functions deploy`(전체). `secrets set`·`config push`·seed 는 하지 않음 |
| `apps/web/vercel.json` · `apps/company/vercel.json` | `framework: nextjs`, `installCommand: cd ../.. && pnpm install --frozen-lockfile`, `buildCommand: cd ../.. && pnpm --filter @duckmate/<app> build` |
| `apps/web/.vercelignore` · `apps/company/.vercelignore` | 산출물·리포트·env 제외 |
| `supabase/config.toml` | `[functions.contact|toss-webhook|identity-webhook] verify_jwt = false` 추가(E5 §G3-4 위임분) + `test_otp` 가 프로덕션에 가지 않는 경로 주석 |
| `docs/DEPLOY_LOG.md` · `docs/agents/G3_deploy.md` · `docs/PHASE_REPORT_1.md` | 이 문서·G3 결정사항·Phase 1 보고 |

다른 에이전트 코드(`scripts/check-*.mjs`, `apps/web/app/{sitemap,robots}.ts`, `next.config.ts`, 앱 소스)는 **수정하지 않았다**(검증만).

## 2. 막힌 이유 — 필요한 자격증명 · 계정 · 도메인

### 2.1 자격증명 (값은 절대 리포에 넣지 않는다)

| # | 항목 | 어디서 발급 | 어디에 넣나 | 없으면 |
|---|---|---|---|---|
| 1 | Vercel 개인/팀 토큰 | vercel.com → Account Settings → Tokens | GitHub Secrets `DM_WEB_VERCEL_TOKEN`, `DM_COMPANY_VERCEL_TOKEN`(같은 값 재사용 가능) | 배포 워크플로 2개가 `::warning` 후 skip |
| 2 | Vercel Org ID | `npx vercel link`(각 앱 폴더) → `.vercel/project.json` `orgId`, 또는 Team Settings | GitHub Secrets `DM_WEB_VERCEL_ORG_ID`, `DM_COMPANY_VERCEL_ORG_ID` | 위와 동일 |
| 3 | Vercel Project ID ×2 | 프로젝트 생성 후 Settings → General → Project ID | GitHub Secrets `DM_WEB_VERCEL_PROJECT_ID`, `DM_COMPANY_VERCEL_PROJECT_ID` | 위와 동일 |
| 4 | Supabase Access Token | supabase.com → Account → Access Tokens (`sbp_…`) | GitHub Secrets `DM_SUPABASE_ACCESS_TOKEN` (로컬 CLI 는 `SUPABASE_ACCESS_TOKEN` env) | 마이그레이션 워크플로 skip, `supabase link/db push/functions deploy` 불가 |
| 5 | Supabase Project Ref | Project Settings → General → Reference ID | GitHub Secrets `DM_SUPABASE_PROJECT_REF` | 위와 동일 |
| 6 | Supabase DB Password | 프로젝트 생성 시 지정(Settings → Database 에서 재설정) | GitHub Secrets `DM_SUPABASE_DB_PASSWORD` (로컬 `SUPABASE_DB_PASSWORD`) | `db push` 불가 |
| 7 | Supabase URL · anon key · service role key | Project Settings → API | **Vercel(web) env** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(server-only). E2E 스테이징은 `E2E_SUPABASE=1` + 같은 3키 | web 빌드는 되지만 런타임 전부 실패(로그인 불가) |
| 8 | 앱 서버 솔트/시크릿 6종 (`openssl rand -hex 32` 로 생성) | 소유자가 생성 | **Vercel(web) env** `AUTH_GATE_SECRET`, `PHONE_HASH_SALT`, `CONSENT_HASH_SALT`, `IDENTITY_CI_SALT`(**회전 금지**), `IDENTITY_MOCK_ALLOWLIST`(§3-8), `PAYMENTS_ENABLED=false`, `IDENTITY_VERIFIER=mock`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_COMPANY_URL` | `AUTH_GATE_SECRET` 없으면 service role 키가 HMAC 키로 재사용(G2-07); allowlist 비면 프로덕션 본인인증 전원 실패(설계) |
| 9 | Edge Function 시크릿 | `openssl rand -hex 32` ×5 + `node apps/web/lib/push/scripts/gen-vapid.mjs` | **Supabase Edge Functions → Secrets**: `PHOTO_REVIEW_WEBHOOK_SECRET`, `DAILY_RECO_WEBHOOK_SECRET`, `MODERATION_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET`, `CONTACT_IP_SALT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`(`mailto:` 또는 https 도메인). 선택 `RESEND_API_KEY`·`CONTACT_NOTIFY_EMAIL`·`CONTACT_FROM_EMAIL`, `FACE_API_URL/KEY`, `MODERATION_ALERT_WEBHOOK_URL`. web 에는 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`(같은 공개키) | `CONTACT_IP_SALT` 없으면 고정 문자열 사용(G2 필수), VAPID 없으면 푸시 기능 비노출, 웹훅 시크릿 없으면 해당 배치/웹훅 호출 거부 |

### 2.2 계정·계약 (소유자 명의)

| # | 항목 | 필요 이유 | 없으면 |
|---|---|---|---|
| A | Vercel 계정(+ 필요 시 Team) | 프로젝트 2개(web / company) | 프로덕션 URL 없음 |
| B | Supabase 계정 + 프로젝트 1개(권장 2개: prod + staging) | DB/Auth/Storage/Realtime/Edge. staging 은 G1 phase1 E2E(계정 삭제 헬퍼) 전용 | prod 없음 / E2E 를 prod 에 돌릴 수 없어 게이트의 "E2E 통과" 미달 |
| C | **SMS 공급자 계정** — Supabase Phone Auth 가 요구(Twilio · Twilio Verify · MessageBird · Textlocal · Vonage 중 택 1) | Phase 1 로그인 = 휴대폰 OTP 단일(PRD §0-19). 공급자 없이는 실 가입 불가 | 대시보드 "Test phone numbers" 로 소유자 번호만 임시 통과 가능(런칭 불가) |
| D | GitHub 리포 Secrets 쓰기 권한 | §2.1 #1~6 등록 | 워크플로 전부 skip |

### 2.3 소유자 결정 항목 (Phase 1 게이트 전 확정)

| 항목 | 현재 | 결정 필요 | 반영 위치 |
|---|---|---|---|
| 서비스명 | 가칭 "덕메이트" | 최종 명칭 | `apps/company/config/company.ts` `SERVICE_NAME`, `apps/web/public/manifest.webmanifest`, `apps/web/lib/push/templates.ts` `DEFAULT_SERVICE_NAME` |
| 도메인 2개 (web / company) | 미정 → Vercel 기본 `*.vercel.app` | 구매·DNS | Vercel Domains, `NEXT_PUBLIC_SITE_URL`·`NEXT_PUBLIC_COMPANY_URL`·`NEXT_PUBLIC_WEB_APP_URL`, Supabase Auth Site URL/Redirect, `company.ts` `DOMAIN` |
| 사업자 정보(상호·대표·사업자번호·통신판매업·주소·책임자 3인) | 플레이스홀더 `{{KEY}}`/`[TODO_사업자정보]` 노출(의도, 절대 규칙 4) | 법인/개인사업자 등록 | `apps/company/config/company.ts` 22 키. `check-legal-placeholders` 경고 0 이 되면 완료. Phase 3 결제 전 필수 |
| Supabase 리전 | 권장 **ap-northeast-2 (Seoul)** | 확정 | 프로젝트 생성 시 1회(변경 불가). `company.ts` `SUPABASE_REGION` 도 같은 값 |
| Supabase PG 버전 | `config.toml` `major_version = 17`, 로컬 검증은 PG 16.13 | 신규 프로젝트 기본(17) 그대로 | `supabase link` 가 불일치 경고만 냄 |
| SMS 공급자 | 미정 | Twilio 등 계약 + 발신번호 | Supabase Auth → Providers → Phone |
| 포트원(PASS/다날) 실 본인인증 | Phase 4 | 계약 시점 | `IDENTITY_VERIFIER=portone` + `PORTONE_*`. Phase 1 은 mock + allowlist(초대제) |
| Toss Payments | Phase 3 | 계약 시점 | `PAYMENTS_ENABLED` 는 그때까지 false |
| 시드 유저 500명(성비 5:5) | 미확보 | GTM 계획 | 공개 런칭 게이트(PRD §7). 확보 전엔 allowlist 베타 |
| 검수·신고 온콜 | 소유자 1인 | 운영 시간 | `admin_users` 시드(§3-7) + SLA 알림 메일 |
| 위치정보사업자 신고 여부 | 법무 판단 대기 | — | 약관 페이지는 게시됨 |
| 문의 폼 스팸 대책(Turnstile) | 미도입 | Phase 1 Should | `contact` Edge Function |

## 3. 소유자가 할 일 체크리스트 (순서 · 예상 시간 · 명령)

총 예상 3~4시간(SMS 공급자 계약·도메인 제외). 각 단계 끝에 이 문서 §9/§10 에 결과를 적는다.

- [ ] **1. Supabase 프로젝트 생성 (10분)** — supabase.com → New project → Region `ap-northeast-2`, DB password 저장(→ `DM_SUPABASE_DB_PASSWORD`). Settings → API 에서 URL·anon·service role 복사(→ Vercel env), General 에서 Reference ID(→ `DM_SUPABASE_PROJECT_REF`). Account → Access Tokens 발급(→ `DM_SUPABASE_ACCESS_TOKEN`).
- [ ] **2. DB push + Edge 배포 (10분)** — 둘 중 하나:
  - GitHub: Secrets 3개 등록 → Actions → "duckmate Supabase migrate (manual)" → `dry_run=true` 로 1회 확인 → `dry_run=false` 실행. job summary 에 마지막 마이그레이션(`20260902000070_security_fixes.sql`)이 찍히면 §10 표에 기록.
  - 로컬: `cd duckmate && SUPABASE_ACCESS_TOKEN=… SUPABASE_DB_PASSWORD=… npx supabase@latest link --project-ref <ref> && npx supabase@latest db push && npx supabase@latest functions deploy`
  - 확인: SQL Editor 에서 `select count(*) from supabase_migrations.schema_migrations` = 25, 사용자 JWT 로 `select public.is_matched(gen_random_uuid(), gen_random_uuid())` → 42501(G2 §3).
  - ⚠️ `supabase config push` 는 **실행 금지**(`[auth.sms.test_otp]` 가 프로덕션에 들어간다). seed.sql 도 프로덕션 미적용.
- [ ] **3. Auth 설정 (20분, SMS 공급자 계정 선행)** — Authentication → Providers → Phone: Enable + 공급자 자격증명. OTP length 6, OTP expiry ≤ 300s, SMS template `[덕메이트] 인증 코드 {{ .Code }} · 번호는 본인 확인용이며 프로필에 표시되지 않아요.`. Rate Limits: SMS 30/h 유지, sign-in/sign-up 30, token verifications 30(config.toml `[auth.rate_limit]` 와 동일). URL Configuration: Site URL = web 프로덕션 URL, Redirect URLs = 같은 URL 만. Email provider 비활성(`enable_signup=false`). Attack Protection → Captcha(Turnstile) 권장. **Test phone numbers 는 프로덕션에 넣지 않는다**(staging 프로젝트에만 `821000000011→000011`, `821000000012→000012`).
- [ ] **4. Realtime · Storage (10분)** — Realtime → Settings → **Private channels 활성**(`realtime.messages` RLS 적용 조건). Storage → 버킷 `photos`·`chat-images`·`evidence` 가 `public=false` 인지 확인(0012 가 만듦). Database → Webhooks: `storage.objects` INSERT → `https://<ref>.supabase.co/functions/v1/photo-review`, 헤더 `x-webhook-secret: <PHOTO_REVIEW_WEBHOOK_SECRET>`(G2 §G3-5).
- [ ] **5. Edge secrets (10분)** — 값 생성: `openssl rand -hex 32` ×5(`PHOTO_REVIEW_WEBHOOK_SECRET`, `DAILY_RECO_WEBHOOK_SECRET`, `MODERATION_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET`, `CONTACT_IP_SALT`), VAPID: `node apps/web/lib/push/scripts/gen-vapid.mjs` → `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:<운영 메일>`. 등록: 대시보드 Edge Functions → Secrets, 또는 `npx supabase@latest secrets set --env-file <로컬 파일>`(파일은 커밋 금지). 선택: `RESEND_API_KEY`+`CONTACT_NOTIFY_EMAIL`(문의 메일).
- [ ] **6. pg_cron · Vault · 푸시 스케줄 (10분)** — Database → Extensions: `pg_cron`, `pg_net` 활성. Vault → New secret `push_dispatch_secret` = `PUSH_DISPATCH_SECRET`. SQL Editor:
  ```sql
  insert into public.app_settings(key, value) values ('push_dispatch', jsonb_build_object('url', 'https://<ref>.supabase.co/functions/v1/push-dispatch'))
    on conflict (key) do update set value = excluded.value;
  select public.schedule_push_jobs();                                  -- push_* 6개
  select cron.schedule('dm_purge_rate_limits','20 18 * * *',$$select public.purge_rate_limits()$$);  -- 0070 이 이미 등록했으면 생략
  select jobname, schedule from cron.job order by 1;                   -- push_* 6 + reco/purge/sla 등 D3·D5·D7 잡 확인
  select public.invoke_push_dispatch();                                -- {invoked:true} 또는 QUEUE_EMPTY
  ```
  (20_notifications.md §G3-20, G2 §G3-7. D3 `reco_generate` 06:50 KST·D7 `purge_daily` 등도 각 마이그레이션이 pg_cron 가드로 등록 — `cron.job` 목록으로 전부 확인.)
- [ ] **7. admin 시드 (5분, 소유자 계정 첫 로그인 후)** — web 에서 소유자 번호로 OTP 로그인 1회 → `auth.users.id` 확보 → SQL Editor(21_admin.md §18):
  ```sql
  insert into public.admin_users (user_id, role, note) values ('<auth.users.id>', 'admin', '소유자') on conflict (user_id) do update set role = excluded.role;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}' where id = '<auth.users.id>';
  ```
- [ ] **8. mock allowlist (5분)** — 초대 번호(E.164 숫자만)마다 `printf '8210XXXXXXXX' | sha256sum | cut -d' ' -f1` → 쉼표로 이어 Vercel env `IDENTITY_MOCK_ALLOWLIST`(15_auth.md §5). 소유자 + 테스트 계정 1개 = 최소 2개(게이트 "실계정 2개").
- [ ] **9. Vercel 프로젝트 2개 (30분)** — Add New → Project → 리포 `dydrms6388-sudo/project-hub` import:
  - web: Root Directory `duckmate/apps/web`, Framework Next.js, Node 22.x, "Include source files outside of the Root Directory" ON, Install/Build 은 비워 둠(`vercel.json` 이 지정). Env(Production): §2.1 #7·#8 + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. **Git 자동배포 OFF**(Settings → Git → Ignored Build Step 또는 연결 해제) — 워크플로와 이중 배포 방지.
  - company: Root Directory `duckmate/apps/company`, Framework Next.js(정적 export 자동 감지, Output Directory 비움), Node 22.x. Env: `NEXT_PUBLIC_COMPANY_URL`, `NEXT_PUBLIC_WEB_APP_URL`, `NEXT_PUBLIC_CONTACT_ENDPOINT=https://<ref>.supabase.co/functions/v1/contact`.
  - 각 프로젝트 Settings → General → Project ID, Team/Account ID 복사.
- [ ] **10. GitHub Secrets (5분)** — 리포 Settings → Secrets and variables → Actions: `DM_WEB_VERCEL_TOKEN`, `DM_WEB_VERCEL_ORG_ID`, `DM_WEB_VERCEL_PROJECT_ID`, `DM_COMPANY_VERCEL_TOKEN`, `DM_COMPANY_VERCEL_ORG_ID`, `DM_COMPANY_VERCEL_PROJECT_ID` (+ 2단계의 `DM_SUPABASE_*` 3개).
- [ ] **11. master 머지 → 배포 (10분)** — PR #46 의 `duckmate CI` 가 초록인지 확인 → 머지 → Actions 에서 "Deploy duckmate web/company (production)" 2개가 돌고 job summary 에 URL 이 찍힌다(또는 `workflow_dispatch` 로 수동 실행). URL 을 §9 에 기록.
- [ ] **12. URL 회귀 반영 (10분)** — 실제 URL 로 Vercel env `NEXT_PUBLIC_SITE_URL`·`NEXT_PUBLIC_COMPANY_URL`(web), `NEXT_PUBLIC_COMPANY_URL`·`NEXT_PUBLIC_WEB_APP_URL`(company), Supabase Auth Site URL/Redirect 갱신 → 워크플로 재실행(`workflow_dispatch`).
- [ ] **13. 배포 후 스모크 (10분)** — §7 명령 전부 통과.
- [ ] **14. G1 phase1 E2E — 스테이징 대상 (30분)** — prod 에는 **절대 돌리지 않는다**(헬퍼가 auth 유저를 삭제). staging Supabase 프로젝트(2단계와 같은 방법으로 push, Test phone numbers 2개 등록) + 로컬 `next dev`(또는 Vercel preview 를 `E2E_BASE_URL` 로): `cd duckmate/apps/web && E2E_SUPABASE=1 NEXT_PUBLIC_SUPABASE_URL=<staging> NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… IDENTITY_VERIFIER=mock NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 pnpm e2e:phase1`. 결과 `e2e/artifacts/phase1-*.png` 를 `docs/screenshots/` 로 복사.
- [ ] **15. 수동 QA (PRD §8, 60분)** — 실계정 2개(allowlist)로 가입→인증→매칭→채팅 1회, 신고 1건→어드민 큐→판정→통보, 사진 업로드→검수 승인→L3→데이팅 모드, 전화번호 마스킹·차단 양방향, 07:00 배치 로그 1회(`cron.job_run_details`), 푸시 1건 수신(`push-send` → `notification_log.opened_at`). 스크린샷을 `docs/screenshots/prod-*.png` 로 저장하고 §9 에 링크.
- [ ] **16. 게이트 통과 선언** — §0 표와 이 문서 최상단 상태를 갱신(`PHASE_REPORT_1.md` §2 도), 적용 마이그레이션 버전 §10 기록.

## 4. 파이프라인 설명

```
PR(duckmate/**) ──▶ duckmate-ci.yml ── checks(typecheck·test·builds·gates·smoke) + db-test(postgres:16)
                                          │
master push ───────▶ deploy-duckmate-web.yml ──▶ vercel pull → build → deploy --prebuilt --prod ──▶ web URL (job summary)
              └────▶ deploy-duckmate-company.yml ──▶ 동일 ──▶ company URL
workflow_dispatch ─▶ duckmate-supabase-migrate.yml ──▶ supabase link → migration list → db push → functions deploy
```

- 배포 워크플로는 **저장소 루트**에서 `vercel` 을 실행한다(isitnormal 패턴). `vercel pull` 이 Root Directory 를 포함한 프로젝트 설정과 Production env 를 `.vercel/` 에 내려받고, `vercel build --prod` 가 `duckmate/apps/<app>/vercel.json` 의 install/build 명령을 그 폴더에서 실행하며, 산출물 `.vercel/output` 을 `vercel deploy --prebuilt` 가 올린다. 앱 env 는 Vercel 프로젝트에만 두고 GitHub Secrets 에 복제하지 않는다.
- 시크릿이 하나라도 비면 `::warning` + job summary 한 줄 남기고 성공 종료(빨간 X 없음).
- CI 의 web 빌드·스모크는 `scripts/lib/dummy-env.mjs` 와 같은 더미 값(실 접속 없음). `check:noindex` 는 빌드 재사용(`--no-build`, `NEXT_DIST_DIR=.next`), 스모크는 `.next-e2e`·포트 3100 으로 분리(27_fe_quality §G1-2).
- DB 테스트 잡은 `postgres:16` 서비스 컨테이너 + libpq env(`PGHOST/PGUSER/PGPASSWORD`). `scripts/db-test.sh` 는 비-root 이면 `psql` 을 그대로 쓰므로 수정 없이 동작(§5 에서 비-root 경로를 실제로 재현).
- Supabase 워크플로는 `config.toml` 의 `env(SITE_URL)`·`env(TWILIO_*)` 참조가 파싱되도록 더미 값을 env 로만 넣고, `config push` 는 하지 않는다.

## 5. 로컬 사전 검증 결과 (2026-09-02, 샌드박스: Node 22.22.2 · pnpm 10.33.0 · PG 16.13 · chromium-1194)

| # | 명령 (cwd=`duckmate`) | exit | 소요 | 결과 |
|---|---|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | 0 | 1s | "Lockfile is up to date" — lockfile 정합, 갱신 불필요 |
| 2 | `pnpm -r typecheck` | 0 | 8s | 5/5 (game-engine·db·ui·company·web) |
| 3 | `pnpm -r test` | 0 | 7s | db 70 · web 268 (22 파일) 통과 |
| 4 | `pnpm --filter @duckmate/web e2e:typecheck` | 0 | 2s | 통과 |
| 5 | `node scripts/check-legal-placeholders.mjs` | 0 | <1s | 경고 4파일(community-guidelines·location·privacy·refund-policy `{{KEY}}`) — 의도된 플레이스홀더, 차단 아님 |
| 6 | `node scripts/check-copy.mjs` | 0 | 1s | 228 파일 위반 0 |
| 7 | `pnpm --filter @duckmate/company build` | 0 | 32s | 15 페이지 정적 생성, `out/` (index·legal/5·contact·404·sitemap·robots) |
| 8 | `pnpm --filter @duckmate/web build` (더미 env) | 0 | 70s | 20 정적 페이지, First Load JS 공통 103KB |
| 9 | `NEXT_DIST_DIR=.next node scripts/check-noindex.mjs --no-build --port 3017` | 0 | 3s | **70/70** (web 라우트 + company out/) |
| 10 | `pnpm --filter @duckmate/web e2e:smoke` | 0 | 97s | **46 passed** |
| 11 | `bash scripts/db-test.sh duckmate_g3` (root → `su postgres`) | 0 | 5s | 셰임 2 → 마이그레이션 **25** → seed → phase1_flow S1~S11 PASS |
| 12 | `bash scripts/db-test.sh` **비-root(nobody) + `PGHOST/PGUSER/PGPASSWORD`** — CI 경로 재현 | 0 | 2s | 동일 PASS (`duckmate-ci.yml` db-test 잡과 같은 조건) |
| 13 | `pnpm audit --prod` | 1 | 1s | postcss 4건(high 2·moderate 2, `apps/company>next>postcss`, 빌드타임) — G2-15 기지, Next 패치 업데이트로 해소 |
| 14 | `npx vercel@latest build` (apps/web, 토큰·링크 없음) | **1** | 3s | `project_settings_required: No project settings found locally. Run pull…` — `.vercel/project.json` 없음. 우회하지 않음(토큰 필요) |
| 15 | `npx supabase@latest migration list` (v2.116.0) | **1** | 2s | `LegacyProjectNotLinkedError: Cannot find project ref. Have you run supabase link?` — 액세스 토큰·ref 필요 |
| 16 | `npx supabase@latest db lint` | **1** | 2s | `ECONNREFUSED 127.0.0.1:54322 … Make sure Docker is running` — 로컬 Supabase 스택(Docker) 없음 |

관찰:
1. **클라이언트 번들에 서버 env *키 이름* 이 포함된다(값 아님).** `grep -rlE "SUPABASE_SERVICE_ROLE_KEY|service_role|IDENTITY_CI_SALT|PHONE_HASH_SALT|AUTH_GATE_SECRET|VAPID_PRIVATE" apps/web/.next/static` = 4 파일(`chunks/917-*.js`, `chunks/3839-*.js`, `(app)/me/photos`, `(onboarding)/…/photos`). 내용은 `lib/env.ts` 의 zod `serverSchema` 키 목록(`SUPABASE_SERVICE_ROLE_KEY:a.Yj().min(20),…`) — `lib/supabase/client.ts`(브라우저 클라이언트)가 `publicEnv()` 를 쓰려고 같은 모듈을 import 해 스키마 정의가 딸려온 것. Next 는 `NEXT_PUBLIC_*` 만 인라인하므로 **값은 노출되지 않는다**(더미 값 grep 0 → CI `Bundle guard` 단계로 고정). G2 §G3-9 의 "= 0" 기대와 어긋나므로 기록: `lib/env.ts` 를 public/server 두 파일로 나누면 0 이 된다(E/D 소관, 동작 변경 없음, 비차단).
2. `git log -p --all -- duckmate` 에 JWT·`sk_live`·`sbp_`·`whsec_`·PRIVATE KEY 패턴 0건, 추적 중인 `.env*` 없음(`.env.example` 만).
3. `config.toml` `[db] major_version = 17` vs 로컬 검증 PG 16.13 — 신규 Supabase 프로젝트는 PG 17 이므로 실 적용은 17 에서 처음 이루어진다. 마이그레이션에 버전 의존 구문은 없으나 `db push` 후 §3-2 재검증 SQL 을 반드시 실행.
4. 샌드박스 프록시가 npm·GitHub 만 허용해 Pretendard CDN 등 외부 요청은 스모크에서 차단됨(앱이 흡수, 27_fe_quality 와 동일 조건).

## 6. 알려진 함정 · 판정

| 주제 | 판정 · 근거 |
|---|---|
| Vercel Install/Build 명령 위치 | `vercel.json`(앱 폴더)에 명시. Vercel 이 pnpm 워크스페이스를 자동 감지하기도 하지만 `cd ../..` 로 루트 install 을 고정해 CLI(`vercel build`)와 대시보드 빌드가 같은 명령을 쓰게 했다. 대시보드 Install/Build 필드는 비워 둔다(둘 다 있으면 `vercel.json` 우선). Node 22 는 `vercel.json` 으로 지정 불가 → 대시보드 Settings → General → Node.js Version |
| company Framework | **Next.js 프리셋**(정적 export 자동 감지). "Other"+Output `out` 도 가능하나 Next 프리셋이 `output: "export"` 를 공식 지원(26_fe_company §G3-1 의 Output=out 은 Other 일 때만 필요) |
| `vercel build` 산출물 위치 | 루트 실행 시 `.vercel/output` 은 루트에 생긴다. CLI 버전에 따라 Root Directory 안에 생기는 회귀가 있었으므로 워크플로에 "Locate prebuilt output" 단계를 두어 위치가 다르면 명확한 오류로 멈춘다(그 경우 `vercel deploy --prebuilt` 를 `duckmate/apps/<app>` 에서 실행하도록 `working-directory` 만 바꾸면 된다) |
| pnpm 버전 | `pnpm/action-setup@v4` + `package_json_file: duckmate/package.json` → `packageManager: pnpm@10.33.0` 그대로(루트 `package.json` 과 무관) |
| Playwright 브라우저 | CI 는 `/opt/pw-browsers` 가 없어 `playwright.config.ts findChromium()` 이 undefined → `npx playwright install --with-deps chromium`(apps/web) 으로 설치한 기본 브라우저 사용 |
| `supabase functions deploy` 전체 | `config.toml [functions.*] verify_jwt=false` 3개(contact·toss-webhook·identity-webhook)를 읽는다. `push-dispatch` 의 `../push-send/lib` 상대 import 는 CLI 가 함께 번들 |
| Vercel Git 자동배포 | 워크플로와 동시 활성 시 같은 push 에 2번 배포(DEPLOY-CHECKLIST.md 1-2) → 하나만 |
| preview 배포 | `VERCEL_ENV≠production` 이면 web 은 `X-Robots-Tag` 전체 noindex, company 는 메타 noindex(자동) |

## 7. 배포 후 스모크 (curl, URL 확보 후)

```bash
WEB=https://<web-url>; CO=https://<company-url>
# 보안 헤더 5종 (G2 §G3-10)
curl -sI $WEB/ | grep -iE "^(x-frame-options|content-security-policy|x-content-type-options|referrer-policy|permissions-policy):"   # 5줄
# 게이트 + noindex 헤더 (27 §G3-13)
curl -sI $WEB/home | grep -iE "^(HTTP|location|x-robots-tag)"        # 307, /login?next=%2Fhome, noindex, nofollow
curl -s $WEB/robots.txt | grep -c Disallow                            # 25
curl -s $WEB/sitemap.xml | grep -c '<loc>'                            # 10
curl -s -o /dev/null -w '%{http_code}\n' $WEB/legal/terms             # 200
curl -s -o /dev/null -w '%{http_code}\n' $WEB/admin                   # 404
curl -s -o /dev/null -w '%{http_code}\n' $WEB/api/health              # 200
curl -s -A Googlebot $WEB/ | head -c 3000 | grep -o '<title>[^<]*'    # <title> 이 <body> 앞(27 §G3-21)
# company
curl -sI $CO/ | grep -i x-robots-tag                                  # (없어야 함)
curl -s $CO/ | grep -o '<meta name="robots" content="[^"]*"'         # index, follow
curl -s -o /dev/null -w '%{http_code}\n' $CO/legal/terms/             # 200
curl -s $CO/sitemap.xml | grep -c '<loc>'                             # 7
# Edge
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<ref>.supabase.co/functions/v1/contact -H 'content-type: application/json' -d '{"email":null,"type":"other","body":"smoke","honeypot":""}'   # 200
```
추가: Lighthouse(27 §G3-14) 7 URL, G2 §3 재검증 SQL, `pnpm --filter @duckmate/web e2e:smoke` 를 `E2E_BASE_URL=$WEB` 로(공개 화면·게이트 그룹만 의미 있음, `/dev/*` 그룹은 프로덕션 404 → 실패 예상).

## 8. 롤백

1. **Vercel 즉시 롤백**: 프로젝트 → Deployments → 직전 정상 배포 → "Promote to Production"(초 단위). web/company 각각.
2. **Git 되돌리기**: `git revert <sha> && git push origin master` → 배포 워크플로 재실행. 또는 Actions → 워크플로 → `workflow_dispatch` 로 특정 커밋 재배포.
3. **DB**: `supabase db push` 는 롤백 명령이 없다. 되돌리려면 역방향 마이그레이션 파일을 추가해 다시 push(14_schema.md §5: `supabase migration new <name>`, 타임스탬프 `20260902000070` 이후). 데이터 파괴 변경 전에는 대시보드 Database → Backups(PITR/일일 백업) 확인.
4. **Edge Function**: `supabase functions deploy <name>` 으로 이전 커밋 체크아웃 후 재배포.
5. 롤백 후 §7 스모크 재실행, §10 표에 기록.

## 9. 스크린샷

기존(로컬 목 라우트·정적 서빙, 각 `docs/agents/22~26` 산출) — `docs/screenshots/`:
`company-home.png` · `company-legal.png` · `company-contact.png` · `web-landing.png` · `web-login.png` · `web-onboarding-age.png` · `web-onboarding-phone.png` · `web-blocked-age.png` · `web-home.png` · `web-reco.png` · `web-reco-sheet.png` · `web-reco-done.png` · `web-match.png` · `web-match-safety.png` · `web-chat-list.png` · `web-chat-room.png` · `web-chat-room-empty.png` · `web-chat-room-sent.png` · `web-chat-room-ended.png` · `web-settings.png` · `web-legal.png` · `web-account-delete.png` (22장). 스모크 산출 `apps/web/e2e/artifacts/smoke-*.png`(gitignore).

프로덕션 스크린샷(게이트 필수, 미확보): `docs/screenshots/prod-signup-A.png`, `prod-verify-A.png`, `prod-match.png`, `prod-chat-first-message.png`, `prod-chat-received-B.png`, `prod-report-admin-queue.png`, `prod-photo-approved-L3.png` — §3-15 에서 채운다.

| 프로덕션 URL | 값 |
|---|---|
| web | (미배포) |
| company | (미배포) |
| Supabase ref | (미생성) |

## 10. 배포 기록 (배포마다 추가)

| 일시(KST) | 대상 | 커밋 | 마지막 마이그레이션 | 결과 · 비고 |
|---|---|---|---|---|
| 2026-09-02 | (없음 — 파이프라인·사전 검증만) | `97713ac`+미커밋 | 로컬 PG16: `20260902000070_security_fixes.sql`(25/25) | 프로덕션 미적용. 시크릿·계정 부재(§2) |
