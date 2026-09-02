# 21 — 어드민 대시보드 (D8)

> 입력: `14_schema.md`(app_role·admin_users·audit_logs·reports/sanctions/photos), `15_auth.md`((admin) 게이트·requireGate·ActionResult), `11_design_system.md`, `05_trust_safety.md`(§4·§6·§8), `12_flows.md`((admin) 라우트·noindex), `03_core_loop.md` §8, `06_PRD.md` §6 KPI·§4.9 어드민 수용 기준, D5 `0043_admin_functions.sql`·`lib/moderation/admin.ts`(시그니처 대조).
> 산출물: `supabase/migrations/20260902000060_admin_metrics.sql`, `apps/web/app/(admin)/**`, `apps/web/lib/admin/**`, 이 문서. 기준일 2026-09-02. **git commit 없음**(오케스트레이터 WIP 스냅샷에 포함됨).

## 다음 에이전트에게 넘기는 결정사항

### 오케스트레이터 / D5 통합
1. **쓰기 경로 = D5 `admin_*` RPC 우선, 미존재(PGRST202) 시 D8 폴백.** `lib/admin/api.ts` 어댑터가 `0043_admin_functions.sql` 실제 시그니처(§5 대조표)로 호출한다. 0043 이 적용된 환경에서는 폴백(`actions.ts` `*Fallback`, audit `meta.fallback=true`)이 절대 실행되지 않는다. 통합 후 폴백을 **제거할지 유지할지**(로컬/스테이징에서 0043 없이 UI 를 돌릴 일이 없으면 제거 권장)는 오케스트레이터 결정.
2. **읽기 경로는 D8 직접 조회**(`lib/admin/queries.ts`, service role, 0001~0014 테이블만). D5 `admin_list_reports/admin_get_report/admin_search_profiles/admin_profile_detail` 은 쓰지 않는다 — 이유: (a) `admin_get_report` 가 SQL 안에서 `evidence_viewed` 를 기록하는데 D8 도 기록하므로 둘 다 쓰면 중복, (b) 큐 화면에 필요한 dedupe 카운트·서명 URL·페이지네이션(offset) 형태가 다름. **증거 열람 audit 는 D8 `getReportDetail()` 이 1회 기록**한다(D5 RPC 를 쓰기로 바꾸면 D8 기록을 지울 것).
3. **`lib/moderation/admin.ts` 래퍼를 D8 이 import 하지 않은 이유**: 래퍼 내부 `requireAdmin()` 이 실패 시 `redirect()` 를 던져 서버 액션의 `ActionResult` 계약(15_auth §0-1)을 깨뜨린다. D8 은 `requireAdminAction()`(FORBIDDEN 반환) 뒤 같은 RPC 를 `p_actor_id` 로 직접 호출한다. D5 가 래퍼에서 `requireAdmin` 호출을 분리하면(순수 RPC 래퍼) D8 어댑터를 그쪽으로 교체 가능.
4. **제재 권한 매트릭스는 0043 과 동일하게 맞췄다**: moderator = 발급·해제 level ≤3, admin = 1~6·이의신청·legal_hold·강제 로그아웃·삭제 예약. TS 순수 함수 `lib/admin/permissions.ts` + SQL(0043 `assert_*`, 0009 `issue_sanction` issued_by) **이중 강제**. PRD §0-47 의 "해제는 admin" 문구보다 0043 이 우선(D5 결정 존중).
5. **`issue_sanction`(0009) 를 service role 로 부르면 `audit_logs.actor_role` 이 null** 이 된다(`app_role()` 이 JWT 없음). D8 유저 화면의 "제재 발행" 은 이 함수를 직접 쓰므로 actor_role 이 비어 있음(actor_id 는 있음). **D1/D5 패치 요청**: `issue_sanction` 안의 `public.app_role()` 을 `coalesce(public.app_role(), (select role::text from admin_users where user_id = p_issued_by), 'service')` 로. (0043 `admin_audit` 는 이미 이렇게 한다.)
6. **`Database["public"]["Functions"]` 에 D8 0060 함수·D5 0043 함수가 없다.** D8 은 `adminRpc()`(느슨한 타입 캐스트) 로 호출. D1/오케스트레이터가 `packages/db/src/types.ts` 에 아래 9개를 추가하면 `api.ts` 의 캐스트를 제거할 수 있다: `admin_queue_summary()`, `admin_metrics_active_users()`, `admin_metrics_daily(p_days)`, `admin_metrics_funnel(p_days)`, `admin_metrics_verify_levels()`, `admin_metrics_gender()`, `admin_metrics_sla(p_days)`, `admin_metrics_sanctions(p_days)`, `admin_metrics_photos(p_days)`.
7. **강제 로그아웃 = Auth admin `updateUserById(id, { ban_duration })`**(5m/1h/24h 선택, 기본 1h). auth-js 2.112 의 `admin.signOut(jwt)` 는 대상 사용자 JWT 가 필요해 타인에게 못 쓴다. `banned_until` 동안 GoTrue 가 `/user` 검증·리프레시를 거부하므로 서버 게이트(`getUser`)가 즉시 세션을 끊는다(액세스 토큰 자체 만료는 최대 1h). 기간 후 자동 해제. E5/G3: 로그인 화면에서 `banned` 에러 문구("잠시 후 다시 시도") 처리 필요.
8. **계정 삭제 예약**은 `request_delete` RPC(본인 세션 전용)를 못 쓰므로 service role 로 `profiles.status='deleting', delete_requested_at=now()` 직접 갱신 + audit. 실제 삭제는 D7 `purge_daily`(7일). `banned` 계정은 제재 해제 후에만 예약 가능(영구정지 증거 보존 5년과 충돌 방지).
9. **영구정지(level 6) 해제 폴백**은 `profiles.status='active'` 복구까지만 하고 `blocked_ci_hashes` 는 유지한다(재가입 차단 해제는 별도 수동 검토). 0043 `admin_lift_sanction` 의 동작과 대조 필요 — D5 가 CI 블록도 푸는지 확인 후 문서 통일.
10. **사진 검수 결과 8개 = 반려 코드 7(enum `photo_reject_code`) + `held`.** A5 §8 표는 8행(approved 제외)이고 PRD F-009 의 "9코드" 는 approved 포함 표기다. 자동 반려 없음. 승인/반려/held 모두 트리거 `trg_photos_recompute_level` 이 `recompute_verify_level` 을 호출해 L3 승격/강등(+dating→friend 복귀)을 처리함을 로컬에서 확인(§7).

