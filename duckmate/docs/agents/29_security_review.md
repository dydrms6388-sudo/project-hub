# G2 · 보안 리뷰 (Phase 1 배포 전 감사)

> 작성: 서브에이전트 G2 (보안 리뷰) · 기준일 2026-08-19
> 범위: `supabase/migrations/*.sql` (13개, 정책 51 + storage 8 + 알림 3 + 결제 1 = 63개),
> `supabase/functions/**` (send-message · push-dispatch · daily-recommendations),
> `apps/web/lib/**`, `apps/web/app/api/**`, `apps/web/app/(admin)/**`, `middleware.ts`,
> `packages/db/src/payments/provider.ts`.
> 대조 기준: `05_trust_safety.md`(A5), `21_admin.md` §6·§7, `14_schema.md`, `15_auth.md`.
> **이 문서는 리뷰 산출물이며 코드를 수정하지 않았다.** 수정은 각 담당 에이전트 몫이다.

---

## 다음 에이전트에게 넘기는 결정사항

### A. Blocker — 배포 전 반드시 고쳐야 함 (6건)

| ID | 심각도 | 요약 | 담당 |
|---|:---:|---|---|
| **G2-01** | **Critical** | `IDENTITY_VERIFIER=stub` 가 프로덕션에서 경고만 남기고 통과한다. PortOne 미구현이라 Phase 1 은 **사실상 stub 으로만 기동 가능** → 만 19세 3중 게이트가 1중(자기신고)으로 붕괴하고, 누구나 Lv2(매칭·채팅) 무제한 승급 | D2 |
| **G2-02** | High | `likes` 에 컬럼 권한이 없어 클라이언트가 PostgREST 직접 INSERT 로 `type='super'` 와 Lv1 일 3회 제한을 전부 우회한다 (서버 카운트는 Server Action 경로에만 존재) | D1 + D3 |
| **G2-03** | High | `appeals` 에 컬럼 권한이 없어 유저가 `status='ACCEPTED'`·`decided_by=<어드민 id>` 를 스스로 INSERT 할 수 있다. 분쟁 대응 증적 위조 + 본인 이의제기권 소멸(sanction_id unique) | D1 |
| **G2-04** | High | 신고 레이트 리밋이 `(신고자, 대상) 24h 1회` 뿐이라, 계정 1개로 **임의 다수에게 P0 신고 1건씩 → 각각 72h 발신 정지(AUTO_P0_FREEZE)** 를 걸 수 있다. 게다가 기각해도 자동 제재가 해제되지 않는다(G2-05 연쇄) | D5 |
| **G2-05** | High | `lib/admin/reports.ts` 가 `00010` 의 `resolve_report()` RPC 를 쓰지 않아 **자동 임시 제재의 REVOKED 대체가 일어나지 않는다**. 무고 신고로 걸린 72h 제재가 기각 후에도 유지됨 (A5 §3.2 위반) | D8 |
| **G2-07** | High | `push_tokens.token.endpoint` 가 `z.string().url()` 검증뿐이라, 인증 유저가 임의 URL 을 등록하면 `push-dispatch` Edge Function 이 그 URL 로 POST 한다 (blind SSRF) | D7 |

> **G2-06**(Lv5 선언식 4-eyes, High)은 "어드민 1인 운영" 전제에서는 실효 리스크가 낮아
> Blocker 에서 제외했으나, **어드민이 2명 이상이 되는 시점 전까지 반드시 해결**해야 한다.
> 그때까지의 보상 통제 = `audit_logs.meta.co_approver_id` 주간 점검(운영 규약으로 명문화).

### B. Phase 2 로 미룰 수 있는 것

| ID | 심각도 | 요약 | 담당 |
|---|:---:|---|---|
| G2-06 | High | Lv5 4-eyes 가 부승인자 **닉네임 입력만**으로 성립 (실제 동의 없음) — 승인 대기 테이블 필요 | D8 |
| G2-08 | Medium | `profiles.mode`·`onboarding_step` 이 클라이언트 UPDATE 허용 → Lv1 이 dating 모드 진입(A5 §1.2 위반), 온보딩 전 단계 스킵 | D1 |
| G2-09 | Medium | `matches.status` 가 참여자 UPDATE 허용 → 상대가 언매치한 방을 `active` 로 되돌려 재접촉 가능 | D1 |
| G2-10 | Medium | 무료 티어 "받은 좋아요 블러"가 화면 분기일 뿐 — `likes` 직접 SELECT 로 좋아요 보낸 사람 전원 식별 가능 | D3 |
| G2-11 | Medium | `refund_requests` 컬럼 권한 부재 → 유저가 `status='approved'`·`amount` 임의 삽입. **Phase 3 결제 개시 전 반드시 차단** | D1/D6 |
| G2-12 | Medium | 메시지 발신 레이트 리밋 부재 + A5 §3.2 의 `AUTO_MASS_LIKE`·`AUTO_PATTERN_SCAM` 미구현 | D4/D5 |
| G2-13 | Medium | `masking.ts` R1·R5 정규식의 중첩 공백 모호성 → ReDoS 가능(2000자 입력, Edge CPU 소진) | D4 |
| G2-14 | Medium | `contact_messages` anon 무제한 INSERT(캡차·레이트리밋 없음) + 탈퇴 폴백이 여기에 user_id·email 을 적재 | D1/E4 |
| G2-15 | Medium | 보안 헤더 전무 (CSP·X-Frame-Options·Referrer-Policy·HSTS) — 어드민 콘솔 클릭재킹 | E그룹/오케스트레이터 |
| G2-16 | Medium | `GET /api/auth/verify-identity` 가 상태 변경(Lv2 승급)을 수행 — stub 환경에서 CSRF 가능 | D2 |
| G2-17 | Medium | level 3/4 제재 중 탈퇴 → `identity_hashes` cascade 파기 → 동일 CI 로 즉시 재가입(제재 회피) | D1/D5 |
| G2-18~28 | Low | 아래 §4 참조 (javascript: URL, open redirect 백슬래시 우회, PostgREST 문자열 보간, 감사 커버리지, 서명 URL 재사용, DB_ERROR 원문 노출 등) | 각 담당 |

### C. 판정

**Phase 1 배포 = 조건부 불가.** G2-01 은 서비스의 법적 근간(만 19세 차단)을 무력화하므로
단독으로 배포 차단 사유다. 나머지 5건(G2-02·03·04·05·07)은 전부 하루 단위 수정 규모다.
6건 해소 시 **배포 가능**. 상세 근거는 §7.

---

## 1. 점검 방법과 확인된 좋은 설계

51개 정책 + storage 8개를 테이블별로 대조하고, 각 Server Action / Route Handler /
Edge Function 이 클라이언트 입력을 어디서 신뢰하는지 역추적했다. 먼저 **잘 되어 있는 것**을
명시한다(뒤에서 이 강점을 깨뜨리는 수정을 하지 않도록):

1. **`messages` 원문 격리는 3중으로 정확하다.** `00003_rls.sql:193-196` 컬럼 grant 로
   `body`·`mask_rules` SELECT 를 revoke 하고, `00009_chat.sql:46-61` 이 `messages` 를
   `supabase_realtime` 퍼블리케이션에서 **강제로 제거**하며, broadcast 페이로드를
   `jsonb_build_object` 화이트리스트(`00009_chat.sql:103-111`)로 고정했다.
   `chat_rooms` 뷰는 `security_invoker = on` 이라 컬럼 권한이 그대로 승계된다.
   → **Realtime 경유 원문 유출 경로 없음.** WALRUS 구현에 안전을 걸지 않은 판단이 옳다.
