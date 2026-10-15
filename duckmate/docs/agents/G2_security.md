# G2 — 보안 리뷰 (RLS · 함수 권한 · IDOR · 게이트 · 웹훅 · 비밀값 · 개인정보 · 입력/출력 · 남용 · 의존성)

> 입력: `14_schema.md`·`15_auth.md`·`16~21_*.md`(G2 포인트)·`05_trust_safety.md`·`09_store_policy.md`, 코드 전체(마이그레이션 24 + Edge Function 10 + `apps/web` 서버 코드 + `packages/db` + `apps/company`).
> 산출물: `supabase/migrations/20260902000070_security_fixes.sql`(P1/P2 수정), `apps/web/next.config.ts`(보안 헤더), `.env.example`(누락 키), 이 문서.
> 검증 환경: 로컬 PostgreSQL 16 + Supabase 셰임(`auth.*`·`storage.objects`·`realtime.messages`·default privileges) → `duckmate_sec`(마이그레이션 25개 + seed + 공격용 픽스처). JWT 는 `request.jwt.claims` GUC 로 시뮬레이션. 기준일 2026-09-02.

## 다음 에이전트에게 넘기는 결정사항

### G3 (배포) — 배포 전 필수
1. **마이그레이션 `0070_security_fixes.sql` 을 반드시 `db push` 에 포함**(0060 뒤). 시그니처 변경 없음·`packages/db` 타입 영향 없음. 적용 후 대시보드 SQL 에서 `select public.is_matched('…','…')` 를 **사용자 JWT 로** 호출하면 42501 이어야 정상(§3 재검증 SQL).
2. **Vercel env 추가/확인**: `AUTH_GATE_SECRET`(32바이트 무작위 — 없으면 service role 키가 HMAC 키로 재사용된다, G2-07), `PHONE_HASH_SALT`, `CONSENT_HASH_SALT`, `IDENTITY_CI_SALT`(회전 금지), `IDENTITY_MOCK_ALLOWLIST`, `PAYMENTS_ENABLED=false`. `NEXT_PUBLIC_*` 에 비밀값 없음(현재 8키 전부 공개값, §2.6).
3. **Supabase Edge secrets**: `PHOTO_REVIEW_WEBHOOK_SECRET`, `DAILY_RECO_WEBHOOK_SECRET`, `MODERATION_WEBHOOK_SECRET`, `PUSH_DISPATCH_SECRET`, `CONTACT_IP_SALT`(미설정 시 고정 문자열 `duckmate-contact` — 반드시 설정), `PORTONE_WEBHOOK_SECRET`(Phase 4), `VAPID_*`. 전부 32바이트 이상 무작위. `--no-verify-jwt` 는 **`contact`·`toss-webhook`·`identity-webhook` 3개만**(나머지는 함수 내부 `isTrustedCaller` 가 검증하므로 verify_jwt 기본값 유지).
4. **Supabase 대시보드 Auth**: SMS 발송 rate limit(기본 30/h 프로젝트 전체 → 런칭 초기 유지), OTP 길이 6·만료 ≤ 5분, **Captcha(turnstile) 활성 권장**(DB 카운터 번호 5/h·IP 20/h 는 2차 방어), Site URL·Redirect URL 은 `NEXT_PUBLIC_SITE_URL` 만. JWT secret 유출 시 즉시 회전(`auth.role()` 기반 검사가 JWT 서명 신뢰에 의존, G2-29).
5. **Storage**: 버킷 3개 `public=false` 확인(0012 가 설정하지만 대시보드에서 재확인). 서명 URL TTL: 사진 1h·채팅 이미지 1h·증거/어드민 10분(코드 고정). Storage 웹훅(object created → `photo-review`, `x-webhook-secret`) 을 등록해 `functions.invoke` 실패 시에도 MIME 스니핑·리사이즈가 실행되게 한다(G2-26).
6. **Realtime**: 대시보드 Realtime → **Private channels 활성**(`realtime.messages` RLS `dm_chat_topics_read` 가 적용되려면 필수). postgres_changes publication 에 `messages` 미등록 상태 유지.
7. **pg_cron**: 0070 이 `dm_purge_rate_limits`(03:20 KST) 를 등록한다. 확장이 늦게 켜졌으면 `select cron.schedule('dm_purge_rate_limits','20 18 * * *',$$select public.purge_rate_limits()$$)` 재실행.
8. **관리자 부여 후 검증**: `admin_users` insert + `app_metadata.role` (21_admin §18). 관리자 JWT 로 `select count(*) from profiles` 가 전체 행을 돌려주는 것은 **정책(profiles_mod_read)대로 정상**이지만 `birth_date·phone_hash` 컬럼까지 읽힌다(G2-11) — 모더레이터 계정은 소유자 본인 1명으로 시작.
9. **빌드 산출물 점검**: `pnpm --filter @duckmate/web build` 후 `grep -rE "SUPABASE_SERVICE_ROLE_KEY|service_role|IDENTITY_CI_SALT|PHONE_HASH_SALT|AUTH_GATE_SECRET|VAPID_PRIVATE" apps/web/.next/static` = 0 (이번 세션은 빌드 산출물이 없어 소스 레벨로만 확인: `"use client"` 파일의 `admin.ts`/`serverEnv()` import 0건, `server-only` 가드 유지).
10. **응답 헤더 확인**: 배포 후 `curl -I https://<web>/` 에 `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` 가 보여야 한다(`next.config.ts headers()`).
11. **의존성**: `pnpm audit --prod` = postcss 4건(high 2·moderate 2, 경로 `apps/company>next>postcss`, 빌드타임 전용 → 런타임 노출 없음). Next 패치 버전 업데이트 시 해소. `pnpm update next --filter @duckmate/company` 를 G3 체크리스트에.
12. **`.gitignore`**: `.env*`·`supabase/.temp`·`playwright-report`·`test-results`·`apps/web/e2e/artifacts` 포함 확인. 리포에 실제 키 없음(`eyJ…`·`sk_`·`whsec_`·전화번호 grep = 테스트 픽스처·seed 예약번호대만).