### G2 (보안 리뷰 포인트)
11. **2중 게이트**: ① `middleware.ts` `classifyRoute` → `{kind:"admin"}` → `evaluateGate` 가 `state.role ∉ {admin,moderator}` 이면 `FORBIDDEN` → `NextResponse.rewrite("/404")`(존재 비노출). 세션 없음도 `/404`(gate.test "① no session: /admin/photos → /404"). 캐시 쿠키(60s) 위·변조 대비 ② `(admin)/layout.tsx` → `requireAdminPage()` 가 매 요청 `auth.getUser()` + **사용자 JWT 클라이언트로 `app_role()` RPC**(DB 재조회: JWT app_metadata.role 우선, 없으면 admin_users) → 실패 시 `notFound()`(진짜 404 status, 리다이렉트 없음). 서버 액션은 ③ `requireAdminAction()` 이 같은 판정 + 액션별 최소 역할 + 제재 레벨 한도.
12. **service role 경로**: `createAdminClient()` 는 `lib/admin/auth.ts getAdminContext()` 안에서만 생성되어 `AdminContext.admin` 으로 전달된다(호출자 검증 뒤에만 존재). `lib/admin/{api,queries,auth}.ts` 는 `server-only`. `"use client"` 파일(`ConfirmActionDialog`, `EvidenceViewer`, `ReportActions`, `PhotoReviewGrid`)은 `constants/permissions/format/types` 만 import(grep 0건 확인).
13. **IDOR**: 모든 상세 라우트 `[id]` 는 uuid 검증 후 service role 로 조회하지만, 조회 자체가 관리자 전용 화면(11 의 3중 게이트) 뒤에 있다. 대상 프로필/신고 존재 여부만으로 정보가 새지 않도록 미존재는 `notFound()`. 액션 입력은 zod(uuid·enum·길이) 검증. 자기 자신에 대한 강제 로그아웃·삭제 예약은 거부.
14. **증거 열람**: `getReportDetail()` 이 `audit_logs(evidence_viewed, meta{messages, photos, target_id})` 를 매 열람마다 기록. 원문 메시지는 화면 렌더만(복사/다운로드/export 버튼 없음), 기본 마스킹 표시 + 토글. 서명 URL 10분(`SIGNED_URL_TTL_SEC`), evidence 버킷 우선 → 없으면 photos 원본. **개인정보 최소화**: 유저 상세는 `birth_year` 만(생년월일 원문 미표시), `phone_hash` 12자 프리픽스, CI/DI 해시·identity meta 미조회(select 컬럼 제외).
15. **전화번호 검색**: 관리자가 번호를 입력하면 서버가 `phoneHash()`(D2 `PHONE_HASH_SALT`)로 해시해 `profiles.phone_hash` 와 비교. 원문 번호는 로그·audit·URL 에 남기지 않도록 **GET 쿼리 `q` 에 번호가 들어가는 점은 주의**(브라우저 히스토리·서버 로그). G2 가 문제 삼으면 검색 폼을 POST 액션으로 바꾼다.
16. **noindex**: `(admin)/layout.tsx` `metadata.robots = {index:false, follow:false, nocache:true, googleBot:{…}}` → `<meta name="robots" content="noindex, nofollow, nocache">`. `robots.txt` Disallow `/admin` 은 E6.
17. **강제 로그아웃·비노출·삭제 예약**은 RPC 밖 액션이므로 D8 이 `writeAudit()` 로 직접 기록(action: `force_logout` / `profile_hidden` / `profile_unhidden` / `account_delete_scheduled` / `account_delete_canceled`). RPC 가 기록하는 액션(triage/resolve/review/lift/appeal)은 D8 이 **기록하지 않는다**(중복 금지) — 폴백 경로만 `report_triaged/report_resolved/photo_reviewed/sanction_lifted/appeal_decided` 를 기록.