2. **`reports.evidence` 는 어떤 클라이언트 경로로도 나가지 않는다.** 컬럼 grant 화이트리스트
   (`00003_rls.sql:200-203`)에 evidence 가 없고, `my_reports` 뷰(`:508-512`)도 안전 컬럼만
   노출한다. 어드민 열람은 service role + `admin.report.evidence_view` 감사 기록
   (`lib/admin/reports.ts:134`).
3. **service role 키의 클라이언트 번들 유입 경로 없음** (§3-G2-3 상세). 정적 검증 + 빌드
   산출물 검증 둘 다 통과.
4. **Realtime private 채널에 INSERT 정책을 의도적으로 만들지 않았다**(`00009_chat.sql:203-229`)
   — 참여자가 `new_message`/`safety_card` 이벤트를 위조해 상대에게 쏘는 경로가 원천 차단된다.
5. **35개 테이블 전부 `enable row level security`.** 누락 없음(§2.1 표).
6. **결제 웹훅 계약이 fail-closed** — `WebhookVerification` 이 판별 유니온이라 `valid` 검사 없이
   `event` 에 접근할 수 없고, 미구현 구현체는 예외를 던진다(§5-4).

---

## 2. RLS 우회 (점검항목 1)

### 2.1 테이블 커버리지 — 누락 없음

RLS 활성 테이블 35개(00003=30, 00007=1, 00011=2, 00012=2)가 생성된 테이블 35개와 1:1 일치한다.
**정책 0개로 전면 차단**된 테이블은 전부 의도된 service-role 전용이다:
`blocked_hashes`, `identity_hashes`(`00007:16-18`), `notification_log`(`00011:139-141`),
`payment_events`(`00012:108`). 뷰 `item_balances`·`chat_rooms` 는 `security_invoker=on`,
`my_reports`·`my_sanctions` 는 `security_invoker=off` + `auth.uid()` 필터로 올바르다.

### 2.2 [G2-02 · High] `likes` 컬럼 권한 부재 → 좋아요 한도·슈퍼라이크 잔액 우회

- **파일**: `supabase/migrations/00003_rls.sql:322-328` (정책), `apps/web/lib/matching/queries.ts:269-316`
- **문제**: 00003 은 `profiles`·`messages`·`reports`·`photos`·`daily_recommendations`·`matches`
  에 대해서만 `revoke insert/update`를 걸었다. `likes` 는 Supabase 기본 grant(`authenticated`
  전 컬럼 INSERT)가 그대로 남아 있고, 정책 `likes_insert_own` 은 `from_id`·`can_engage()`·
  `can_view_profile(to_id)` 만 본다. **`type` 컬럼과 일일 횟수는 어디서도 검증되지 않는다.**
  Lv1 일 3회 한도와 슈퍼라이크 잔액 차감은 `lib/matching/queries.ts:280-311` 의
  Server Action 경로에만 있다(주석 `00003_rls.sql:316` 도 "서버(Edge)에서 카운트"라고 자인).
- **악용 시나리오**: 로그인 유저가 브라우저 콘솔에서
  `supabase.from('likes').insert({from_id: <내 profile id>, to_id: <상대>, type: 'super'})`
  를 반복한다. RLS 는 통과, `item_ledger` 차감은 발생하지 않는다. → 슈퍼라이크 무한 발급
  (A4 §2.2 수익모델 무력화) + Lv1 스팸 좋아요 무제한(A5 `AUTO_MASS_LIKE` 대상 행위).
- **권장 수정**: `00003` 에 다음을 추가.
  `revoke insert, update, delete on public.likes from anon, authenticated;`
  좋아요 발신 전체를 `send_like(target, type)` security definer RPC(한도·잔액 검사 포함)로
  단일화하고 `authenticated` 에 execute 만 부여한다. `lib/matching/queries.ts` 의
  `sendLike` 는 그 RPC 호출로 교체(계약 `MatchingResult` 동일).
- **담당**: D1(권한/RPC) + D3(호출부 교체)

### 2.3 [G2-03 · High] `appeals` 컬럼 권한 부재 → 이의제기 결정 위조

- **파일**: `supabase/migrations/00003_rls.sql:393-398`, 테이블 정의 `00002_core_tables.sql:342-352`
- **문제**: `appeals` 는 `status`·`decided_by`·`decided_at`·`decided_reason` 컬럼을 갖는데
  `revoke insert` 도, 컬럼 화이트리스트 grant 도 없다. 정책은 `profile_id = 나` 와
  `can_appeal(sanction_id)` 만 확인한다.
- **악용 시나리오**: 제재를 받은 유저가 정식 경로(`submit_appeal()` RPC)를 우회해
  `insert into appeals (sanction_id, profile_id, body, status, decided_by, decided_at, decided_reason)
  values (<내 제재>, <나>, '...', 'ACCEPTED', <아무 어드민 profile id>, now(), '인용됨')`
  을 직접 실행한다. 결과:
  (a) 분쟁·법적 대응에 쓰이는 이의제기 기록이 **어드민이 인용한 것처럼 위조**된다
      (실제 제재 해제는 일어나지 않으나 기록만 보면 구분 불가).
  (b) `sanction_id` 가 unique 이므로 이후 정식 `submit_appeal()` 이 `APPEAL_DUPLICATE` 로 막혀
      **본인의 실제 이의제기권이 소멸**한다(A5 §3.3 "제재 건당 1회"의 오작동).
  (c) `listAppeals(scope='pending')` 는 `status='PENDING'` 만 조회하므로 어드민 큐에서 사라진다.
- **권장 수정**: `00003` 에
  `revoke insert, update, delete on public.appeals from anon, authenticated;`
  를 추가하고 정식 접수는 `submit_appeal()` RPC(이미 `00010:303-350`, `authenticated` execute
  부여됨)만 남긴다. `appeals_insert_own` 정책은 삭제해도 무방하다.
- **담당**: D1

### 2.4 [G2-08 · Medium] `profiles.mode` / `onboarding_step` 클라이언트 UPDATE 허용

- **파일**: `supabase/migrations/00003_rls.sql:186-189`
- **문제**: grant 화이트리스트에 `mode` 와 `onboarding_step` 이 포함돼 있다.
  `lib/auth/actions.ts` 의 `saveMode` 는 "dating 은 Lv2 미만이면 거부"를 구현하지만
  RLS 는 그 조건을 모른다.
- **악용**: Lv1 유저가 `supabase.from('profiles').update({mode:'dating'})` → A5 §1.2
  "데이팅 모드 전환 = Lv2+" 매트릭스 위반. 또한 `update({onboarding_step:'done'})` 하나로
  취미·퀴즈·덕질카드·사진 단계를 전부 건너뛴다(`requireOnboardingDone` 은 이 컬럼만 본다).
- **완화 요인**: `verify_level` 은 여전히 service role 전용이라 매칭·채팅 게이트는 유지된다.
  즉 권한 상승이 아니라 **정책 매트릭스 우회**다.
- **권장 수정**: `mode` 를 grant 에서 제거하고 `set_profile_mode(mode)` RPC(Lv 검사 포함)로
  이관. `onboarding_step` 은 전진만 허용하는 BEFORE UPDATE 트리거를 추가한다.
- **담당**: D1 + D2

### 2.5 [G2-09 · Medium] `matches.status` 참여자 UPDATE → 언매치 무효화

- **파일**: `supabase/migrations/00003_rls.sql:216-217, 339-342`
- **문제**: 컬럼 grant `(status, closed_at)` + `matches_update_participant` 는 어느 방향
  전이인지 보지 않는다. `match_status` 는 `('active','closed')` 2값(`00001:31`).
- **악용**: A 가 언매치(`closed`)해도 B 가 `update matches set status='active'` 로 방을 되살린다.
  `messages_select_participant` 와 `can_access_match_topic` 은 status 를 보지 않고,
  send-message 는 `status='active'` 만 요구하므로 **원치 않는 상대와의 대화가 재개**된다.
  A5 부록의 "차단은 양방향 비노출" 원칙이 차단으로는 지켜지지만, 언매치는 보호되지 않는다.