### E 그룹 / D 그룹 (코드 규칙)
13. **관계 판정 헬퍼는 "본인 인자"로만 호출**: `are_blocked(a,b)`·`is_match_participant(m,p)`·`can_view_profile(v,t)`·`weekly_superlike_used(p)`·`get_effective_tier(u)`·`has_marketing_consent(u)` 는 사용자 JWT 에서 인자에 본인(`current_profile_id()`/`auth.uid()`)이 없으면 false/0/FORBIDDEN 을 돌려준다(0070 G2-02). service role·pg_cron·moderator 는 제한 없음. `is_matched`·`match_id_of`·`is_recommended_recently` 는 클라이언트 RPC 불가(정의자 함수 내부 전용). 새 헬퍼를 만들 때 같은 규칙: `public.g2_trusted_caller() or <본인 인자>`.
14. **프로필 텍스트는 DB 트리거가 최종 방어**(0070 G2-03): `profiles.nickname/bio/now_into`·`profile_hobbies.fav_note` 에 연락처 패턴(`detect_contacts`)이 있으면 `INVALID_INPUT: contact_in_<field>`(23514 → `INVALID_INPUT`), 닉네임 30일 쿨다운은 `NOT_ENTITLED: nickname_change_interval`(42501). `nickname_changed_at` 은 클라이언트 값 무시·서버 트리거가 채움. 금칙어(BW_*)는 여전히 앱 계층(`checkText`)만 — DB 미러는 §6 잔여.
15. **`mask_contacts`/`detect_contacts` 가 authenticated 에서 실제로 동작**(0030 은 `safety_preprocess` 권한 누락으로 42501 이었음, G2-05 수정). E3 가 클라이언트 미리보기에 써도 된다.
16. **서버 액션 IDOR 전수 결과: 결함 0**. 모든 `profile_id/match_id/report_id/photo_id` 입력은 zod uuid → 사용자 JWT 클라이언트(RLS) 또는 본인 검사 후 service role. service role 로 타인 리소스를 직접 쓰는 곳은 `subscribePush` 의 "같은 endpoint 타 계정 행 삭제" 1곳(G2-10, P3 수용).
17. **Edge Function 호출 규칙 유지**: Bearer service role 또는 `x-webhook-secret`. 비교는 `===`(비상수시간, G2-09 P3). 새 함수는 `_shared/supabase.ts isTrustedCaller` 를 그대로 쓰되 G3 이후 `crypto.subtle.timingSafeEqual` 로 교체 권장.

