# 18 — 신고 · 제재 · 모더레이션 (D5)

> 입력: `14_schema.md`(§0-24~29 create_report·issue_sanction·apply_block·보존), `15_auth.md`(ActionResult·admin 클라이언트·함수 권한 회수·MINOR), `05_trust_safety.md`(§3 사유 14·§4 제재·§5 증거·§6 SLA·§7 룰·§8 사진·이의신청), `12_flows.md`(§7 신고 2단계·차단 모달·§8 제재 화면 4종), `07_legal_checklist.md`(보존기간·자동화 결정 고지), `08_legal_docs.md`(§0-15 운영 수치 = 코드 상수).
> 산출물: `supabase/migrations/20260902000040~43_*.sql`, `supabase/functions/moderation-{evidence,sla-check}/index.ts`, `apps/web/lib/moderation/{constants,types,rpc,actions,queries,admin,scam-score}.ts` + `constants.test.ts`.
> 기준일 2026-09-02. 로컬 PostgreSQL 16 에 0001~0014 + 0040~0043 적용·시나리오 검증 완료(§6). **UI 없음**(E3/E4/E5/D8 담당).

## 다음 에이전트에게 넘기는 결정사항

### E4/E5/E3 (신고·차단·제재·이의신청 화면) — 액션 시그니처·문구
1. **모든 유저 액션은 `ActionResult<T>`** (`lib/moderation/actions.ts`, `"use server"`). 문구는 `lib/moderation/constants.ts`(`REPORT_COPY`·`BLOCK_COPY`·`SANCTION_COPY`·`APPEAL_COPY`)가 C3 §7·§8 확정본을 그대로 담고 있으니 화면은 이 상수만 렌더한다.
2. **`submitReport({targetId, matchId?, reasonCode, detail?, surface?})`** → `{reportId, deduped, priority, autoActions, done:{title, sla, notify, blockDefaultChecked:true, blockCheckbox, blockHint, message}}`. `OTHER` 는 detail 필수(`INVALID_INPUT field=detail`, "기타는 내용을 적어 주세요"). 24h 재신고는 `deduped:true` + `done.message="이미 접수된 신고에 내용을 추가했어요"`. 실패는 부분 저장 없음 → `REPORT_COPY.failed`. 신고는 L0 부터 가능하므로 온보딩 중에도 호출 가능(`allowOnboarding`).
3. **2단 카테고리 = `REPORT_CATEGORIES`(5) → 14 코드**(C3 §7.2 순서 그대로). `categoryOf(code)`·`categoryLabelOf(code)`·`reasonMeta(code)`(라벨·보조문구·`requiresDetail`). `packages/db/src/report-categories.ts` 는 만들지 않는다 — 이 파일이 소스(REPORT_REASONS.category 와 일치함을 테스트로 고정).
4. **완료 화면 SLA 문구는 항상 "24시간 안에 확인해요"** (`slaCopyFor(priority)`, P3 만 "접수 확인 24h + 3일"). 공개 약속(company §0-12)과 동일. P0 1h 등 내부 목표는 화면에 쓰지 않는다.
5. **완료 화면 [완료] 시 체크 상태면 `blockProfile({targetId})`** → 채팅 진입이면 `/chat`, 프로필이면 `/reco`. 차단 모달은 `BLOCK_COPY` + `blockProfile`, 해제는 `unblockProfile` + `BLOCK_COPY.unblockConfirm`. 차단 목록은 `getBlockList()`(`lib/moderation/queries.ts`, 뷰 `v_my_blocks`: `blocked_id, blocked_nickname, blocked_verify_level, blocked_at`) — 14_schema §0-34 의 닉네임 문제 해결, `blocks.blocked_nickname` 컬럼 불필요. TanStack 키 `['blocks']`.
6. **제재 화면 분기는 `getMySanctions().screen`** = `none | modal(1) | banner(2) | suspended(3~5) | permanent(6)`. 값 = RPC `get_my_moderation_state()` (활성 제재 목록·최고 레벨·종료 시각·`pendingWarning`·`appeal`·`canAppeal`·`appealDeadline`). 정지 중(게이트 ③)에도 호출 가능. TanStack 키 `['sanctions']`.
7. **경고 모달(level 1)**: `pendingWarning` 이 있으면 다음 진입 1회 표시 → `acknowledgeSanction({sanctionId})` → `acknowledged_at`. 경고는 `ends_at=starts_at` 이라 "활성"에 안 잡히므로 `active` 가 아니라 `pendingWarning` 으로 판단한다.
8. **채팅 제한 배너(level 2)**: 방 상단 "채팅이 24시간 제한됐어요 · 사유: {카테고리} · 해제 {시각}" + 입력 비활성(RLS 도 거부). 상대가 level 2 면 아무 표시 없음.
9. **`/suspended`**: `top.level` 3~5 = "계정이 {N}일 정지됐어요"(`sanctionDurationDays`), 6 = "더 이상 이용할 수 없어요". [이의신청] 버튼은 `active[i].canAppeal` 이 true 인 제재에만(7일 내·미제출·미성년 확정 제외). 신고자 정보·원문 미노출.
10. **`submitAppeal({sanctionId, body})`** → `{appealId, status:'pending', decisionDueAt}`(72h). 실패 문구 매핑 완료: `NOT_ENTITLED` 7일 초과(`APPEAL_COPY.windowClosed`)/미성년/정지 아님, `ALREADY_ACTED` 중복. 판정 결과는 `getAppeal()`(`status accepted|rejected`, `decisionNote` 한 줄). 기각 후 재신청 불가.
11. **스캠 배너(E3)**: `partnerRiskBanner(matchId)`(RPC `partner_risk_banner`) 가 true 면 방 상단에 A5 §10.3 문구 + [신고하기](사유 `ROMANCE_SCAM` 프리셀렉트 = `REPORT_COPY.scamBannerPreselect`). 점수·시그널은 클라이언트에 주지 않는다. 배너 기한 7일(점수 창).
12. **분석 이벤트**: `report_submitted{reason_code, surface}` 는 `submitReport` ok 후 클라이언트가, `block_submitted{surface}` 는 `blockProfile` ok 후 — 서버 액션은 이벤트를 쏘지 않는다.