### G3 (배포)
18. **admin_users 시드 + JWT role 부여(둘 다 필요, D1 §0-4)**:
    ```sql
    -- 1) 레지스트리 (service role / SQL editor)
    insert into public.admin_users (user_id, role, note) values ('<auth.users.id>', 'admin', '소유자') on conflict (user_id) do update set role = excluded.role;
    -- 2) JWT 경로 (app_metadata.role) — SQL 로 직접
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}' where id = '<auth.users.id>';
    -- 또는 supabase-js: await admin.auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })
    ```
    JWT 는 다음 리프레시(≤1h) 후 반영되고, 그 전에도 `app_role()` 이 admin_users 를 폴백으로 보므로 즉시 접근 가능. **회수는 두 곳 모두**(admin_users delete + `app_metadata.role` 제거) — 하나만 지우면 다른 경로로 계속 통과한다. 유저 상세 화면이 `admin_users.role` 과 `app_metadata.role` 불일치를 배지로 경고한다.
19. 마이그레이션 `0060` 은 0001~0014 에만 의존(테이블 변경 없음, 함수 10개). `supabase db push` 순서상 0043 보다 뒤지만 독립.
20. 프로덕션 env 추가 없음. `SUPABASE_SERVICE_ROLE_KEY`·`PHONE_HASH_SALT`(전화 검색용) 는 D2 것 그대로.
21. SLA 초과 알림(A5 §6 이메일/Slack)은 D5 `sla_check()`/`notify_admin` 이 담당. D8 은 상단 배너(`admin_queue_summary().reports_overdue_p0_p2`)만.