### Phase 3/4 전 재검토 (D6·F)
18. `toss-webhook`(501 stub) 실구현 시 19_payments §G2 21~27 체크리스트 그대로: rawBody 서명 → 조회 API 재확인 → `payment_events` idempotency 첫 문장 → 금액 서버 재계산. `get_effective_tier` 는 0070 가드가 있으므로 웹훅(service)에서 호출해도 무방.
19. `identity-webhook` 실연동 시 `webhook-id` 기반 재생 방지(현재 5분 타임스탬프만) + 상수시간 비교(G2-09).
20. 엄격 CSP(`script-src 'nonce-…'`, `connect-src` supabase/wss, `img-src` 서명 URL 도메인) — Next inline 스크립트·Realtime·서명 URL 호스트 정리 후 도입(G2-06 잔여).

---

## 1. 발견 표

| ID | 영역 | 심각도 | 재현(로컬 셰임) | 수정 | 상태 |
|---|---|---|---|---|---|
| G2-02 | 함수 권한 / 개인정보 | **P1** | A(서윤) JWT 로 `is_matched(C,D)`=true, `match_id_of(C,D)`=매칭 uuid, `is_recommended_recently(D,C)`=true, `can_view_profile(D,C)`=true, `is_match_participant(CD,C)`=true, `has_marketing_consent(C_user)`, `get_effective_tier(C_user)`, `weekly_superlike_used(C)` — 제3자 관계·구독·동의 오라클 | 0070: 3종 execute 회수(정의자 내부 전용), 6종에 `g2_trusted_caller() or 본인 인자` 가드 | **수정·재검증**(§3: 전부 42501/false/0) |
| G2-03 | RLS / 입력 검증 | **P2** | A JWT 로 `update profiles set bio='연락은 010-…'`·`nickname_changed_at='2000-01-01'`·`profile_hobbies.fav_note='카톡 id'` 직접 update → 서버 액션 `checkText`·30일 쿨다운 우회 | 0070: `trg_profiles_user_text_guard`(nickname/bio/now_into 연락처 차단·쿨다운·`nickname_changed_at` 서버 채움), `trg_profile_hobbies_text_guard` | **수정·재검증** |
| G2-01 | RLS / 권한 위생 | **P2** | 0050 `push_queue·admin_notifications·consent_rechecks·rate_limits·push_prefs` 와 뷰 7개, `can_like/can_send_*` 3함수에 anon/authenticated default privilege 잔존(RLS 무정책이라 행은 0 = 데이터 누출 없음, `push_templates` 만 anon 읽힘, anon 이 `can_like(x,y)` 호출 가능) | 0070: 전부 revoke | **수정·재검증**(anon 이 select 가능한 관계 = 공개 참조 6개뿐) |
| G2-06 | 출력 / 헤더 | **P2** | `next.config.ts` 에 보안 헤더 없음 → 클릭재킹·MIME 스니핑 | `headers()`: X-Frame-Options DENY, CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, `poweredByHeader:false` | **수정**(typecheck·test 통과) |
| G2-05 | 함수 권한(기능) | P2 | authenticated 가 `mask_contacts()` 호출 시 `permission denied for function safety_preprocess` (17_chat §29 위반) | 0070: `safety_preprocess`·`contact_rule_patterns` execute → authenticated | **수정** |
| G2-04 | 남용 / 보존 | P3 | `rate_limits` 정리 배치 없음(0042/0051 미반영) — 해시 키 무한 성장 | 0070: `purge_rate_limits(interval)` + pg_cron `dm_purge_rate_limits` | **수정** |
| G2-07 | 세션 / 비밀값 | P3 | `AUTH_GATE_SECRET` 미설정 시 service role 키가 HMAC 키로 재사용(키 목적 혼용). 위조 자체는 불가(HMAC-SHA256·60s·userId 바인딩·`timingSafeEqualHex`), layout 이 DB 재확인 | env 설정(G3 §2) | 제안 |
| G2-08 | 레이트리밋 | P3 | `clientIp()`(web)·`contact` Edge 가 `x-forwarded-for` 첫 값 신뢰. Vercel 은 XFF 를 플랫폼이 덮어써 안전, Supabase Edge 는 클라이언트 삽입 값이 앞에 올 수 있어 IP 한도 우회 가능. `contact` 한도는 isolate 메모리(콜드스타트 초기화) | `contact`: `x-real-ip`/`cf-connecting-ip` 우선 + 테이블 기반 한도(Phase 2, 13_company 결정대로) | 제안 |
| G2-09 | 웹훅 | P3 | `isTrustedCaller`·`identity-webhook` 서명 비교 `===`(비상수시간), `identity-webhook` 재생 방지 없음(5분 허용치만) | `timingSafeEqual` + `webhook-id` dedupe(Phase 4) | 제안 |
| G2-10 | IDOR(service role) | P3 | `subscribePush` 가 같은 endpoint 의 타 계정 행을 service role 로 삭제 — endpoint 를 아는 공격자가 타인 구독 제거(알림 DoS). endpoint 는 푸시 서비스 발급 무작위 URL이라 실질 위험 낮음 | 삭제 대상을 `disabled_at is not null or last_sent_at < now()-30d` 로 제한 권장 | 제안 |
| G2-11 | 개인정보(모더레이터) | P3 | `profiles_mod_read` 로 moderator JWT 가 PostgREST 에서 `birth_date·phone_hash·seeking_gender` 전 컬럼 열람 가능(어드민 UI 는 birth_year·12자 프리픽스만) | 모더레이터용 컬럼 grant 분리는 `profiles` 컬럼 권한 구조상 authenticated 전체에 영향 → Phase 2 에 `v_profile_admin` 뷰로 전환 권장 | 제안 |
| G2-12 | 함수 권한 | P3 | `active_sanction_level(p)` 는 여전히 타인 id 로 호출 가능(레벨 숫자만) — `can_like·create_report·트리거` 가 타인 id 로 내부 호출하므로 가드 시 기능 파손 | 0070 미적용. 필요 시 `_internal` 분리 후 가드(§6) | 잔여 |
| G2-13 | 게이트 | P3 | `/dev/*` 는 `NODE_ENV=production` 검사만(Vercel preview 도 production 이라 차단됨), `/dev/profile` 은 `force-static`+notFound. `classifyRoute` 는 `/dev` 를 public 으로 분류(DB 조회 없음) | 유지 | 확인 |
| G2-14 | 비밀값 / env | P3 | `.env.example` 에 `PAYMENTS_ENABLED·MODERATION_WEBHOOK_SECRET·CONTACT_IP_SALT·RESEND_*` 누락 | 주석 라인 추가 | **수정** |
| G2-15 | 의존성 | P3 | postcss <8.5.23 (high 2·moderate 2), 경로 `apps/company>next>postcss`(빌드타임) | Next 패치 업데이트 | 제안(G3 §11) |
| G2-16 | 남용 | P3 | `analytics_events` anon insert 무제한(`with check (true)`, `props` jsonb 크기 제한 없음) | `props` 길이 check(≤ 2KB) + 앱 `track()` 배치 상한; Phase 2 | 제안 |
| G2-17 | 입력 검증 | P3 | `submit_appeal(p_attachment_path)` 임의 문자열 저장(현재 UI 미사용·서명 URL 미발급) | 사용 시 `appeals/{profile_id}/%` prefix check 추가 | 제안 |
| G2-19 | XSS | P3 | 법적 문서 `marked` 렌더(HTML 미이스케이프) + `{{KEY}}` 치환값이 `config/company.ts`(env·리터럴) — 운영자 통제 값, 사용자 입력 없음. 채팅/닉네임/bio 는 React 텍스트 렌더(`dangerouslySetInnerHTML` 3곳 전부 내부 마크다운·JSON-LD) | 유지(치환값에 `<` 금지 검사는 `check-legal-placeholders` 소관) | 확인 |
| G2-21 | 세션 | P3 | `/api/identity/callback?token=` GET 으로 mock 토큰 전달(서버 로그·Referer 노출 가능). 토큰은 HMAC·15분·profileId 바인딩 | Phase 4 portone 은 POST/서버-서버 | 확인 |
| G2-22 | 개인정보(export) | — | `exportMyData` 는 본인 행만(사용자 권한·RLS), 상대는 `partner_nickname` 만(05 §11.2 허용), 메시지는 `is_mine=true` | — | 확인 |
| G2-23 | Realtime | — | `match:CD` 로 A 구독 0행, `inbox:C` 0행, 토픽 인젝션 0행, 페이로드에 `body` 키 없음(`masked_body` 만) | — | 확인 |
| G2-24 | Storage | — | 타인 폴더 insert/delete/update 거부, `evidence` 0행(admin JWT 도 0), `chat-images` 비당사자 0행·L2 업로드 거부 | — | 확인 |
| G2-27 | 게이트(admin) | — | `/admin/`(트레일링 슬래시)→strip, `/Admin`→Next 404, `%2F`→세그먼트 불일치 404, 세션 없음→404 rewrite; 2차 `requireAdminPage()`(auth.getUser + `app_role()` RPC) 가 매 요청 DB 재조회 | — | 확인 |
| G2-28 | 게이트(라우트 분류) | — | E1~E4 추가 라우트 전수 대조: `/appeal`·`/account/restore`(status), `/blocks`·`/report(/new)`·`/settings/**`·`/me/**`(app L1), `/chat·/home·/reco·/match`(L2), `/account/delete`·`/legal`·`/dev`(public, 페이지 자체 게이트/noindex), `/api/*` bypass(핸들러 자체 인증) — 누락 0 | — | 확인 |
| G2-29 | 함수 권한 | — | `role` 클레임을 `service_role` 로 위조한 JWT 시뮬레이션 → `auth.role()` 검사 통과(설계상 JWT 서명이 방어선). service 전용 함수는 execute 회수로 2중 방어(`send_message` 등 42501) | JWT secret 관리(G3 §4) | 확인 |
| G2-30 | 개인정보(로그) | — | `console.*` 에 전화·생년·CI·토큰·본문 출력 0건. `audit_logs.meta` 생년은 연도만. `notification_log` 는 template/hash 만. `inquiries.email` 은 설계상 저장(3년) | — | 확인 |