### D8 (어드민 UI) — 서버 함수·권한표
13. **어드민 함수는 전부 service role 전용 SQL(0043) + `p_actor_id`**(auth.users.id). 역할은 SQL 이 `admin_users` 에서 다시 판정(JWT·호출자 불신). TS 래퍼 `lib/moderation/admin.ts`(server-only) 가 `requireAdmin()` → `user.id` 를 actor 로 넘긴다. D8 은 래퍼만 호출하면 된다.
14. **함수 목록**: `adminModerationStats()` / `adminListReports(filter, cursor, limit)`(키셋 `priority,due_at,id`; filter `status[]·priority[]·reason_code·assignee('me'|'none'|uuid)·overdue·legal_hold·target_id`) / `adminGetReport(id)`(증거 jsonb + `evidence_photos[].signed_url` 10분, 열람 = `audit_logs(evidence_viewed)` 자동) / `adminTriageReport(id,{priority?, assigneeId?})`(queued→in_review, 우선순위 **상향만**) / `adminResolveReport(id, 'confirmed'|'dismissed'|'need_info', {sanctionLevel?, note?, durationHours?})` / `adminReviewPhoto(photoId, 'approved'|'rejected', {rejectCode, note})` / `adminSearchProfiles(q)` / `adminProfileDetail(id)`(+`photo_urls`) / `adminLiftSanction(id, note)` / `adminDecideAppeal(id, 'accepted'|'rejected', note)` / `adminSetLegalHold(reportId, bool, note)`.
15. **권한표**: moderator = 큐·상세·분류·`confirmed` level ≤3·`dismissed`/`need_info`·사진 검수·검색·상세·해제 level ≤3·통계. admin = + level 4~6·해제 level ≥4·이의신청 판정·legal_hold. SQL 이 `FORBIDDEN: level>=4 requires admin` 으로 거부(검증 §6).
16. **`confirmed` + level**: `suggested_level`(A5 §4.2 첫 확정 기본값)을 `adminGetReport` 가 준다 → 폼 프리필. 제재는 `issue_sanction(..., issued_by=actor)` 로 발급되고 같은 신고의 `AUTO:` 제재는 자동 종료(중복 방지). `dismissed` 는 `revert_auto_actions`: AUTO 제재 revoke·held 사진 pending 복구·MINOR_SUSPECT/SCAM_SCORE 비노출 해제·5명/90일 비노출은 다른 미종결 신고가 없을 때만 해제. **STALKING 자동 차단은 유지**(신고자 보호, A5 §4.4 "즉시 해제"의 예외 — 문서화).
17. **사진 검수 부수효과(A5 §8)는 SQL 이 수행**: `reject_not_self` 2회 → IMPERSONATION 자동 신고, `reject_nudity` → 경고(level 1), `reject_minor` → MINOR_SUSPECT P0(+비노출), `reject_text_contact` → audit 카운트. `recompute_verify_level` 은 0009 트리거가 자동(별도 호출 없음). `held` 사진도 approved/rejected 로 판정하면 `held_reason` 이 지워진다.
18. **SLA 배너 데이터**: `adminModerationStats()` 의 `overdue{P0..}`·`queue{}`·`appeals_overdue`·`jobs_failed`·`notifications_pending`, 목록은 `reports_overdue` 뷰(moderator JWT 로도 읽힘) 또는 `adminListReports({overdue:true})`. `due_in_sec` 로 카운트다운.
19. **legal_hold**: `adminSetLegalHold(true)` 는 admin 만, 파기 배치가 건너뜀. 해제 시 트리거가 `expires_at = max(기존, now+90d)`. 이미 파기된 신고(`evidence.purged_at`)에는 hold 불가.
20. **audit_logs 액션명(D8 조회용)**: `report_created`(D1) · `evidence_viewed` · `report_triaged` · `report_resolved` · `sanction_issued`(D1) · `sanction_lifted` · `appeal_submitted` · `appeal_decided` · `photo_reviewed` · `profile_viewed` · `profile_searched` · `legal_hold_changed` · `auto_moderation_applied` · `auto_moderation_error` · `sla_overdue` · `evidence_copied` · `evidence_purged` · `evidence_files_purged` · `profile_purged` · `moderation_job_failed`. `actor_role` 는 admin_users 의 값(`admin|moderator`), 시스템은 `system|service`.