### E 그룹
22. **CSS**: `globals.css` 가 아직 `@duckmate/ui/styles.css` 를 import 하지 않아 `(admin)/admin.css` 가 `@import "@duckmate/ui/styles.css"; @source "../../../../packages/ui/src"; @source "./"; @source "../../lib/admin";` 를 갖고 layout 이 import 한다. E 그룹이 globals.css 를 11_design_system §0-2 대로 교체하면 `admin.css` 는 `@source "./"` 한 줄만 남기거나 삭제(중복 preflight 제거). 빌드는 현재 구성으로 통과(§7).
23. E6 noindex 검사 대상: `apps/web/app/(admin)/layout.tsx` 의 `metadata.robots`.
24. 어드민은 데스크톱 우선(사이드바 240px 고정, 표 `overflow-x-auto`). 모바일 대응·다크모드 토글 없음(OS 설정 따름).

### D7
25. `audit_logs` 보존 2년(D1 §0-30) 대비 A5 §11.1 표는 1년 — 어느 쪽이든 D8 은 무관. `analytics_events(app_opened)` 가 쌓이기 전에는 `/admin/metrics` 의 "활성(이벤트)"·"신고/활성유저" 가 0/— 로 표시된다(E5 `track()` 도입 후 채워짐).

---

## 1. 파일 구성

| 경로 | 내용 |
|---|---|
| `supabase/migrations/20260902000060_admin_metrics.sql` | `admin_metrics_guard()` + 지표 함수 9개 (§4). service_role / is_moderator() 만 실행, anon·public 회수 |
| `apps/web/lib/admin/constants.ts` | 역할·액션 최소 권한표, RPC 이름, 검수 결과 8개, 라벨, KPI 목표, 페이지 크기 |
| `apps/web/lib/admin/permissions.ts` | 권한 순수 함수(`canPerform`, `canIssueSanctionLevel`, `canLiftSanctionLevel`, `allowedSanctionLevels`, `isPriorityUpgrade`) |
| `apps/web/lib/admin/metrics.ts` | KPI 계산 TS 미러(§4 정의) |
| `apps/web/lib/admin/format.ts` | KST 날짜·기간·id 포맷 |
| `apps/web/lib/admin/types.ts` | 화면·액션 타입 |
| `apps/web/lib/admin/auth.ts` | `getAdminContext`(세션 + `app_role()` 재조회) · `requireAdminPage`(404) · `requireAdminAction`(FORBIDDEN) — server-only |
| `apps/web/lib/admin/api.ts` | `adminRpc()`(PGRST202 → `AdminRpcMissingError`), D5 어댑터 `d5.*`, 지표 `metricsRpc.*`, `writeAudit`, `signedUrl` — server-only |
| `apps/web/lib/admin/queries.ts` | 신고 큐/상세(+evidence_viewed audit)·사진 큐·유저 검색/상세·감사로그·지표 번들 — server-only |
| `apps/web/lib/admin/actions.ts` | `"use server"` 액션 11개(§3), 전부 `ActionResult`, zod, 사유 필수 |
| `apps/web/lib/admin/permissions.test.ts` | vitest 12개: 권한 매트릭스 6 + 지표 계산 6 |
| `apps/web/app/(admin)/admin.css` · `layout.tsx` | 스타일 엔트리 · 2차 게이트 · noindex · 사이드바 · SLA 배너 · `dynamic="force-dynamic"` |
| `apps/web/app/(admin)/_components/*` | `AdminSidebar`, `OverdueBanner`, `ConfirmActionDialog`(client), `EvidenceViewer`(client), `ReportActions`(client), `PhotoReviewGrid`(client), `UserActions`, `charts`(SVG), `Pagination` |
| `apps/web/app/(admin)/admin/{page,reports,reports/[id],photos,users,users/[id],metrics,audit}` | 화면 8개 (§2) |