심각도 집계: **P0 0 · P1 1(수정) · P2 4(수정 4) · P3 12(수정 2, 제안 8, 잔여 1, 확인 1) · 확인/무결함 8**.

## 2. 전수 검사 결과

### 2.1 RLS 매트릭스 (A=서윤 JWT, 52 테이블 자동 순회 + 픽스처: A-B 매칭, C-D 매칭·메시지·신고·제재·이의신청·결제·푸시·모더레이션 행)

| 결과 | 테이블 |
|---|---|
| 본인 행만(타인 행 0) | profiles, consents, identity_verifications(해시 컬럼 제외), daily_recommendations, likes, matches, messages(body 컬럼 제외), reports(상태 컬럼만), sanctions, appeals, inquiries, subscriptions/payments/item_ledger/boosts/refund_requests, game_profiles/quest_progress/event_rsvps, push_subscriptions/push_prefs/notification_log, blocks |
| 설계상 타인 행 노출(can_view_profile 통과 B·C 만) | profile_hobbies(7), availability(5), photos(B 승인 1장) — D(비추천)는 0 |
| 0행(service 전용, RLS 무정책) | app_settings, blocked_ci_hashes, message_flags, audit_logs, sku_price_history, moderation_flags/jobs/notifications/settings, push_queue, admin_notifications, consent_rechecks, rate_limits, game_sessions |
| permission denied(테이블 자체) | analytics_events(select), app_settings, moderation_settings |
| 컬럼 권한 거부 | `messages.body`, `identity_verifications.ci_hash`, `reports.evidence/detail`, `sanctions.issued_by` (admin JWT 도 동일) |
| 쓰기 62건 시도 | 타인 행 update/delete = 0행, 타인 소유 insert = RLS 거부, 검수·레벨·상태·생년 컬럼 = permission denied, `messages` 직접 insert = 권한 없음(0030 회수), storage 타인 폴더/evidence/chat-images = RLS 거부. 유일한 통과 = `analytics_events` insert(설계) |
| 뷰 | `v_profile_public` = 본인+B+C(민감 컬럼 `birth_date·phone_hash·seeking_gender·hidden_*` 없음), `v_messages` 타인 body 0, `v_my_matches` 1, `v_my_blocks` 0, `reports_overdue`/`v_rule_hit_stats` 0(뷰 내 moderator 가드), 전부 owner(postgres) 뷰 + 내부 접근 규칙(security_invoker 미사용은 설계) |