- **완화 요인**: 현재 웹앱에 언매치 UI 자체가 없다(`grep unmatch` 결과 0건). 즉 **아직 미노출
  기능이라 Phase 2 이월 가능**하나, UI 를 켜기 전에 반드시 고쳐야 한다.
- **권장 수정**: `active → closed` 단방향만 허용하는 BEFORE UPDATE 트리거, 또는
  `close_match(match_id)` RPC 로 이관.
- **담당**: D1 + D4

### 2.6 [G2-10 · Medium] 좋아요 페이월이 표현 계층에만 있음

- **파일**: `supabase/migrations/00003_rls.sql:317-320`, `apps/web/lib/matching/queries.ts:399-482`
- `getLikers` 는 서버에서 실제 구독 티어를 재조회해(`:406-408`) 무료면 카운트만 반환한다 —
  **이 부분은 올바르다**. 그러나 `likes_select_own` 이 `to_id = 나` 인 행 전체를 읽게 하므로
  클라이언트가 `supabase.from('likes').select('from_id').eq('to_id', me)` 로 좋아요를 보낸
  사람 목록을 직접 얻고, `profiles_select_visible` 로 닉네임까지 조회할 수 있다.
- **권장 수정**: `likes_select_own` 의 SELECT 를 `from_id = 나` 로 좁히고, "받은 좋아요"는
  카운트 RPC + 유료 티어 전용 목록 RPC 로 분리한다.
- **담당**: D1 + D3

### 2.7 [G2-11 · Medium] `refund_requests` 컬럼 권한 부재 (Phase 3 전 차단 필수)

- **파일**: `supabase/migrations/00003_rls.sql:500-502`
- 정책이 `user_id = auth.uid()` 만 확인하고 `status`·`amount`·`handled_by` 컬럼이 열려 있다.
  유저가 `status='approved'`, `amount=9999999`, `handled_by=<어드민>` 으로 환불 신청을 직접
  생성할 수 있다. Phase 1 에는 결제가 없어 실피해가 없으나, **D6 이 환불 큐를 붙이는 순간
  금전 손실 경로**가 된다.
- **권장 수정**: `grant insert (user_id, payment_ref, reason) on public.refund_requests to authenticated;`
  + 나머지 revoke. `amount` 는 서버 `calc_refund()` 결과만 기록.
- **담당**: D1 (Phase 3 전 D6 확인)

### 2.8 컬럼 권한 종합 — 누가 되어 있고 누가 안 되어 있나

| 테이블 | 컬럼 권한 제한 | 판정 |
|---|---|---|
| `profiles` | O (`00003:186-189`) | `mode`/`onboarding_step` 과다 허용 → G2-08 |
| `messages` | O (`:193-196`) | **양호** — 원문 완전 차단 |
| `reports` | O (`:199-203`) | **양호** — evidence 제외 |
| `photos` | O (`:206-209`) | **양호** — 검수 상태 조작 불가 |
| `daily_recommendations` | O (`:212-213`) | 양호 |
| `matches` | O (`:216-217`) | status 전이 방향 미검증 → G2-09 |
| `notification_prefs` | O (`00011:88-92`) | **양호** (D7 이 정석대로 함) |
| `likes` | **X** | → **G2-02** |
| `appeals` | **X** | → **G2-03** |
| `refund_requests` | **X** | → **G2-11** |
| `analytics_events` | **X** | → G2-23 (Low) |
| `blocks`, `quiz_answers`, `availability`, `profile_hobbies`, `push_tokens` | X | 자기 행 한정이라 실피해 낮음 |

---

## 3. IDOR / 인가 (점검항목 2)

**결론: 유저 도메인의 IDOR 은 발견되지 않았다.** 채팅·매칭·모더레이션의 모든 진입점이
동일한 방어 패턴을 일관되게 쓴다.

- `lib/chat/queries.ts:143-160` `getOwnCtx(profileId)` — 인자 `profileId` 와 세션 프로필을
  대조해 불일치 시 `PROFILE_MISMATCH`. `lib/matching/queries.ts:83-100` 도 동형.
- Server Action 은 애초에 `profileId` 를 클라이언트에서 받지 않는다
  (`app/(main)/chat/[matchId]/actions.ts:30-43`, `app/(main)/discover/actions.ts:50-69`).
- `matchId`·`targetId` 는 클라이언트가 보내지만 전부 서버가 재검증한다:
  `lib/moderation/service.ts:82-93`(신고 대상이 그 매칭의 상대인지),
  `supabase/functions/send-message/index.ts:271-295`(참여자·차단·상대 상태),
  `00009_chat.sql:251-259`(`mark_read` 참여자 검증, 비참여자/차단 동일 에러 코드로 존재 은폐).
- `app/(main)/discover/[profileId]/page.tsx:87-95` 는 **RLS 로 프로필을 먼저 읽는 데 성공한
  뒤에만** `getApprovedPhotoUrls`(service role 서명 URL)를 호출한다 — `00006` 규약 준수. 정확하다.
- 어드민 액션(`app/(admin)/**/actions.ts`)은 FormData 의 id 를 그대로 lib 에 넘기지만,
  `lib/admin/*` 전 함수가 첫 줄에서 `requireAdminActor()` 를 호출한다. 어드민 권한 모델이
  "전역"이므로 대상 단위 스코프 부재는 설계상 정상 (§5-5 참조).
- `(admin)` 라우트 그룹에 클라이언트 컴포넌트 0개 — `grep -rln '"use client"' "app/(admin)"` 결과 없음.

**단, `blockUser`(`lib/moderation/actions.ts:61-84`)는 `targetId` 존재 확인을 하지 않는다.**
FK 제약이 최종 방어선이므로 실피해는 없다(Low, 기록 안 함).

---

## 4. service role 노출 (점검항목 3) — **이상 없음**

정적·동적 두 방향으로 확인했다.

1. **import 체인 추적**: `"use client"` 파일 42개 각각에서 `lib/supabase/server`,
   `lib/admin/*`, `lib/auth/verify`, `lib/chat/queries`, `lib/matching/queries`,
   `lib/moderation/service` import 여부를 전수 검사. 히트 3건은 전부 **`import type`**
   (`discover/_components/recommendation-stack.tsx:18`,
   `chat/[matchId]/_components/chat-room.tsx:19`, `.../message-list.tsx:19`)으로
   컴파일 시 소거된다. 값 import 0건.
2. **빌드 산출물 검증**: `apps/web/.next/static/` 전체에 `SUPABASE_SERVICE_ROLE_KEY`
   문자열 0건, JWT 패턴(`eyJ….eyJ…`) 0건.
3. **구조적 안전장치**: 키가 `NEXT_PUBLIC_` 접두 없이 `SUPABASE_SERVICE_ROLE_KEY`
   (`lib/supabase/server.ts:36`)이므로, 설령 클라이언트 파일이 import 하더라도 Next 는
   `undefined` 를 인라인할 뿐 비밀을 번들에 넣지 않는다. 그 위에
   `assertServiceContext()`/`assertAdminServerContext()` 런타임 가드가 얹혀 있다.

→ **D8-1 지적("클라이언트 번들 유입") 은 현재 코드에서 실증적으로 반박된다.** 다만
`server-only` 패키지가 없어 경계가 규약(리뷰) 의존인 것은 사실이므로 §6 Low 로 남긴다.

---

## 5. 웹훅 위조 (점검항목 4) — 계약 수준 **적합**, 보완 2건

- **파일**: `packages/db/src/payments/provider.ts:365-367, 484-514`, `supabase/migrations/00012_payments.sql`

**적합한 부분:**
1. `verifyWebhook(rawBody: string, signature: string)` — **파싱된 객체가 아니라 원문 문자열**을
   받는다. 서명 검증의 필수 전제(직렬화 재생성 금지)를 타입으로 강제했다. 정확하다.