## 2. 화면별 스펙

| 라우트 | 최소 역할 | 데이터 | 기능 | 액션(→ RPC / 폴백) |
|---|---|---|---|---|
| `/admin` | moderator | `admin_queue_summary()` | 미종결·SLA 초과·검수 대기·이의신청 카드, 바로가기, 운영 원칙 | — |
| `/admin/reports` | moderator | `listReports()` (reports + profiles 닉네임 + 대상별 미종결/전체 카운트) | 필터 status(open/all/각)·priority·reason·SLA 초과만, 정렬 due_at↑/접수↓, 페이지 50. 행: 우선순위 배지·SLA 남은 시간(초과 빨강)·사유·신고자→대상·대상 누적(dedupe)·탐지 hit·자동 조치·상태/담당·접수 | — |
| `/admin/reports/[id]` | moderator | `getReportDetail()` (report·evidence·양측 요약·매칭·대상 다른 신고 20·제재 20·이 신고의 제재·사진 서명 URL) + **audit evidence_viewed** | 메타(접수·기한·surface·hit·담당·자동 조치·매칭 링크), 증거 뷰어(메시지 50 마스킹↔원문 토글, 탐지 hit 강조, held 표시, 사진), 조치 폼, 우측 프로필 카드·이력 | triage → `admin_triage_report` / resolve → `admin_resolve_report`(confirmed: level 0~역할한도, 기간 h; dismissed; need_info) |
| `/admin/photos` | moderator | `listPhotoQueue()` (pending/held/both, 업로드순, 서명 URL, 24h 반려 수) | 그리드, auto_flags(face unknown/none/one/many·detector)·face_count/confidence, 대표 표시, 키보드 **A 승인 / R 반려(코드 1~8) / X 선택 / J·K 이동**, 일괄 처리(선택 전부), 처리 후 verify_level 재계산 안내 | `admin_review_photo`(approved / rejected+code / held+note) ×N |
| `/admin/users` | moderator | `searchUsers()` | 닉네임(ilike)·전화번호/해시(서버 해시)·profile_id·user_id 자동 판별, 50건 | — |
| `/admin/users/[id]` | moderator | `getUserDetail()` (profile·auth user·identity(해시 제외)·photos·sanctions·appeals·reports 송/수·blocks·consents·audit 30·매칭 수·admin_users) | 배지(레벨·상태·모드·활성 제재·비노출·admin 역할·JWT 불일치), 섹션 10개 | 제재 발행(`issue_sanction` 0009, 레벨·기간·사유) / 해제(`admin_lift_sanction`) / 이의신청 인용·기각(`admin_decide_appeal`, admin) / 비노출 토글(직접+audit) / 강제 로그아웃(ban_duration, admin) / 삭제 예약·취소(직접+audit, admin) — 전부 확인 모달 + 사유 필수 |
| `/admin/metrics` | moderator | `getMetrics(days)` (0060 9함수 병렬) | 기간 7/30, DAU/WAU/MAU, 성비 게이지(35%), 인증 레벨, 퍼널 표, 추천→좋아요→매칭 선 차트 + 전환율, 가입·활성·신고 선 차트 + 신고율 2종, SLA 표+게이지, 제재 막대, 사진 24h 게이지 | — |
| `/admin/audit` | **admin** | `listAudit()` | actor(uuid/role)·action(부분)·target 필터, 페이지 50, before/after/meta | — |

접근 제어 근거(코드 리뷰): `apps/web/lib/auth/routes.ts classifyRoute` — `/admin*` → `{kind:"admin"}`; `apps/web/lib/auth/gate.ts evaluateGate` — 세션 없음 → `/404`, `state.role` 가 admin/moderator 아니면 `FORBIDDEN → /404`; `apps/web/middleware.ts` — `FORBIDDEN && target.kind==="admin"` → `NextResponse.rewrite(/404)`; `gate.test.ts` "① no session" 케이스가 `/admin/photos → /404` 를 고정. 2차: `lib/admin/auth.ts requireAdminPage` → `notFound()`.