### 2.2 함수 권한 카운트 (0070 적용 후, `pg_proc` public 스키마)

| 항목 | 값 |
|---|---|
| 함수 총수 | 166 (트리거 함수 포함) |
| SECURITY DEFINER 중 `search_path` 미고정 | **0** |
| anon 실행 가능(트리거 제외) | **0** (수정 전 3: can_like·can_send_message·can_send_chat_image) |
| authenticated 실행 가능(트리거 제외) | 71 (수정 전 74; 전부 본인 컨텍스트 RPC·판정 헬퍼) |
| service 전용 함수를 authenticated 가 호출 시도 (send_message·issue_sanction·recompute_verify_level·apply_block_internal·check_rate_limit·apply_identity_verification·notify_profile·run_daily_recommendation_batch·generate_daily_recommendations·set_match_first_suggestion·moderation_daily·sla_check·claim_push_queue·claim_moderation_jobs·admin_* 8종) | 전부 42501 |
| `admin_metrics_*`/`admin_queue_summary`(authenticated grant) | `admin_metrics_guard()` 가 42501, admin JWT 는 통과 |
| RLS enable | 52/52 테이블 |
| 정책 | public 64 · storage 9 · realtime 1 |
| anon 이 select 가능한 관계 | regions·hobbies·hobby_categories·quiz_questions·legal_documents·skus 6개(공개 참조) |
| RPC 인자 검증 | uuid 타입 강제(잘못된 값 22P02), 길이(신고 detail 500·appeal 1000·메시지 2000), enum(`report_reason` 22P02), 자기 신고/차단 23514 |