2. 반환 타입 `WebhookVerification = {valid:true, event} | {valid:false, error:"WEBHOOK_SIGNATURE_INVALID"}`
   (`:365-367`)는 판별 유니온이라 **`valid` 를 검사하지 않고는 `event` 에 접근할 수 없다**.
   타입 시스템이 "검증 없이 지급"을 컴파일 에러로 만든다.
3. 인터페이스 주석 `:487` 이 "지급/상태 전이는 verifyWebhook 통과 + payment_events 멱등
   기록 후에만", `:513` 이 "부수효과 금지(순수 검증)"를 못 박았다.
4. DB 가 계약을 뒷받침한다: `payment_events (provider, event_id) unique`
   (`00012:89`) = 재전송 멱등, `payments` 쓰기 정책 0개 = service role 전용(`00012:104-108`),
   `amount` 는 서버 재계산(`00012:38-39`).
5. 미구현 구현체가 **fail-closed**: `TossPaymentsProvider.verifyWebhook` / `IapProvider.verifyWebhook`
   이 `NotImplementedError` 를 던진다(`:572, :605`). 스텁이 `{valid:true}` 를 반환하는
   최악의 안티패턴을 피했다.

**보완 필요 (Phase 3 착수 전, Blocker 아님):**
- **[G2-19 · Medium] 재전송(replay) 창 없음.** 시그니처만 받는 시그니처로는 Toss/Stripe 류의
  `t=<timestamp>,v1=<sig>` 헤더에서 타임스탬프 허용 오차를 검증할 수 없다. 서명이 유효한
  과거 페이로드를 무한 재전송하면 `payment_events` unique 가 막아주긴 하나, 그것은
  **event_id 가 있는 채널에서만** 성립한다(`00012:75` 은 event_id 부재 시 "payload 해시로
  대체 생성"이라 재전송이 동일 해시 → 우연히 막힌다). 계약을 `verifyWebhook(rawBody, headers: Record<string,string>)`
  또는 `(rawBody, signature, receivedAt)` 으로 넓히고, 허용 오차(예: ±5분)를 규약에 명시할 것.
- **[G2-20 · Low] 상수 시간 비교 미명시.** 구현 규약 1~5(`:486-491`)에 "서명 비교는
  `timingSafeEqual` 등 상수 시간 함수" 항목을 추가할 것.
- **담당**: D6

---

## 6. Storage (점검항목 5)

**양호한 부분:**
- 버킷 2개 모두 **비공개**(`00006:23-30`, `public=false`) + `allowed_mime_types=['image/webp']`
  + 10MB 상한. 공개 버킷 사고 없음.
- 경로 규약 우회 불가: `storage_photos_insert_own`(`00006:37-44`)이
  `(storage.foldername(name))[1] = current_profile_id()::text` **AND**
  `array_length(...) = 1` **AND** `name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'` 3중으로
  걸어 타인 폴더 업로드·중첩 경로 탈출이 모두 막힌다. `chat-images` 도 동형 +
  `matches` 참여자 검증(`:97-111`).
- **UPDATE 정책을 만들지 않았다**(`00006:87` 주석) → 승인된 객체를 덮어써 검수를
  우회하는 경로가 없다. 정확한 판단.
- 프로필 사진 열람은 본인/어드민/**활성 매칭 상대의 approved 사진**만(`:60-77`).
  탐색 카드용 서명 URL 은 서버가 RLS 판정 후 발급(`_components/photo-url.ts`).
- 서버 발급 서명 URL 만료 600초 (`lib/admin/photos.ts:44`, `_components/photo-url.ts:17`).

**[G2-21 · Low] 서명 URL 재사용** — 10분 만료 URL 은 발급 후 인증 없이 누구나 열람 가능하다
(D8-3 지적과 동일, §5-3 에서 확인). 어드민 검수 화면 스크린샷·URL 공유 시 10분간 유출.
프로필 사진 성격상 수용 가능하나, 만료를 60~120초로 줄이고 어드민 화면에는
`Referrer-Policy: no-referrer` 를 적용할 것. **담당: D8**

**[G2-22 · Low] chat-images 열람 정책에 차단 검사 없음** (`00006:115-124`) —
`matches` 참여자만 보지만 `is_blocked` 를 확인하지 않는다. `matches_select_participant`
(`00003:332-337`)와 달리 차단 후에도 상대 업로드 이미지의 서명 URL 을 받을 수 있다.
실피해는 낮으나(경로를 이미 알아야 함) 원칙 일관성을 위해 조건 추가 권장. **담당: D2/D4**

---

## 7. 인증 우회 (점검항목 6)

### 7.1 [G2-01 · **Critical**] StubVerifier 가 프로덕션에서 활성화될 수 있고, 사실상 활성화된다

- **파일**: `apps/web/lib/auth/identity-verifier.ts:124-142`, `:85-98`,
  `apps/web/lib/auth/verify.ts:202-209`, `apps/web/app/api/auth/verify-identity/route.ts:36-60`
- **문제 1 — 안전장치가 경고뿐**:

  ```
  identity-verifier.ts:127-136
    if (process.env.IDENTITY_VERIFIER === "stub") {
      if (process.env.NODE_ENV === "production" && !warnedStubInProduction) {
        warnedStubInProduction = true;
        console.warn("[duckmate:auth] ⚠ IDENTITY_VERIFIER=stub 가 프로덕션에서 활성화되어 있다. …");
      }
      return new StubVerifier();      // ← 경고만 하고 그대로 반환한다
    }
  ```

- **문제 2 — Phase 1 에서 stub 이 유일한 동작 경로**: `PortOneVerifier` 는
  `requestVerification`/`confirmVerification` 모두 `IDENTITY_VERIFIER_NOT_IMPLEMENTED` 를
  던진다(`:61-71`, Phase 4 예정). 휴대폰 인증(`app/onboarding/phone/actions.ts:53-58`)도
  `verifier.name !== "stub"` 이면 무조건 거부한다. 즉 **stub 이 아니면 아무도 Lv1 조차
  될 수 없어 탐색·매칭·채팅이 전부 죽는다.** 서비스를 띄우려면 프로덕션 env 에
  `IDENTITY_VERIFIER=stub` 을 넣을 수밖에 없는 구조다.
- **문제 3 — stub 이 생년월일을 덮어쓴다**: `StubVerifier.confirmVerification` 은 항상
  `{ ok:true, ci:"STUB-CI-<userId>", birthDate:"1995-01-01" }` 를 반환하고(`:91-97`),
  `promoteIdentityVerified` 는 이 값으로 **`profiles.birth_date` 를 덮어쓴다**
  (`verify.ts:204-208`).
- **악용 시나리오 (만 19세 게이트 완전 붕괴)**:
  1. 만 16세가 가입 화면에서 생년월일을 성인으로 허위 입력 → 게이트 1(zod `isAdultBirthDate`
     + `handle_new_user()` `00004:38-41` + `profiles.birth_date` CHECK `00002:34`) 통과.
  2. `/verify` 에서 `POST /api/auth/verify-identity {action:"request"}` → stub 토큰 수령
     → `{action:"confirm"}` 호출.
  3. stub 이 무조건 성공 → `birth_date = '1995-01-01'`, `verify_level = 2` 확정.
     **게이트 2(PASS 생년월일 = 진실의 원천, A5 §1.3-2)가 오히려 미성년 사실을 지운다.**
  4. `trg_profiles_verify_match`(`00004:160-164`)가 보류 매칭을 자동 성립 → 채팅·이미지 전송 개방.
  5. 게이트 3(런타임 `is_active_member()` 의 `birth_date <= current_date - 19 years`)은
     3에서 덮어쓴 1995-01-01 을 보므로 통과한다.
  → **"3중 게이트"가 실질 1중(가입 자기신고)으로 축소된다.** 청소년보호(07_legal_checklist,
  `youth.md`) 및 스토어 심사(09_store_policy) 근간이 무너지고, `AUTO_P0_FREEZE` 의
  `SAFETY_MINOR` 대응은 사후 대응일 뿐이다.
- **부수 문제**: `REVIEW_BYPASS_EMAILS`(`:106-113, :138-140`)는 **프로덕션에서도 의도적으로**
  stub 을 태운다. 심사용으로 필요한 기능이지만, 화이트리스트 계정도 `birth_date` 가
  1995-01-01 로 덮어써진다. 최소한 bypass 경로에서는 `birth_date` 를 갱신하지 말아야 한다.
- **권장 수정 (택1, 둘 다 하면 최선)**:
  - **(a) 하드 페일**: `getIdentityVerifier` 에서
    `if (process.env.NODE_ENV === "production" && process.env.IDENTITY_VERIFIER === "stub"
     && !process.env.ALLOW_STUB_IN_PRODUCTION) throw new Error("STUB_VERIFIER_FORBIDDEN_IN_PRODUCTION")`
    로 기동 자체를 막고, `.env.example` 에 `IDENTITY_VERIFIER` 를 명시한다.
  - **(b) stub 경로에서 birth_date 를 덮어쓰지 않기**: `promoteIdentityVerified` 에
    `input.trusted: boolean` 을 추가해 `verifier.name === 'portone'` 일 때만 `birth_date` 를
    갱신한다. stub 은 `verify_level` 만 올린다. 이러면 최소한 **게이트 3(런타임 만 나이 판정)이
    자기신고 생년월일 기준으로나마 살아남는다.**
  - **(c) 운영 결정**: PortOne 실연동(현재 Phase 4)을 **Phase 1 필수 선행 작업으로 승격**하거나,
    본인인증 미연동 상태에서는 채팅·데이팅 모드를 비활성으로 출시한다. 이는 오케스트레이터
    판단 사항이다.
- **담당**: D2 (+ 오케스트레이터 판단)

### 7.2 verify_level 승급 경로 — **서버 전용 확인**

`profiles` 컬럼 grant(`00003:186-189`)에 `verify_level`·`status`·`birth_date`·`role` 이 없고,
승급은 전부 service role 경유다: `promotePhoneVerified`/`promoteIdentityVerified`
(`lib/auth/verify.ts`), Lv3 승급/강등은 `lib/admin/photos.ts:142-153, 202-220`.
`role='admin'` 부여 UI 는 존재하지 않으며 DB 직접 변경만 가능(21_admin §2). **권한 상승 경로 없음.**
`promoteIdentityVerified` 는 CI 블랙리스트(`:137-145`) → 1인1계정(`:147-169`) → 미성년 판정
(`:171-181`) → CI 등록(`:183-200`) → 승급 순서로, 미성년 판정을 `birth_date` 덮어쓰기 **전에**
수행한다(`:172` 주석대로). 순서 설계는 정확하다. **문제는 입력값의 신뢰성뿐이다(G2-01).**

### 7.3 [G2-16 · Medium] 상태 변경을 수행하는 GET 엔드포인트

- **파일**: `apps/web/app/api/auth/verify-identity/route.ts:105-122`
- `GET /api/auth/verify-identity?token=stub:<userId>` 가 `runConfirm` 을 호출해 **Lv2 승급을
  수행**한다. GET 은 Next 의 Server Action Origin 방어 대상이 아니고 쿠키가 자동 전송되므로,
  stub 환경에서 공격자 사이트의 `<img src="https://…/api/auth/verify-identity?token=stub:…">`
  만으로 피해자를 Lv2 로 올릴 수 있다(userId 를 알아야 하므로 난이도는 있음).
- **권장 수정**: GET 은 E2E 전용임을 env 로 게이트(`IDENTITY_VERIFIER==='stub'` 일 때만 등록)
  하거나 제거하고, PortOne 리다이렉트 콜백은 state 파라미터 검증과 함께 별도 구현한다.
- **담당**: D2

### 7.4 3층 가드 자체는 정상

`middleware.ts:36-55`(세션 유무) → `lib/auth/guards.ts`(온보딩·제재·verify_level·admin) →
RLS 3층이 문서대로 동작한다. `/api/**` 는 리다이렉트 대신 401(`middleware.ts:46-48`)이고
각 Route Handler 가 자체 401 을 재확인한다(`route.ts:70-74`, `app/api/push/route.ts:63-91`).
`requireAdmin`(`guards.ts:96-102`)은 Server Action 에서도 동작하며 `lib/admin/*` 전 함수가
이를 재호출한다.

---

## 8. 입력 검증 / 인젝션 / XSS (점검항목 7)

### 8.1 SQL 인젝션 — **없음**

동적 SQL(`execute` + 문자열 결합)은 `00009_chat.sql:216-224` 한 곳뿐이며, 이는 마이그레이션
시점의 **정적 DDL 문자열**이라 사용자 입력이 개입할 수 없다. 모든 security definer 함수가
`set search_path = public, pg_temp` 를 선언했다(search_path 하이재킹 방어). 쓰기 성격
definer 함수는 전부 `revoke execute … from public, anon, authenticated`
(`00004:300-302`, `00008:613-621`, `00010:454-459`, `00011:219,279`) — 클라이언트 호출 가능한
것은 `submit_appeal`·`mark_read`·`can_access_match_topic`·`delete_my_account` 4개뿐이고
모두 내부에서 본인 검증을 한다.

### 8.2 [G2-23 · Low] PostgREST 필터 문자열 보간

- **파일**: `apps/web/lib/matching/queries.ts:361, 426, 554`,
  `supabase/functions/send-message/index.ts:135`
- `.or(\`and(a_id.eq.${profileId},b_id.eq.${targetId}),…\`)` 형태로 값을 문자열 결합한다.
  `send-message` 쪽 값은 DB 에서 온 UUID 라 안전하고, `queries.ts` 의 `targetId` 는
  `app/(main)/discover/actions.ts:71-81` 을 통해 클라이언트에서 온다 —
  **uuid zod 검증 없이** 그대로 보간된다.
- **영향**: `,`·`)` 를 포함한 값으로 필터 구조를 바꿀 수는 있으나, **RLS 가 여전히 적용되므로
  타인 데이터 열람으로는 이어지지 않는다.** 실질 영향은 오류/오탐 수준.
- **권장 수정**: `sendLikeAction`·`passAction`·`markRecommendationSeen` 입구에
  `z.string().uuid()` 를 적용하고, `.or()` 대신 `.in()`/체이닝을 쓴다.
- **담당**: D3/E2

### 8.3 [G2-24 · Low] 자체 마크다운 파서 — 이스케이프는 정확, 스킴 검증 누락

- **파일**: `apps/web/lib/legal/markdown.ts:24-38`, 소비처 `app/legal/[slug]/page.tsx:122`
- **이스케이프 순서는 정확하다**: `inline()` 이 **먼저** `escapeHtml`(`&<>"'` 5종) 을 적용한
  뒤에만 인라인 규칙을 태그로 바꾼다(`:29-37`). `"` 가 이미 `&quot;` 이므로
  `href="$2"` 속성 탈출이 불가능하고, 코드펜스는 `escapeHtml(block.join("\n"))`(`:132`),
  `headingId` 는 `[^\p{L}\p{N}]+` 로 정규화(`:47`)해 `id` 속성 주입도 막힌다.
  **HTML 원문 통과 경로 없음 — 주석의 보안 주장은 사실이다.**
- **유일한 결함**: 링크 스킴 화이트리스트가 없어 `[클릭](javascript:alert%281%29)` 이
  `href="javascript:…"` 로 렌더된다.
- **현재 악용 가능성 = 0**: 입력이 우리가 소유한 `apps/web/content/legal/*.md` 6개
  파일뿐이고(`lib/legal/documents.ts:15-26`, 빌드 타임 `force-static`), 유저 콘텐츠는 이
  파서를 거치지 않는다. 유저 텍스트(닉네임·bio·masked_body)는 전부 React 기본 이스케이프로
  렌더된다 — `dangerouslySetInnerHTML` 은 저장소 전체에서 이 1곳뿐이다.
- **권장 수정**: `:33-37` 의 링크 치환에
  `/^(https?:|mailto:|\/|#)/.test($2)` 가드를 추가(미통과 시 링크가 아닌 텍스트로 렌더).
- **담당**: E4

### 8.4 [G2-25 · Low] Open redirect — 백슬래시 우회

- **파일**: `apps/web/app/(auth)/login/page.tsx:23`
- `const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : "/home";`
  `//evil.com` 은 막지만 **`/\evil.com` 은 통과**한다. 다수 브라우저가 `\` 를 `/` 로 정규화해
  `//evil.com` 으로 해석하므로 `router.replace(next)`(`login-form.tsx:33`) 에서 외부 이동이
  발생할 수 있다.
- **권장 수정**: `/^\/(?![/\\])/` 로 교체하거나 `new URL(rawNext, origin).origin === origin` 확인.
- **담당**: D2/E1

### 8.5 [G2-13 · Medium] 마스킹 정규식 ReDoS

- **파일**: `supabase/functions/send-message/masking.ts:80-81`(R1), `:105-108`(R5)
- R1: `…[0-9O공영…]{1,2}(?:\s*[-–.·]?\s*[0-9O공영…]){6,8}` — 반복 단위 안에 `\s*` 가 선택적
  구분자를 사이에 두고 **두 번** 나온다. N개의 연속 공백을 두 `\s*` 로 나누는 방법이 N+1가지라,
  6~8회 반복과 결합하면 매치 실패 시 조합 폭발이 일어난다. 본문 상한이 2000자
  (`index.ts:29`)이므로 `"017" + ("1" + " ".repeat(60)).repeat(8) + "X"` 형태의 단일 메시지로
  Edge Function CPU 를 장시간 점유할 수 있다. R5 의 `\s*(?:\(|\s)*` 도 동일 패턴.
- **완화 요인**: 인증 + Lv2 + 매칭 성립이 선행 조건이라 무차별 공격 난이도는 있다.
- **권장 수정**: `(?:\s*[-–.·]?\s*X)` → `(?:[\s-–.·]{0,3}X)` 처럼 **모호성 없는 단일 문자 클래스**로
  치환하고, 본문 길이 상한을 정규식 적용 전 재확인. 회귀 방지용 최악 케이스 벤치를 남길 것.
- **담당**: D4

### 8.6 zod 스키마 커버리지

`lib/auth/schemas.ts`·`lib/moderation/schemas.ts`·`lib/notifications/schemas.ts` 가 유저
입력 경로를 대체로 덮는다. **누락 지점**:
- `app/(main)/discover/actions.ts` — `targetId`/`recommendationId` uuid 검증 없음 (→ G2-23)
- `app/(main)/chat/[matchId]/actions.ts` — `matchId` uuid 검증 없음
  (단 `send-message` Edge 가 `UUID_RE` 로 재검증: `index.ts:231`, 실피해 없음)
- `app/(admin)/**/actions.ts` — 모든 id 가 무검증 문자열. 어드민 전용이라 등급은 Low이나
  잘못된 값이 Postgrest 원문 에러로 화면에 노출된다(→ G2-27).

---

## 9. 레이트 리밋 / 남용 방지 (점검항목 8)

### 9.1 [G2-04 · High] 신고 남용 — 1계정으로 임의 다수를 72시간 침묵시킬 수 있다

- **파일**: `apps/web/lib/moderation/service.ts:95-105`,
  `supabase/migrations/00010_moderation.sql:69-72`
- **문제**: 레이트 리밋이 **`(reporter_id, target_id)` 24시간 1회** 뿐이다.
  신고자당 총량 제한, 대상과의 상호작용(매칭) 요구, 기각 이력 기반 제한이 전부 없다
  (`matchId` 는 optional — `schemas.ts:45`).
  한편 `apply_auto_sanctions()` 는 **P0 신고 단 1건**으로 level 2(72h 발신 정지)를 부과한다:

  ```
  00010_moderation.sql:70-71
    if new.priority = 'P0' and not v_has_active_restriction then
      v_rule := 'AUTO_P0_FREEZE';
  ```

  `triage_report()`(`00004:177-182`)는 `HARASS_THREAT`·`SCAM_ROMANCE`·`SAFETY_MINOR` 등
  10개 코드를 무조건 P0 로 분류한다 — 신고자가 사유를 고르므로 **P0 발동은 공격자 선택 사항**이다.
- **악용 시나리오**: 공격자가 탐색 카드·좋아요 목록에서 얻은 profile id 목록에 대해
  각각 `POST /api/reports {targetId, reasonCode:"HARASS_THREAT"}` 를 1회씩 보낸다.
  대상마다 즉시 level 2 제재 → 좋아요·매칭·채팅 발신이 72시간 정지된다.
  100명이면 100명이 침묵한다. 경쟁 서비스 방해·특정 커뮤니티 표적 공격에 그대로 쓰인다.
- **연쇄 악화(G2-05)**: 어드민이 기각(DISMISS)해도 `lib/admin/reports.ts:210-222` 는
  자동 제재를 해제하지 않는다. **무고가 확인돼도 피해자는 72시간을 채운다.**
- **A5 대비**: A5 §3.2 는 `AUTO_P0_FREEZE` 의 조치를 "**즉시 해당 매칭 채팅 발신 정지
  (대상자만)**" 로 규정했다. 현 구현은 **전역 level 2 제재**로 훨씬 넓다 — 스펙 초과 집행이다.
  또한 A5 §3.2 의 `AUTO_MASS_LIKE`, `AUTO_PATTERN_SCAM` 두 룰은 **미구현**이며,
  D5 §6-2 의 "30일 기각 5건 → 신고 기능 30일 제한"도 미집행(21_admin §7-6 자인).
- **권장 수정 (3개 모두 필요)**:
  1. `AUTO_P0_FREEZE` 의 조치를 A5 문언대로 **해당 매칭 한정**으로 좁힌다
     (예: `matches.status='closed'` + 그 방 발신만 차단). 전역 제재는 사람 확인 후에만.
  2. 신고자 총량 리밋 추가: 24h 내 신고 N건(예: 5) 초과 시 `RATE_LIMITED`.
     `matchId` 가 없는(=상호작용 없는) 대상 신고는 P0 자동 제재 대상에서 제외.
  3. 기각 5건/30일 → 신고 접수 제한을 `submitReportCore` 진입부에 구현.
- **담당**: D5 (+ 룰 조정은 A5 정책 확인)

### 9.2 [G2-12 · Medium] 메시지·좋아요·푸시 등록 레이트 리밋 부재

| 경로 | 현재 상태 |
|---|---|
| 메시지 발신 (`send-message/index.ts`) | **총량/속도 제한 없음.** 2000자 × 무제한 요청. `PAT_SCRIPT_DUP`(3개 매칭 동일 본문)은 사후 QUEUE 기록일 뿐 차단이 아니다 |
| 좋아요 | Lv1 일 3회만, Lv2+ 무제한. `AUTO_MASS_LIKE` **미구현** (G2-02 로 Lv1 제한도 우회 가능) |
| 푸시 토큰 등록 (`app/api/push/route.ts:104-116`) | 제한 없음. `(user_id, token)` unique 라 endpoint 만 바꾸면 무한 등록 → `pushToUser` 가 전 토큰을 순회(`push-dispatch/index.ts:66-119`)하므로 발송 증폭 |
| 차단/차단해제 | 제한 없음 (실피해 낮음) |
| `contact_messages` (anon) | 제한 없음 → G2-14 |
| 로그인 시도 | Supabase GoTrue 기본값에 의존 (앱 레벨 제한 없음) |

`moderation_flags` 의 `QUEUE` 액션(`send-message/moderation.ts`)이 **어드민 큐로 실제
전달되지 않는 점**도 함께 지적한다 — `reports` 행을 만들지 않으므로 D8 화면에 나타나지 않고,
`moderation_flags` 를 보여주는 어드민 화면도 없다. A5 §5.2 의 QUEUE 단계가 사실상 LOG 다.

- **권장 수정**: Edge Function 에 `messages` 카운트 기반 슬라이딩 윈도우(예: 30건/분,
  200건/시간) 추가. `push_tokens` 는 user 당 활성 토큰 상한(예: 10) 적용.
  `QUEUE` 액션은 `reports` 자동 생성(reporter_id=null, reason_code 매핑)으로 큐에 태울 것.
- **담당**: D4(메시지) / D3(좋아요) / D7(푸시) / D5(QUEUE 연결)

### 9.3 [G2-07 · High] push_tokens endpoint → Edge Function SSRF

- **파일**: `apps/web/lib/notifications/schemas.ts:14-21`,
  `supabase/functions/push-dispatch/webpush.ts:190`, `push-dispatch/index.ts:80-113`
- **문제**: 등록 스키마가 `endpoint: z.string().url().max(2048)` 뿐이다. 호스트·스킴
  화이트리스트가 없다. push-dispatch 는 저장된 값으로 그대로 `fetch(subscription.endpoint, …)`
  를 수행한다.
- **악용 시나리오**: 인증 유저가
  `POST /api/push {subscription:{endpoint:"http://169.254.169.254/latest/meta-data/", keys:{…}}}`
  를 등록한다. 다음 슬롯1 cron 또는 이벤트 발송 시 Edge Function(서비스 롤 키를 env 로 가진
  런타임)이 그 주소로 POST 한다. 응답 본문은 공격자에게 돌아오지 않지만
  (`WebPushResult` 는 status/gone 만 반환), **상태 코드·응답 시간으로 내부 네트워크 스캔**이
  가능하고, 임의 내부 엔드포인트에 대한 POST 부작용을 유발할 수 있다.
  또한 임의 외부 URL 로의 대량 발송(분산 반사) 도구로도 쓰인다.
- **권장 수정**: 등록 시점(`registerPushToken`)과 발송 시점(`sendWebPush`) **양쪽**에서
  검증한다. `https:` 스킴 강제 + 호스트 서픽스 화이트리스트
  (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`,
  `web.push.apple.com`, `*.push.apple.com`). 화이트리스트 밖이면 `INVALID_INPUT` 으로 거부.