## 3. 권한 매트릭스

| 액션 | moderator | admin | 강제 지점 |
|---|---|---|---|
| 신고 큐·상세·증거 열람 | O | O | layout 게이트 + 0043 `assert_moderator` |
| triage(가져오기·우선순위 상향) | O | O | `admin_triage_report` |
| resolve confirmed + 제재 level 0~3 | O | O | TS `canIssueSanctionLevel` + 0043 `level>=4 requires admin` + 0009 issued_by |
| resolve confirmed + level 4~6 | **X** | O | 동상 |
| dismissed / need_info | O | O | |
| 사진 승인·반려(7코드)·held | O | O | `admin_review_photo` |
| 유저 검색·상세 | O | O | |
| 제재 발행 level ≤3 / 4~6 | O / X | O / O | `issueSanction` → `canIssueSanctionLevel` + 0009 |
| 제재 해제 level ≤3 / 4~6 | O / X | O / O | `canLiftSanctionLevel` + 0043 |
| 이의신청 판정 | X | O | `requireAdminAction("admin")` + 0043 `assert_admin` |
| 프로필 비노출 토글 | O | O | 직접 update + audit |
| 강제 로그아웃 | X | O | `requireAdminAction("admin")` |
| 계정 삭제 예약/취소 | X | O | 동상 |
| 감사로그 조회 | X | O | `requireAdminPage("admin")` (+RLS `audit_logs_admin_read`) |
| 지표 | O | O | 0060 `admin_metrics_guard` |

## 4. 지표 정의표 (SQL ↔ KPI)

| 화면 지표 | SQL (0060) | 정의 | KPI 목표(PRD §6) |
|---|---|---|---|
| DAU / WAU / MAU | `admin_metrics_active_users()` | `profiles.status='active'` ∧ `last_active_at ≥ now()-1d/7d/30d` | — |
| 활성(이벤트) 일별 | `admin_metrics_daily().active_users` | `analytics_events(name='app_opened')` distinct `user_id_hash` per `loop_date` | 리텐션 D1/D7/D30 은 코호트 계산 미구현(후속) |
| 신규 가입 / 온보딩 완료 | `.signups` / `.onboarding_completed` | `profiles.created_at` / `onboarding_completed_at` 의 `loop_date` | — |
| 온보딩 퍼널 | `admin_metrics_funnel(days)` | 기간 내 가입(age_blocked 제외) 코호트: 가입 → `onboarding_step ≥ hobbies`(기본정보) → `≥ quiz` → `≥ card` → `≥ photos` → `≥ verify`(온보딩 완료) → `verify_level ≥ 2` → `≥ 3` | 추천 화면 도달률 = L2/가입 ≥ 45%, 퀴즈 이탈 ≤ 20% |
| 인증 레벨 분포 | `admin_metrics_verify_levels()` | `verify_level` 별 인원(age_blocked 제외) | — |
| 성비 | `admin_metrics_gender()` + TS `datingFemaleRatio` | active ∧ L2+ 중 `mode`×`gender`; 여성 비율 = female / dating 전체(unspecified 분모 포함) | 데이팅 여성 ≥ 35% (1순위) |
| 추천→좋아요 | `.reco_count`, `.likes` → `recoToLikeRate` | Σlikes / Σdaily_recommendations | — |
| 좋아요→매칭 | `.likes`, `.matches` → `likeToMatchRate` | Σmatches / Σlikes (loop_date 별 합) | ≥ 8% |
| 매칭→첫 메시지 | `.matches`, `.first_messages` → `matchToFirstMessageRate` | 그 날 매칭 중 `first_message_at not null` / 매칭 | ≥ 70% |
| 신고율(활성) | `.reports`, `.active_users` → `reportRatePerActive` | Σreports / Σactive_users(이벤트) | — |
| 신고율(매칭) | `.reports`, `.matches` → `reportRatePerMatch` | Σreports / Σmatches | ≤ 3% |
| SLA | `admin_metrics_sla(days)` → `slaCompliance` | 기간 내 접수 건: `within_sla = handled_at ≤ due_at`, `overdue_open = 미종결 ∧ due_at < now`, 준수율 = within / (handled + overdue_open) (기한 안 지난 미종결은 분모 제외) | P0~P2 100% |
| SLA 초과 건수(배너) | `admin_queue_summary().reports_overdue_p0_p2` | 미종결 ∧ due_at < now ∧ P0~P2 | 0 |
| 제재 건수 | `admin_metrics_sanctions(days)` | level 별 total / `AUTO:` 접두어 자동 / 수동 / 해제 | — |
| 사진 검수 24h | `admin_metrics_photos(days)` → `photoReview24hRate` | `reviewed_at - created_at ≤ 24h` / reviewed | ≥ 95% |