### D7 (통보·배치) — 훅 인터페이스
21. **통보 큐 = `moderation_notifications`** (`audience admin|user, kind, profile_id, report_id, sanction_id, payload, delivered_at, delivery`). D5 는 `notify_admin(kind, payload, report_id?, sanction_id?)` / `notify_user(profile_id, kind, payload, …)` 로 insert 만 한다. **D7 배치가 `delivered_at is null` 행을 읽어 푸시/이메일/Slack 으로 전달하고 `delivered_at`·`delivery{channel,ok,error}` 를 갱신한다.** payload 에 신고자 신원·원문 없음(kind 별 키: `sanction_issued{level, reason_code, ends_at, appeal_deadline, appeal_route, can_appeal}`, `report_resolved{outcome, message_key:'report_resolved_generic'}`, `report_need_info`, `sanction_lifted`, `appeal_decided{decision, note}`, `photo_reviewed{decision, reject_code}`, admin: `sla_overdue{priority, reason_code, overdue_min}`, `appeal_submitted`, `moderation_job_failed`, `purge_summary`).
22. **SLA 감시**: `sla_check()`(service) — 초과 건마다 `audit_logs(sla_overdue)` + `notify_admin`, 재알림 간격 P0 30분/P1 6h/P2 24h/P3 주 1회(`moderation_settings.sla_renotify_minutes`). Edge Function `moderation-sla-check`(cron 15분)가 호출하고, `MODERATION_ALERT_WEBHOOK_URL` 이 있으면 admin 큐를 Slack 형식(`{text}`)으로 직접 전달·`delivered_at` 갱신, 없으면 큐에만 남긴다(D7 이메일).
23. **파기 배치 진입점 = `moderation_daily()`** (= `purge_expired_evidence()` + `purge_deleted_profiles()` + 배너 만료 정리). D7 `purge_daily` 에서 `select public.moderation_daily()` 한 줄로 호출하거나, pg_cron 이 있으면 0042 가 `dm_moderation_daily`(03:10 KST)·`dm_moderation_sla`(15분) 를 등록한다(확장 없으면 NOTICE 만).
24. **탈퇴 삭제 규칙(`purge_deleted_profiles`)**: `status='deleting' and delete_requested_at + 7d < now()` → `reports.*_ci_hash`·`sanctions.profile_ci_hash`·`consents(user_id→null, subject_hash=ci_hash)`·`identity_verifications(user null, is_active=false)` 채운 뒤 `auth.users` 삭제(cascade). 사진 파일은 `moderation_jobs(storage_delete)` 로 Edge Function 이 삭제(D2 `removeProfilePhotoObjects` 재사용 가능). **매칭 행은 profiles cascade 로 함께 사라진다**(스키마 제약: `matches.a_id/b_id on delete cascade`) — 상대에게 "탈퇴한 사용자" 방을 90일 남기려면 D1 이 FK 를 set null 로 바꾸는 별도 결정 필요(미결 §7).
25. **파일 작업 큐 = `moderation_jobs`** (`kind evidence_copy|evidence_purge|storage_delete`). Edge Function `moderation-evidence` 가 `claim_moderation_jobs(20)`(10분 리스, skip locked) → 처리 → `finish_moderation_job(id, ok, result, error)`(지수 백오프 1·2·4·8·16분, 5회 초과 failed + notify_admin). `reports` insert 트리거가 `evidence_copy` 를 자동 enqueue 하므로 **D1 §0-25 의 "복사 실패 시 need_info" 는 채택하지 않음**(need_info 는 신고자 추가 질문 의미; 실패는 job 상태 + admin 알림으로 분리).