- **담당**: D7

### 9.4 [G2-14 · Medium] `contact_messages` anon 무제한 INSERT + PII 적재

- **파일**: `supabase/migrations/00003_rls.sql:491-493`,
  `apps/web/app/(main)/settings/delete/actions.ts:56-67`
- `for insert to anon, authenticated with check (true)` — 비로그인 무제한 삽입.
  캡차·레이트리밋·중복 방지 없음. 4000자 본문 × 무한 = 저장소·운영 큐 오염.
- 추가로 탈퇴 폴백 경로가 **user_id·profile_id·email 을 본문에 평문 적재**한다. 이 테이블은
  개인정보 보유기간 관리 대상(`privacy.md`)에 잡히지 않은 저장소다.
- **권장 수정**: IP/세션 기반 레이트리밋을 Edge Function 으로 옮기거나, 최소한
  `handled_at is null` 미처리 건수 상한 트리거를 건다. 탈퇴 폴백은
  `delete_my_account()` 가 배포된 지금(`00013`) **불필요하므로 제거**한다.
- **담당**: D1 + E4

### 9.5 [G2-17 · Medium] 제재 회피 — level 3/4 중 탈퇴 후 재가입

- **파일**: `supabase/migrations/00013_account_deletion.sql:65`,
  `00007_identity_hashes.sql:9`