### 2.3 IDOR / 게이트 / 웹훅 / 남용 요약

- 서버 액션·API 라우트 41개 파일 전수: `requireProfileForAction` → 사용자 클라이언트(RLS) 패턴 일관. admin 액션은 `requireAdminAction` + zod + `p_actor_id = ctx.user.id`(세션에서만; SQL `assert_moderator/assert_admin` 이 admin_users 재확인, 비관리자 actor = FORBIDDEN 재현).
- 사용자 RPC 에 타인 id: `get_chat_list(CD)=[]`, `get_report_context(CD)=null`, `mark_read/leave_match/match_suggestion_input(CD)=FORBIDDEN`, `acknowledge_sanction/submit_appeal(타인)=NOT_FOUND`, `mark_push_opened(타인 queue)=0`, `create_report(p_reporter_id=C)` → reporter 는 세션 프로필(위조 무시), `create_report(match_id=CD)` → `NOT_PARTICIPANT`.
- 미들웨어 `dm_gate`: 서명 불일치·만료·userId 불일치 시 무시 후 DB 조회. 오픈 리다이렉트: `/api/auth/callback?next=` 는 `/` 시작·`//` 제외, `PhoneOtpScreen.safeNext`, 미들웨어는 pathname 만.
- Edge Function 10개: `contact`(브라우저·허니팟·IP 한도)·`toss-webhook`(501)·`identity-webhook`(Standard Webhooks HMAC) 외 7개는 Bearer service role 또는 `x-webhook-secret`. 메일 헤더 인젝션: reply_to 는 `^[^@\s]+@[^@\s]+\.[^@\s]+$`(개행 불가), subject 고정, 본문 text.
- 사진: 5MB·MIME 은 서버 액션(storage 메타)+`photo-review` 매직바이트 스니핑(불일치 시 파일·행 삭제). 채팅 이미지 3중(RPC·send_message·storage 정책).
- 레이트리밋: OTP 발송 번호 5/h·IP 20/h, 검증 10/h, 좋아요/메시지 30/분, 신고는 24h 동일대상 dedupe, 문의 5/h(IP), 전부 fail-closed(`check_rate_limit` 장애 시 RATE_LIMITED).