일 경계는 전부 `loop_date()`(KST 07:00). 기간 `p_days` 는 1~90(daily)/365(그 외)로 clamp.

## 5. D5 시그니처 대조표 (0043 실제 vs D8 어댑터)

| RPC | 0043 시그니처 | D8 호출(`api.ts d5.*`) | 상태 |
|---|---|---|---|
| `admin_triage_report` | `(p_actor_id, p_report_id, p_priority? report_priority, p_assignee_id? uuid)` | 동일 (메모 인자 없음 → UI 에서 triage 메모 제거) | **일치·로컬 실호출 OK** |
| `admin_resolve_report` | `(p_actor_id, p_report_id, p_outcome report_status, p_sanction_level? int, p_note?, p_duration? interval)` | 동일, `p_duration='<h> hours'` | 일치·OK (moderator level 4 → FORBIDDEN 확인) |
| `admin_review_photo` | `(p_actor_id, p_photo_id, p_decision review_status, p_reject_code?, p_note?)` | UI 결정값 `approved|held|reject_*` → `p_decision`=approved/held/rejected + `p_reject_code` | 일치·OK |
| `admin_lift_sanction` | `(p_actor_id, p_sanction_id, p_note?)` | 동일(사유 → p_note) | 일치·OK (moderator level 4 → FORBIDDEN 확인) |
| `admin_decide_appeal` | `(p_actor_id, p_appeal_id, p_decision appeal_status, p_note?)` | 동일 | 일치·OK (moderator → FORBIDDEN 확인) |
| `admin_set_legal_hold` | `(p_actor_id, p_report_id, p_hold, p_note?)` | 어댑터만 있음, UI 미노출 | 후속(UI 추가 시 admin 전용 버튼) |
| `admin_list_reports` / `admin_get_report` / `admin_search_profiles` / `admin_profile_detail` / `admin_moderation_stats` | 존재 | **미사용**(§0-2) | 교체 가능 |
| 반환값 | jsonb (`{status, priority, report_id, handled_by}` / `{status, sanction_id, expires_at, reverted}` …) | D8 은 `sanction_id` 만 읽음 | — |

## 6. 액션 목록 (`lib/admin/actions.ts`)

`adminSignOut` · `triageReport` · `resolveReport` · `reviewPhotos`(일괄) · `issueSanction` · `liftSanction` · `decideAppeal` · `toggleProfileHidden` · `forceLogout` · `scheduleAccountDelete`(예약/취소). 모두 `requireAdminAction(min)` → zod → 권한 순수 함수 → RPC(또는 폴백) → `revalidatePath` → `ok()`; 예외는 `toActionFailure()`.

## 7. 검증 결과 (2026-09-02)