- `delete_my_account()` 는 활성 제재를 확인하지 않는다. `identity_hashes` 는
  `on delete cascade` 라 탈퇴 시 CI 매핑이 사라지고, `blocked_hashes` 에는 **level 5 만**
  등록된다(`00010:230-238`). 따라서 7일/30일 정지 중인 유저가 탈퇴 → 동일 CI 로 즉시 재가입해
  제재를 0으로 만들 수 있다.
- **권장 수정**: `delete_my_account()` 최상단에서 활성 level 3+ 제재를 확인해
  `SANCTION_ACTIVE` 로 거부하거나(A5 §4.3 파기 의무와 충돌하지 않도록 법무 확인 필요),
  탈퇴 시 CI 해시를 `blocked_hashes` 에 제재 종료일까지 유효한 형태로 이관한다.
- **담당**: D1/D5 (+ 법무 확인)

---

## 10. D8 이 남긴 G2 지적 5건 — 검증 결과

| # | D8 지적 | 판정 | 근거 |
|:-:|---|:---:|---|
| 1 | `lib/admin/*` 가 클라이언트 번들에 유입되는가 | **반박 (현재 안전)** | `(admin)` 하위 `"use client"` 0개. 클라이언트 42개 파일 전수 검사 결과 서버 모듈 값 import 0건(히트 3건은 전부 `import type`). `.next/static/` 에 service role 키 문자열·JWT 패턴 0건. 게다가 키가 `NEXT_PUBLIC_` 이 아니라 유입돼도 `undefined` 만 인라인된다. → **§4 참조. 규약 의존이라는 우려는 타당하나 실제 결함은 없다.** `server-only` 패키지 도입은 Low 권고(G2-26) |
| 2 | Lv5 선언식 4-eyes 우회 | **확인 (High)** | `lib/admin/service.ts:148-165` `verifyCoApprover` 는 닉네임으로 "본인 아닌 활성 admin" 임만 조회한다. 부승인자 세션·동의·확인 절차 없음. `resolveReport`(`reports.ts:235-242`)·`imposeSanction`(`users.ts:198-205`) 둘 다 이 함수만 통과하면 영구정지 + `blocked_hashes` 등록까지 단독 확정된다. 대조적으로 **이의제기 쪽은 진짜 4-eyes**(`appeals.ts:122-124`, 세션 실검증)라 구현 편차가 크다. DB 함수 `resolve_report()` 도 `p_second_admin_id` 를 파라미터로만 받아(`00010:181-189`) 동일 한계를 갖는다 — RPC 로 이관해도 이 문제는 해결되지 않으므로 **별도 승인 대기 테이블이 필요**하다 |
| 3 | RPC 미사용으로 인한 원자성 상실 | **확인 + 확대 (High, G2-05)** | D8 지적대로 `lib/admin/reports.ts:187-283` 은 `00010:144` 의 `resolve_report()` 를 쓰지 않는다(파일 상단 주석 `reports.ts:10` 의 "resolve_report DB 함수는 존재하지 않는다(00004 확인)"는 **사실과 다르다** — 00010 에 실재). 원자성 문제보다 **더 심각한 것은 자동 제재 미해제**다: RPC 는 `update sanctions set status='REVOKED' where report_id=… and created_by is null and status='ACTIVE'`(`00010:193-197`)를 수행하지만, 웹 구현에는 이 문장이 아예 없다. 결과적으로 기각된 무고 신고의 72h 제재가 그대로 집행된다(A5 §3.2 "자동 조치는 사람이 확정/해제" 위반). G2-04 와 결합해 **High 로 승격**하고 Blocker 로 분류한다 |
| 4 | 개인정보 열람 감사 커버리지 | **부분 인정 (Medium)** | evidence 열람은 감사된다(`reports.ts:134`). 미감사 항목 확인: `getUserDetail`(`users.ts:119-167`, 이메일 + 제재·신고 이력 + 감사로그 열람), `listPendingPhotos`(`photos.ts:52-106`, **사진 원본 서명 URL 일괄 발급**), `searchUsers`(`users.ts:38-104`, 이메일 스캔). A5 §4.1 "목적 제한" 추적 관점에서 최소한 **사진 서명 URL 발급과 이메일 조회는 감사 대상**이다. 다만 이는 사후 추적성 문제이지 접근 통제 결함은 아니므로 Phase 2 이월 가능 |
| 5 | Server Action 입력 신뢰 경계 | **부분 인정 (Low)** | 실제 IDOR 은 없다 — 모든 lib 함수가 `requireAdminActor()` 후 대상 존재·상태를 재검증한다(`resolveReport:196-205`, `approvePhoto:115-122`, `decideAppeal:105-119`). "어드민 = 전역 권한" 모델에서 대상 단위 스코프 부재는 설계상 정상이다. 남는 실 결함은 **uuid 형식 검증 부재로 Postgrest 원문 에러가 플래시에 노출되는 것**(21_admin §6-7 과 동일, → G2-27 Low). 지적의 문제의식은 타당하나 심각도는 낮다 |