## 3. 재검증 SQL (프로덕션 배포 후 사용자 JWT 로)

```sql
-- 전부 42501 이어야 함
select public.is_matched(gen_random_uuid(), gen_random_uuid());
select public.match_id_of(gen_random_uuid(), gen_random_uuid());
select public.send_message(gen_random_uuid(), gen_random_uuid(), 'x');
-- false 여야 함 (타인 id)
select public.are_blocked('<C>', '<D>'), public.is_match_participant('<CD>', '<C>'), public.can_view_profile('<D>', '<C>');
-- 23514 / 42501
update public.profiles set bio = '010-1234-5678' where user_id = auth.uid();
```

## 4. 수정 파일

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260902000070_security_fixes.sql` | G2-01 권한 회수, G2-02 관계 오라클 가드(`g2_trusted_caller` + 6함수 재정의 + 3함수 execute 회수), G2-03 텍스트 가드 트리거 2개, G2-04 `purge_rate_limits`+cron, G2-05 `safety_preprocess` 권한 |
| `apps/web/next.config.ts` | 보안 헤더 6종 + `poweredByHeader:false` |
| `.env.example` | 누락 키 5줄(주석) |

로컬 검증: 셰임 → 마이그레이션 25개 → seed 신규 DB 적용 성공(경고 0, 재적용 멱등). 0070 적용 전/후 비교: D2·D3 신규 DB 에서 오류 0, D4·D5 전체 출력 diff 없음(D5 의 `matches` 중복키 1건은 적용 전에도 동일한 시드 충돌), test_rls 동일, D7 은 "push_queue 는 authenticated 에 비노출" 기대가 0070 이후에야 충족되는 차이만. `pnpm -r typecheck` 통과, `pnpm -r test` 22 파일 268 + db 70 통과. **git commit 하지 않음.**

## 5. 검증 스크립트 (스크래치, 레포 미포함)

`scratchpad/test_g2_setup.sql`(픽스처)·`test_g2_rls.sql`(52 테이블 자동 순회)·`test_g2_write.sql`(쓰기 62건, 서브트랜잭션 롤백)·`test_g2_rpc.sql`(오라클·service 전용·IDOR·anon·admin JWT·위조 role 클레임)·`test_g2_regress.sql`(0070 후 기능 회귀). 실 Supabase 컨테이너(Docker)·Edge Function 런타임·Storage 서명 URL·Realtime 서버는 미실행 — G3 가 `supabase start && db reset` 후 §3 을 1회 재확인.

## 6. 잔여 리스크 · Phase 3/4 전 재검토

1. `active_sanction_level(uuid)` 타인 조회 가능(G2-12): 레벨 숫자만이나 "정지 여부" 오라클. 내부 호출(트리거·can_like·create_report)이 타인 id 를 쓰므로 `_internal` 분리 + 정의자 함수 호출 경로 변경이 필요(0009·0010·0020·0041 재정의) → Phase 2 스키마 정리 때.
2. 금칙어(BW_*) DB 미러 없음: 프로필 텍스트 금칙어는 앱 `checkText` 만(연락처는 0070 트리거). `packages/db/safety-rules` 사전을 SQL `banned_word_patterns()` 로 미러하면 트리거에 한 줄 추가.
3. 엄격 CSP 미도입(G2-06 잔여), `contact` 메모리 레이트리밋·XFF(G2-08), 비상수시간 비교·재생(G2-09), moderator 컬럼 노출(G2-11), analytics 남용(G2-16).
4. 결제(Phase 3): `subscriptions/payments/...` 쓰기 정책 없음 확인(authenticated insert = permission denied). 웹훅 구현 시 19_payments §G2 21~27.
5. 본인인증(Phase 4): mock allowlist 폐기·`identity-webhook` 재생 방지·`/api/identity/callback` GET 토큰 → POST.
6. 모더레이터 증가 시: `admin_users` + `app_metadata.role` 이중 관리(회수는 두 곳), 어드민 `q=` 전화번호 검색이 GET 쿼리(브라우저 히스토리·서버 로그) — POST 액션 전환 권장(21_admin §15).