### D4 (채팅) — 통합 지점
26. **D4 는 `message_flags` insert 만 하면 된다.** `trg_message_flags_auto_moderation`(AFTER INSERT) 이 SC_*(점수) · CT_*(같은 매칭 3회 → OFF_PLATFORM_LURE P2, 24h 내 2회 → SC_OFFAPP) · BW_VIOLENCE(→ THREAT_VIOLENCE P0 + 채팅 제한) · BW_ILLEGAL(→ OTHER, 증거 hit 로 P0 상향) · MN_*(MN_AGE 단독 또는 2종 → MINOR_SUSPECT P0) 를 처리한다. 트리거 안 예외는 삼키고 `audit_logs(auto_moderation_error)` 에 남기므로 메시지 insert 는 실패하지 않는다. 별도 함수 호출 불필요(`apply_auto_moderation(profile_id, match_id?)` 는 service 로 재계산할 때만).
27. **`message_flags.score`**: SC_* 룰의 hit 당 점수를 넣으면 SQL 이 그 값을 쓰고, 0 이면 `moderation_settings.scam_signal_weights` 표(SC_MONEY 3·SC_INVEST 3·SC_URGENT 2·SC_OFFAPP 2·SC_MASS_LIKE 2·SC_FAST_LOVE 1·SC_TEMPLATE 3). `SC_TEMPLATE`(3매칭 동일 문장)·`SC_FAST_LOVE` 는 D4 가 판정해 flag 로 넣는다(D5 는 파생 계산 안 함). `safety-rules.ts` 의 타입은 `lib/moderation/types.ts` 의 `SafetyRuleRef{id, category, score?}` 와 호환되게 — 파일이 생기면 D5 는 import 로 교체(병합 요청 §8).
28. **점수 → 조치**: 7일 롤링. ≥5 `moderation_flags.scam_banner_until`(상대 배너) + ROMANCE_SCAM 시스템 신고 P0(24h 중복 방지) — **D1 `create_report` 내장 규칙이 이 시점에 채팅 제한 24h 를 건다**(A5 §3 표의 ROMANCE_SCAM 자동 조치와 일치; §7.3 의 "≥8 부터 제한"보다 앞선다, 정책 문서 간 차이를 D1 규칙으로 통일). ≥8 추가로 `profiles.hidden_at(hidden_reason='SCAM_SCORE')` + (없으면) `AUTO:SCAM_SCORE` level 2. 상한 level 2.
29. **오탐 강등**: `moderation_settings.warn_only_rules`(jsonb 배열)에 rule_id 를 넣으면 점수·자동 조치에서 제외(트리거 진입 자체 skip). 룰 hit 통계는 `v_rule_hit_stats`(loop_date, rule_id, hits, senders). 오탐률 20% 판단은 D8 대시보드.
30. **시스템 신고 호출 방식**: 트리거는 사용자 JWT 안에서 돌기 때문에 `run_report_as_service()` 가 `request.jwt.claims`·`request.jwt.claim.role/sub` GUC 를 호출 구간만 `service_role` 로 치환한 뒤 `create_report(…, 'system', null)` 을 부르고 복원한다(트랜잭션 로컬, 검증 §6 "jwt restored"). 이 함수는 service_role 에도 grant 하지 않는다 — 서버에서 시스템 신고가 필요하면 `create_report` 를 service 로 직접 호출.

### D1 / G2 (스키마·보안 리뷰 포인트)
31. **새 테이블 4개는 RLS enable + 정책 없음 + `revoke all … from anon, authenticated` 명시**(default privileges 방어, 15_auth §0-28 확장). 새 함수 24개 전부 `revoke execute from public, anon, authenticated` 후 필요한 롤에만 grant. 검증: authenticated 가 `apply_auto_moderation/admin_*/sla_check/purge_*`·`moderation_settings` 접근 시 42501.
32. **service role 진입점은 `lib/moderation/admin.ts`(server-only) 하나**. 모든 admin 함수는 actor 를 인자로 받아 SQL 이 역할을 재확인하므로, D8 라우트가 잘못 호출해도 admin_users 에 없는 actor 는 `FORBIDDEN`. 증거 서명 URL 10분, 열람은 반드시 `evidence_viewed` audit 뒤.
33. **자동화 결정 고지(B1 §0-10)**: 자동 조치는 전부 `sanctions.reason='AUTO:*'`·`reports.surface='system'`·`audit_logs(auto_moderation_applied)` 로 식별 가능하고 `get_my_moderation_state().active[].is_auto` 로 화면에 "자동 조치" 표시 가능. 이의신청 창구는 정지(≥3)만 — 자동 조치(1·2)는 "설명 요구" 를 문의 폼(`inquiries.category='report'`)으로 받는다(E5 문구: "이의신청은 정지 시에만").
34. **운영 수치 단일 소스 = `moderation_settings`**(SQL) ↔ `MODERATION_RULES`(TS, 테스트로 고정). 값 변경 = 마이그레이션 + constants + 08_legal_docs §0-15 MAJOR bump 를 한 PR 에.
35. **`Database["public"]["Functions"]` 델타**는 `lib/moderation/types.ts` 의 `ModerationFunctions` 에 정리했다. 병합 전까지 `lib/moderation/rpc.ts` 의 `moderationRpc(client, name, args)` 가 타입을 대신 준다(병합 후 파일 삭제).