**추가 확인**: 21_admin §6-6(CSRF, Next 기본 Origin 검증만) — 어드민 액션은 전부 Server Action
이라 Next 15 의 Origin/Host 검증이 적용된다. 별도 토큰이 없는 것은 수용 가능. 단 §7.3 의
`GET /api/auth/verify-identity` 는 그 방어 밖에 있다(G2-16).

---

## 11. Low 등급 잔여 항목

| ID | 항목 | 파일 | 권장 |
|---|---|---|---|
| G2-21 | 서명 URL 10분 재사용 | `lib/admin/photos.ts:44` | 만료 60~120초 + `Referrer-Policy: no-referrer` |
| G2-22 | chat-images 열람에 차단 검사 없음 | `00006_storage.sql:115-124` | `is_blocked` 조건 추가 |
| G2-23 | PostgREST 필터 문자열 보간 | `lib/matching/queries.ts:361,426,554` | uuid zod + `.in()` 사용 |
| G2-24 | 마크다운 `javascript:` 스킴 미차단 | `lib/legal/markdown.ts:33-37` | 스킴 화이트리스트 |
| G2-25 | open redirect 백슬래시 우회 | `app/(auth)/login/page.tsx:23` | `/^\/(?![/\\])/` |
| G2-26 | `server-only` 패키지 미사용 | `lib/supabase/server.ts` 등 | 의존성 허용 시 도입 (현재는 런타임 가드로 대체) |
| G2-27 | `DB_ERROR` 가 Postgrest 원문 노출 | `lib/admin/*`, `lib/chat/queries.ts:526` | 사용자 문구로 치환 + 원문은 서버 로그로 |
| G2-28 | `analytics_events` 위조 삽입 | `00003_rls.sql:476-478` | `created_at` revoke, `name` 화이트리스트 CHECK |
| G2-29 | send-message CORS `*` | `send-message/index.ts:36` | 앱 오리진으로 제한 |
| G2-30 | service key 비상수시간 비교 | `daily-recommendations/index.ts:55`, `push-dispatch/index.ts:262` | 상수 시간 비교 |
| G2-31 | 탈퇴 시 재인증 없음 | `settings/delete/actions.ts:33` | 비밀번호 재입력 또는 최근 인증 시각 확인 |
| G2-32 | 보안 헤더 전무 → G2-15 | `next.config.ts:5-14` | CSP·X-Frame-Options: DENY·Referrer-Policy·HSTS 추가 |
| G2-33 | 어드민 닉네임 `ilike '%q%'` | `lib/admin/users.ts:87` | 와일드카드 이스케이프(성능 방어) |