| 항목 | 결과 |
|---|---|
| `pnpm --filter @duckmate/web typecheck` | 통과 (D8 경로 0 오류) |
| `pnpm --filter @duckmate/web build` | 성공: `/admin`, `/admin/reports`, `/admin/reports/[id]`, `/admin/photos`, `/admin/users`, `/admin/users/[id]`, `/admin/metrics`, `/admin/audit` 전부 ƒ(dynamic). admin.css(@source) 로 ui 클래스 컴파일 |
| vitest `lib/admin/permissions.test.ts` | 12/12 통과 (권한 매트릭스 moderator/admin × level 0~6, lift 한도, 액션별 최소 역할, 우선순위 상향, KPI 계산 6종) |
| vitest 전체 | 다른 에이전트 파일 `lib/push/templates.test.ts` 2건 실패(`daily_reco_ready`, `admin_alert` 카피 lint — **D7 소관**, D8 무관). 나머지 통과 |
| `"use client"` 파일에서 admin/serverEnv/server-only import | 0건 |
| 로컬 PG16 + 셰임: 마이그레이션 0001~0060(D3·D4·D5·D7 포함) 순서 적용 + seed | 성공 (`pg_cron` 없음 NOTICE 만) |
| 0060 함수 10개 실행 (service_role) | 전부 정상 반환. 시드 기준 DAU 5 · 퍼널 5→4→…→L3 1 · 성비 friend 2:2 |
| 0060 권한 | 일반 authenticated(서윤) → `FORBIDDEN`(42501) · admin_users 폴백(JWT role 없음, 99) → 통과 · JWT app_metadata.role=admin → 통과 · anon → `permission denied` |
| 가드 null 버그 수정 | `is_moderator()` 가 null 을 돌려줄 때 통과되던 문제 → `coalesce(…, false)` 로 fail-closed(초기 검증에서 발견) |
| D5 RPC 실호출(D8 어댑터 인자 그대로) | triage(P0 상향+담당) / resolve confirmed level3 by moderator(sanction_id·expires_at 180d) / moderator level4 → FORBIDDEN / admin dismissed / review_photo approved(→ 서윤 L3)·rejected+code·held / lift level3 by moderator / moderator lift level4 → FORBIDDEN / moderator decide_appeal → FORBIDDEN / admin accepted → 제재 해제 — 전부 기대대로(§5) |
| D8 폴백 경로 SQL 시뮬레이션 | in_review 전이·상향, `issue_sanction(issued_by)` 수동 level3, level≥3 무승인 → `MANUAL_APPROVAL_REQUIRED`, dismissed 시 AUTO 제재 revoke → active level 0·expires 90d, photos approve → L3 / reject → L2 / held(reject_code null check 통과), hidden 토글, deleting↔active(check 제약 통과), evidence_viewed insert |
| 지표가 D5 결과를 집계 | SLA 표·제재 레벨별·daily(matches/messages/reports/sanctions)·queue_summary 반영 확인 |
| 비밀값 하드코딩 grep | 없음 |

미실행: Supabase 컨테이너(Docker 없음) — Storage 서명 URL·Auth admin `getUserById/updateUserById(ban_duration)`·PostgREST 경유 RPC(PGRST202 분기)·실제 브라우저 렌더. **오케스트레이터/G3 가 `supabase start` 후 `/admin` 을 시드 admin(821000000099)으로 1회 확인 필요.**

## 8. 미결·후속

- 리텐션 D1/D7/D30 코호트, 루프 완주율(`daily_loop_completed/app_opened`), 제안 카드 채택률, 푸시 오픈율 — `analytics_events` 이벤트가 쌓인 뒤 0060 에 함수 추가(D8 후속).
- 데이터 export(F-055, admin 수동 JSON) 버튼 미구현 — 개인정보 항목(A5 §11.2)을 서버 액션으로 조합해 다운로드하는 라우트 핸들러가 필요(G2 검토 후).
- `admin_set_legal_hold` UI, 신고자 통보 문구 자동 생성(PRD §4.9 "통보 문구") — D5 `notify_user` 와 연결.
- 큐 화면 실시간 갱신 없음(새로고침). 필요 시 `router.refresh()` 폴링 30s.