---

## 1. 파이프라인

```mermaid
flowchart LR
  subgraph 접수
    U[사용자 submitReport] --> CR[create_report D1<br/>dedupe·스냅샷·priority·자동조치]
    D4[D4 message_flags insert] --> TR[trg_message_flags_auto_moderation]
    TR -->|SC_* 점수≥5 / CT_*×3 / BW_VIOLENCE·ILLEGAL / MN_*| RS[run_report_as_service → create_report system]
    PH[admin_review_photo 반려] -->|not_self×2 / minor| RS
    ID[apply_identity_verification D2] -->|생년 불일치| CR
  end
  CR --> Q[(reports queued<br/>due_at = SLA)]
  RS --> Q
  CR -->|AFTER INSERT| J[(moderation_jobs evidence_copy)]
  J --> EF[Edge moderation-evidence<br/>photos → evidence/{report}/]
  subgraph 분류·처리
    Q --> L[admin_list_reports]
    L --> T[admin_triage_report<br/>in_review·priority↑]
    T --> R{admin_resolve_report}
    R -->|confirmed + level| S[issue_sanction<br/>mod ≤3 · admin ≤6]
    R -->|dismissed| RV[revert_auto_actions]
    R -->|need_info| NI[신고자 추가 질문]
  end
  subgraph 감시·통보
    Q --> SLA[sla_check 15분<br/>audit sla_overdue]
    SLA --> NQ[(moderation_notifications)]
    S --> NQ
    R --> NQ
    NQ --> D7[D7 push/email/Slack]
    NQ --> SC[Edge moderation-sla-check<br/>webhook 선택]
  end
  subgraph 이의·보존
    S --> AP[submit_appeal 7일·1회] --> AD[admin_decide_appeal 72h<br/>accepted → lift]
    R --> EX[expires_at 90/180d·5y·legal_hold]
    EX --> PG[moderation_daily<br/>purge_expired_evidence · purge_deleted_profiles]
    PG --> J2[(moderation_jobs evidence_purge / storage_delete)] --> EF
  end
```

## 2. 제재 매트릭스

| level | 효과 | 자동 | 발급 권한 | 이의신청 | 해제 권한 |
|---|---|---|---|---|---|
| 1 경고 | 모달 확인(`acknowledge_sanction`), 기능 제한 없음 | O(사진 nudity·3회 누적 카운트) | moderator+ | 불가(문의 폼) | moderator+ |
| 2 채팅 제한 24h | 메시지·좋아요 불가(RLS `can_send_message/can_like` <2) | O(사유별·누적 3명/30일·점수≥8·경고 3회) | moderator+ | 불가 | moderator+ |
| 3 정지 3일 | `/suspended`, 비노출 | X | moderator+ | 7일·1회 | moderator+ |
| 4 정지 7일 | 동상 | X | **admin** | 7일·1회 | admin |
| 5 정지 30일 | + 매칭 `paused`(해제해도 미복구) | X | admin | 7일·1회 | admin |
| 6 영구 | `banned` + CI 블록 5년 | 미성년 확정만 | admin | 7일·1회(미성년 확정 제외) | admin(계정 복구 + 그 제재의 CI 블록 삭제) |

첫 확정 기본값(`suggested_level`): ROMANCE_SCAM 6 · MINOR_SUSPECT 6 · THREAT_VIOLENCE 5 · STALKING 4 · SEXUAL_HARASSMENT/IMPERSONATION/COMMERCIAL_SPAM/INAPPROPRIATE_PHOTO 3 · HATE_SPEECH 2 · PII_REQUEST/OFF_PLATFORM_LURE/FAKE_PROFILE/NO_SHOW 1 · OTHER 수동. 재범 가중은 담당자가 `prior_sanctions` 를 보고 올린다(자동 아님).