---

## 12. Phase 1 배포 가능 여부 — **조건부 불가**

### 판정

**현재 상태로는 배포 불가.** 단, 차단 사유는 아키텍처가 아니라 **6개의 국소 결함**이며,
전부 수정 규모가 작다. 근거를 등급별로 정리한다.

**배포를 막는 결정적 근거 (단독으로 차단):**
- **G2-01** — 만 19세 차단은 이 서비스의 법적 존재 조건이다(07_legal_checklist,
  `youth.md`, 09_store_policy). PortOne 미구현 상태에서 stub 을 켜면 게이트 2가
  **미성년 사실을 지우는 방향으로** 작동해(`birth_date := '1995-01-01'`) 3중 게이트가
  1중으로 축소된다. 이는 "정책 미흡"이 아니라 **정책의 역전**이다. §7.1 의 (b) 최소 수정만
  적용해도 게이트 3이 살아나므로, 최소한 그 수정 없이는 출시할 수 없다.

**함께 고쳐야 배포 가능한 근거:**
- **G2-04 + G2-05** — 두 결함이 결합하면 **계정 1개로 임의 다수를 72시간 침묵**시킬 수 있고
  무고가 확인돼도 되돌아가지 않는다. 안전 기능이 공격 도구가 되는 형태라, 초기 커뮤니티가
  한 번의 표적 공격으로 붕괴할 수 있다. G2-05 는 이미 D8 이 §7-1 에서 "(최우선)"으로
  자인한 항목이다.
- **G2-02 + G2-03** — 둘 다 `00003` 에 `revoke` 2줄을 추가하는 수준의 수정이다.
  방치하면 유료 아이템(슈퍼라이크)이 무한 발급되고, 분쟁 대응 기록(이의제기)이 위조 가능해진다.
- **G2-07** — `push-dispatch` 가 인증 유저가 지정한 임의 URL 로 요청을 보낸다. 호스트
  화이트리스트 한 줄로 닫히는 문제를 열어둔 채 서비스 런타임을 외부에 노출할 이유가 없다.

**배포를 막지 않는 근거 (Phase 2 이월 타당):**
- 데이터 격리의 핵심 축은 견고하다. `messages.body`·`reports.evidence` 는 컬럼 권한 +
  Realtime 퍼블리케이션 제외 + broadcast 화이트리스트 + `security_invoker` 뷰로 다중 방어되며,
  **어떤 클라이언트 경로로도 유출되지 않음을 확인**했다.
- RLS 는 35개 테이블 전부 활성이고 정책 누락 테이블이 없다. 차단 양방향 불가시는
  `is_blocked()` 를 통해 추천·좋아요·매칭·채팅·Realtime 토픽 인가까지 일관 적용된다.
- IDOR 은 유저·어드민 도메인 모두에서 발견되지 않았다.
- service role 키의 클라이언트 노출 경로가 없음을 정적·동적으로 확인했다.
- 결제 웹훅은 아직 코드가 없고, 계약이 fail-closed 로 설계되어 있어 Phase 3 착수 전
  보완(G2-19·20)으로 충분하다.
- G2-06(선언식 4-eyes)은 어드민 1인 운영 전제에서 실효 리스크가 낮다. **어드민이 2인 이상이
  되기 전까지**로 기한을 명시해 이월한다.

### 재검증 요청 (수정 후 G2 재리뷰 대상)

1. `IDENTITY_VERIFIER` 하드 페일 또는 stub 경로의 `birth_date` 비갱신 — 미성년 시나리오 재현 테스트
2. `revoke insert on likes / appeals` 후 PostgREST 직접 호출이 403 인지 확인
3. `AUTO_P0_FREEZE` 범위 축소 + 신고자 총량 리밋 동작 확인
4. `resolveReport` → `resolve_report()` RPC 이관 후, 기각 시 자동 제재가 `REVOKED` 되는지 확인
5. push endpoint 화이트리스트 적용 후 비허용 호스트 등록이 거부되는지 확인