## 3. 자동 조치 표

| 트리거 | 조건 | 조치 | 구현 위치 |
|---|---|---|---|
| 신고 사유 | ROMANCE_SCAM·THREAT_VIOLENCE·INAPPROPRIATE_PHOTO 즉시 / SEXUAL_HARASSMENT·COMMERCIAL_SPAM 2건 | level 2 24h | D1 `create_report` |
| 누적 신고 | 서로 다른 신고자 3명/30일 | level 2 + P1 상향 | D1 `create_report`(재사용) |
| 누적 신고 | 5명/90일 | 비노출 `CUMULATIVE_5_90D` | D1 `create_report` |
| IMPERSONATION·INAPPROPRIATE_PHOTO | 신고 접수 | 사진 `held` | D1 |
| MINOR_SUSPECT | 신고 접수 | 비노출 + 재인증(성인 인증 시 D2 자동 복구) | D1 |
| STALKING | 신고 접수 | 신고자↔대상 자동 차단(dismissed 시에도 유지) | D1 |
| 스캠 점수 | ≥5 / 7일 | 상대 배너 + ROMANCE_SCAM P0 시스템 신고(→ level 2) | 0041 `apply_auto_moderation` |
| 스캠 점수 | ≥8 | + 비노출 `SCAM_SCORE`, `AUTO:SCAM_SCORE` level 2 | 0041 |
| CT_* | 같은 매칭 3회 | OFF_PLATFORM_LURE P2 시스템 신고(매칭당 1회) | 0041 트리거 |
| BW_VIOLENCE / BW_ILLEGAL | 1회 | THREAT_VIOLENCE P0(+level 2) / OTHER(hit 로 P0) | 0041 트리거 |
| MN_* | MN_AGE 단독 또는 2종/7일 | MINOR_SUSPECT P0 | 0041 트리거 |
| 경고 누적 | level 1 × 3 / 12개월 | `AUTO:WARNINGS_n` level 2 | 0041 `trg_sanctions_warning_accumulation` |
| 사진 반려 | not_self 2회 / nudity / minor | IMPERSONATION 신고 / 경고 / MINOR_SUSPECT P0 | 0043 `admin_review_photo` |
| dismissed | 담당자 판정 | AUTO 제재 revoke·held 복구·비노출 해제 | 0043 `revert_auto_actions` |

## 4. 파일 구성

| 경로 | 내용 |
|---|---|
| `migrations/…0040_moderation_core.sql` | `moderation_settings`(18키)·`moderation_flags`·`moderation_notifications`·`moderation_jobs`, `notify_admin/notify_user`, `claim/finish_moderation_job`, 뷰 `v_my_blocks`·`reports_overdue`·`v_rule_hit_stats`, RPC `acknowledge_sanction`·`submit_appeal`·`get_my_moderation_state`·`partner_risk_banner` |
| `…0041_auto_moderation.sql` | `run_report_as_service`, `system_report_exists`, `compute_scam_score`, `apply_auto_moderation`, 트리거 3(message_flags·sanctions·reports×2), `sla_check` |
| `…0042_retention.sql` | `purge_expired_evidence`, `purge_deleted_profiles`, `purge_expired_moderation_flags`, `moderation_daily`, pg_cron 멱등 등록 |
| `…0043_admin_functions.sql` | `assert_moderator/assert_admin/admin_audit`, `admin_list_reports`·`admin_get_report`·`admin_triage_report`·`revert_auto_actions`·`admin_resolve_report`·`admin_review_photo`·`admin_search_profiles`·`admin_profile_detail`·`admin_lift_sanction`·`admin_decide_appeal`·`admin_set_legal_hold`·`admin_moderation_stats` |
| `functions/moderation-evidence/index.ts` | 작업 큐 처리(복사·파기·삭제), 웹훅 `{report_id}` 또는 cron 드레인. 인증: service Bearer 또는 `MODERATION_WEBHOOK_SECRET` |
| `functions/moderation-sla-check/index.ts` | `sla_check()` + admin 큐 webhook 전달(`MODERATION_ALERT_WEBHOOK_URL` 선택) |
| `lib/moderation/constants.ts` | 카테고리 5→14, 문구 4종, `MODERATION_RULES`, `SCAM_SIGNAL_WEIGHTS`, 사진 반려 부수효과, 권한표 |
| `lib/moderation/scam-score.ts` | `computeScamScore` TS 미러(어드민 표시·테스트) |
| `lib/moderation/types.ts` | 액션/어드민 결과 타입, `SafetyRuleRef`(D4 최소 인터페이스), `ModerationFunctions` 델타 |
| `lib/moderation/rpc.ts` | 타입 미병합 RPC 호출 헬퍼(임시) |
| `lib/moderation/actions.ts` | `submitReport·blockProfile·unblockProfile·acknowledgeSanction·submitAppeal` |
| `lib/moderation/queries.ts` | `getBlockList·getMySanctions·getAppeal·partnerRiskBanner` |
| `lib/moderation/admin.ts` | 어드민 래퍼 12 + `runModerationDaily/runSlaCheck` |
| `lib/moderation/constants.test.ts` | 카테고리 전수·문구·수치·점수 미러 11 테스트 |

## 5. 보존·파기 (07_legal §14 대조)

| 대상 | 기간 | 구현 |
|---|---|---|
| 신고 증거 dismissed / confirmed / 영구정지 | 90일 / 180일 / 5년 (`handled_at` 기준, D1 트리거) | `purge_expired_evidence`: evidence→tombstone(`purged_at`), detail null, 파일은 `evidence_purge` job |
| legal_hold | 해제까지 + 90일 | `trg_reports_legal_hold_release` |
| 탈퇴 | 7일 유예 후 삭제, 신고/제재/CI/동의(가명)/결제/감사 보존 | `purge_deleted_profiles` |
| 스캠 배너 | 7일 | `purge_expired_moderation_flags` |
| 통보 큐·작업 큐 | (D7) `delivered_at`/`done` 30일 후 삭제 권장 — 미구현(병합 요청) | — |

## 6. 검증 결과 (2026-09-02)

환경: 로컬 PostgreSQL 16.13 + Supabase 셰임(auth/storage/롤/default privileges, 레포 미포함) → `0001~0014 + 0040~0043` + `seed.sql` 순서 적용(경고 0, pg_cron 부재는 NOTICE). Docker 없음 → `supabase start`·Edge Function 실행·Storage 복사는 미실행(D7/오케스트레이터 재확인 필요).

| 시나리오 | 결과 |
|---|---|
| 신고 제출(서윤→민재, chat) | P1, evidence messages 3·photos 2, `evidence_copy` job pending / 24h 재신고 `deduped:true` + detail append |
| authenticated 가 service 전용 함수·`moderation_settings` 접근 | `apply_auto_moderation`·`admin_list_reports`·`sla_check`·`purge_expired_evidence`·테이블 전부 42501 |
| 차단/해제 + `v_my_blocks` | 닉네임 "하은" 표시 → 해제 후 0 |
| 서로 다른 신고자 3명/30일 | 3번째 신고에 `chat_restricted_24h`, level 2, priority P1 (D1 규칙 재사용) |
| 스캠 점수(사용자 세션에서 definer 가 flag insert → 트리거) | SC_MONEY 3 → SC_INVEST 6: 배너 on·`partner_risk_banner`=true·ROMANCE_SCAM P0 시스템 신고(reporter null)·`AUTO:ROMANCE_SCAM` level 2 → SC_URGENT 8: 비노출 `SCAM_SCORE`·restricted. JWT GUC 복원 확인, `auto_moderation_error` 0 |
| 채팅 제한 사용자의 메시지 insert | RLS 거부(정상) |
| CT_* 3회 같은 매칭 | OFF_PLATFORM_LURE 시스템 신고 1건 |
| `warn_only_rules=["SC_URGENT"]` | 점수 재계산 8→(제외) 확인 |
| 어드민 큐/상세/분류 | stats·P0 필터·키셋 next_cursor·`suggested_level`·`in_review` 배정, 비관리자 actor 42501 |
| moderator level 4 / admin level 4 | `FORBIDDEN: level>=4 requires admin` / 발급 성공, level 4, `user:sanction_issued`+`user:report_resolved` 통보 큐 |
| dismissed → 자동 조치 해제 | `sanctions_revoked:1`, 도현 level 2→0 |
| 사진 검수 `reject_minor` | rejected + MINOR_SUSPECT 시스템 신고, 대표 아닌 사진이라 L3 유지 |
| 검색·상세 | 1건 / 키 10종(hash 미노출) |
| 이의신청 | level 4 제재 → pending / 중복 `ALREADY_ACTED` / 8일 전 제재 `NOT_ENTITLED: appeal_window_closed` + RLS 직접 insert 도 거부 / moderator 판정 42501 / admin accepted → level 4 revoke(다른 신고의 `AUTO:ROMANCE_SCAM` level 2 는 유지 → 2) |
| 경고 3회/12개월 | `AUTO:WARNINGS_3` level 2 자동 발급 |
| SLA | overdue 건 audit+notify, 2회째 호출 재알림 0(간격), `reports_overdue` 뷰 |
| legal_hold | hold 건은 purge 가 건너뜀(evidence 유지), 나머지 purge + `evidence_purge` job, 해제 시 expires +90d |
| 작업 큐 | claim → finish(fail) → attempts 1, next_attempt 미래, pending 유지 |
| 탈퇴 유예 삭제 | 8일 전 요청 도현: profile·auth 삭제, reports 3·sanctions 1 에 `ci_hash` 보존, consents 4행 가명화(`user_id` null), 사진 없음 → `storage_delete` job 0(정상) |
| audit | admin/moderator actor_role 행 다수, 액션 20종 기록 |
| 경고 확인·anon | `pending_warning` → `acknowledge_sanction` / anon 전부 42501 |
| `pnpm --filter @duckmate/web typecheck` | **`lib/moderation` 오류 0**. (동시 작업 중인 `lib/admin/{actions,api}.ts`(D8) 에 오류 3건 — D8 경로) |
| `vitest run lib/moderation` | 11 통과. 전체 `pnpm --filter @duckmate/web test` 는 206 중 2 실패 — `lib/push/templates.test.ts`(D7 경로) |
| 동시 작업 마이그레이션과의 정합 | 전체 세트(0020~0060 포함) 적용도 오류 0. 단 D4 `0030_chat` 이후 `messages` 의 authenticated 직접 insert 권한이 회수됨(RPC 전용 설계) → 본 시나리오는 0001~0014+004x 로 검증했고, 실 환경에서는 D4 `send_message` 가 insert + `message_flags` 를 넣으면 트리거 경로가 동일하게 동작한다 |
| 비밀값 grep | 없음(env 키 이름만) |

## 7. 미결·후속

- **탈퇴 시 매칭 보존**: `matches.a_id/b_id on delete cascade` 라 상대 화면의 "탈퇴한 사용자" 방(90일)이 불가. D1 이 FK 를 `set null` 로 바꾸고 `v_my_matches` 가 null 파트너를 "탈퇴한 사용자" 로 표시하도록 결정 필요. 현재는 신고 증거만 남는다.
- 스캠 점수 ≥5 시점에 D1 `create_report(ROMANCE_SCAM)` 내장 규칙이 채팅 제한까지 걸린다(A5 §3 vs §7.3 차이). 정책 쪽에서 "≥5 는 배너만" 을 원하면 D1 이 system surface 의 ROMANCE_SCAM 자동 제한을 제외해야 한다.
- 매칭 종료·차단 후 `paused` 매칭 복구(level 5 해제)는 미구현(상대 의사 불명).
- `NO_SHOW` 3회 → 이벤트 참가 제한은 Phase 5(events) 에서.
- 시스템 신고에 대한 D1 dedupe 는 없음 → D5 가 `system_report_exists`(24h) 로 대체. 종결 후 24h 지나면 재신고 가능(의도).

## 8. 병합 요청

| 대상 | 요청 |
|---|---|
| D1 `packages/db/src/types.ts` | `ModerationFunctions`(`lib/moderation/types.ts`) 를 `Functions` 에 병합, Tables 에 `moderation_settings/flags/notifications/jobs`, Views 에 `v_my_blocks/reports_overdue/v_rule_hit_stats` 추가 → `lib/moderation/rpc.ts` 삭제 |
| D4 `packages/db/src/safety-rules.ts` | 룰 타입을 `SafetyRuleRef{id, category:'CT'|'BW'|'SC'|'MN', score?}` 호환으로; `send_message` 는 `message_flags` insert 만(트리거가 처리). SC_* 는 `score` 채우기 권장 |
| D7 | `moderation_notifications` 전달 배치 + `delivered_at` 갱신; `purge_daily` 에서 `moderation_daily()` 호출; 큐 정리 30일; Edge cron 등록: `moderation-sla-check` 15분, `moderation-evidence` 5분 |
| D8 | 어드민 UI 는 `lib/moderation/admin.ts` 만 호출. `(admin)` 라우트에서 `requireAdmin` 후 사용. `lib/admin/{actions,api}.ts` typecheck 오류 3건 확인 요망(`SanctionLevel|0`, `Database` 제네릭) |
| env / secrets | Edge secrets: `MODERATION_WEBHOOK_SECRET`(선택, DB 웹훅용), `MODERATION_ALERT_WEBHOOK_URL`(선택, Slack). web 은 추가 env 없음 |
| Supabase 대시보드 | DB Webhook `reports INSERT → moderation-evidence`(선택; 없으면 5분 cron 드레인). `pg_cron` 확장 활성 시 0042 재실행으로 등록 |
| E5 문구 | `inquiries.category='report'` 를 "자동 조치 설명 요구" 창구로 안내(B1 §0-10) |
