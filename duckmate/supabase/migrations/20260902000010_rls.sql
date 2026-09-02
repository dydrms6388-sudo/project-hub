-- =============================================================================
-- 0010 — RLS: 모든 테이블 enable + 정책 + 컬럼 권한 + 뷰
-- 원칙 (브리프/PRD §0-38):
--   · 자기 행만 쓰기 · 매칭 상대는 프로필 읽기만(can_view_profile) · 차단 양방향 비가시
--   · 사진은 approved 만 타인 노출 · 신고/제재/감사로그/consents 이력/identity 는 본인 insert 또는 service role
--   · admin/moderator = auth.jwt()->app_metadata->role (admin_users 는 레지스트리, app_role() 참조)
--   · messages.body 원문은 sender 본인 + service role 만: 컬럼 권한으로 authenticated select 제거 + v_messages 뷰
-- service_role 은 RLS 를 우회한다(정책 불필요). anon 은 공개 참조 테이블만.
-- =============================================================================

-- 헬퍼: 컬럼 권한 재설정을 위해 authenticated/anon 의 테이블 권한을 일괄 회수한 뒤 필요한 것만 재부여
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------- 추가 헬퍼: 채팅 이미지 가능 여부 (양쪽 L3 + 매칭 24h) ----------
create or replace function public.can_send_chat_image(p_match_id uuid, p_sender uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.profiles a on a.id = m.a_id
    join public.profiles b on b.id = m.b_id
    where m.id = p_match_id and m.status = 'active'
      and p_sender in (m.a_id, m.b_id)
      and a.verify_level >= 3 and b.verify_level >= 3
      and m.matched_at + interval '24 hours' <= now()
  )
$$;
grant execute on function public.can_send_chat_image(uuid, uuid) to authenticated, service_role;

-- 헬퍼: 좋아요 가능 여부 (RLS insert 정책과 D3 send_like RPC 가 공유)
--   양쪽 L2·active, 같은 모드, 차단 없음, 대상 비노출/정지 아님, 보낸 쪽 제재 < 2, 대상이 최근 추천에 있음
create or replace function public.can_like(p_from uuid, p_to uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_from is not null and p_to is not null and p_from <> p_to
    and exists (
      select 1 from public.profiles me join public.profiles t on t.id = p_to
      where me.id = p_from
        and me.verify_level >= 2 and me.status = 'active'
        and t.verify_level >= 2 and t.status = 'active' and t.hidden_at is null
        and t.mode = me.mode
    )
    and public.active_sanction_level(p_from) < 2
    and public.active_sanction_level(p_to) < 3
    and not public.are_blocked(p_from, p_to)
    and public.is_recommended_recently(p_from, p_to)
$$;
grant execute on function public.can_like(uuid, uuid) to authenticated, service_role;

-- 헬퍼: 메시지 전송 가능 여부 (RLS insert 정책과 D4 RPC 가 공유)
create or replace function public.can_send_message(p_match_id uuid, p_sender uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.profiles a on a.id = m.a_id
    join public.profiles b on b.id = m.b_id
    where m.id = p_match_id and m.status = 'active'
      and p_sender in (m.a_id, m.b_id)
      and a.verify_level >= 2 and b.verify_level >= 2
      and a.status = 'active' and b.status = 'active'
      and not public.are_blocked(m.a_id, m.b_id)
      and public.active_sanction_level(p_sender) < 2
  )
$$;
grant execute on function public.can_send_message(uuid, uuid) to authenticated, service_role;

-- =============================================================================
-- enable RLS on every table
-- =============================================================================
alter table public.app_settings            enable row level security;
alter table public.regions                 enable row level security;
alter table public.admin_users             enable row level security;
alter table public.profiles                enable row level security;
alter table public.hobby_categories        enable row level security;
alter table public.hobbies                 enable row level security;
alter table public.profile_hobbies         enable row level security;
alter table public.quiz_questions          enable row level security;
alter table public.quiz_answers            enable row level security;
alter table public.availability            enable row level security;
alter table public.photos                  enable row level security;
alter table public.consents                enable row level security;
alter table public.legal_documents         enable row level security;
alter table public.identity_verifications  enable row level security;
alter table public.blocked_ci_hashes       enable row level security;
alter table public.daily_recommendations   enable row level security;
alter table public.likes                   enable row level security;
alter table public.matches                 enable row level security;
alter table public.blocks                  enable row level security;
alter table public.messages                enable row level security;
alter table public.message_flags           enable row level security;
alter table public.reports                 enable row level security;
alter table public.sanctions               enable row level security;
alter table public.appeals                 enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.inquiries               enable row level security;
alter table public.skus                    enable row level security;
alter table public.sku_price_history       enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.payments                enable row level security;
alter table public.item_ledger             enable row level security;
alter table public.boosts                  enable row level security;
alter table public.refund_requests         enable row level security;
alter table public.game_profiles           enable row level security;
alter table public.game_sessions           enable row level security;
alter table public.quests                  enable row level security;
alter table public.quest_progress          enable row level security;
alter table public.events                  enable row level security;
alter table public.event_rsvps             enable row level security;
alter table public.push_subscriptions      enable row level security;
alter table public.notification_log        enable row level security;
alter table public.analytics_events        enable row level security;

-- =============================================================================
-- 공개 참조 테이블 (anon + authenticated 읽기)
-- =============================================================================
grant select on public.regions, public.hobby_categories, public.hobbies, public.quiz_questions,
  public.legal_documents, public.skus to anon, authenticated;

create policy regions_read          on public.regions          for select to anon, authenticated using (true);
create policy hobby_categories_read on public.hobby_categories for select to anon, authenticated using (true);
create policy hobbies_read          on public.hobbies          for select to anon, authenticated using (true);
create policy quiz_questions_read   on public.quiz_questions   for select to anon, authenticated using (true);
create policy legal_documents_read  on public.legal_documents  for select to anon, authenticated using (true);
create policy skus_read_active      on public.skus             for select to anon, authenticated using (is_active and retired_at is null);

-- app_settings / blocked_ci_hashes / message_flags / audit_logs / sku_price_history: service role 전용 (정책 없음)
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
grant select on public.audit_logs to authenticated;

-- =============================================================================
-- admin_users
-- =============================================================================
grant select on public.admin_users to authenticated;
create policy admin_users_self_read  on public.admin_users for select to authenticated using (user_id = auth.uid());
create policy admin_users_admin_read on public.admin_users for select to authenticated using (public.is_admin());

-- =============================================================================
-- profiles — 본인 행 전체 / 타인은 v_profile_public 뷰로만
-- =============================================================================
grant select on public.profiles to authenticated;
grant update (nickname, nickname_changed_at, gender, seeking_gender, region_code, bio, now_into,
              onboarding_step, onboarding_completed_at, safety_modal_seen_at, last_active_at)
  on public.profiles to authenticated;
-- verify_level / status / mode / birth_date / hidden_* / banned_at / delete_requested_at / phone_hash 는 RPC(service·definer) 전용

create policy profiles_self_read  on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_mod_read   on public.profiles for select to authenticated using (public.is_moderator());
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- profile_hobbies / quiz_answers / availability — 본인 전체, 타인은 카드 표시용 읽기
-- =============================================================================
grant select, insert, update, delete on public.profile_hobbies, public.quiz_answers, public.availability to authenticated;

create policy profile_hobbies_self on public.profile_hobbies for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy profile_hobbies_viewable on public.profile_hobbies for select to authenticated
  using (public.can_view_profile(public.current_profile_id(), profile_id));
create policy profile_hobbies_mod_read on public.profile_hobbies for select to authenticated using (public.is_moderator());

create policy quiz_answers_self on public.quiz_answers for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

create policy availability_self on public.availability for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy availability_viewable on public.availability for select to authenticated
  using (public.can_view_profile(public.current_profile_id(), profile_id));

-- =============================================================================
-- photos — 본인 업로드/정렬/삭제, 검수 컬럼은 서버 전용, 타인은 approved 만
-- =============================================================================
grant select, insert, delete on public.photos to authenticated;
grant update (is_primary, sort_order) on public.photos to authenticated;

create policy photos_self_read   on public.photos for select to authenticated using (profile_id = public.current_profile_id());
create policy photos_self_insert on public.photos for insert to authenticated
  with check (profile_id = public.current_profile_id() and review_status = 'pending' and reject_code is null
              and reviewed_by is null and public.active_sanction_level(profile_id) < 3);
create policy photos_self_update on public.photos for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy photos_self_delete on public.photos for delete to authenticated using (profile_id = public.current_profile_id());
create policy photos_viewable   on public.photos for select to authenticated
  using (review_status = 'approved' and public.can_view_profile(public.current_profile_id(), profile_id));
create policy photos_mod_read   on public.photos for select to authenticated using (public.is_moderator());

-- =============================================================================
-- consents — 본인 insert/select, update/delete 금지(철회는 새 행)
-- =============================================================================
grant select, insert on public.consents to authenticated;
create policy consents_self_read   on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_self_insert on public.consents for insert to authenticated with check (user_id = auth.uid());

-- =============================================================================
-- identity_verifications — 본인 결과 읽기(해시 제외), 쓰기는 service role
-- =============================================================================
grant select (id, user_id, profile_id, provider, result, birth_date_verified, verified_at, reverify_due_at, is_active, created_at)
  on public.identity_verifications to authenticated;
create policy identity_self_read on public.identity_verifications for select to authenticated using (user_id = auth.uid());

-- =============================================================================
-- daily_recommendations — 본인 행 읽기(차단 제외), seen/acted 갱신
-- =============================================================================
grant select on public.daily_recommendations to authenticated;
grant update (seen_at, acted_at, action) on public.daily_recommendations to authenticated;
create policy reco_self_read on public.daily_recommendations for select to authenticated
  using (profile_id = public.current_profile_id() and not public.are_blocked(profile_id, target_id));
create policy reco_self_update on public.daily_recommendations for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- =============================================================================
-- likes — 보낸 것만 읽기. insert 는 RPC(send_like) 권장, 정책은 최종 방어선
-- =============================================================================
grant select, insert on public.likes to authenticated;
create policy likes_self_read on public.likes for select to authenticated using (from_id = public.current_profile_id());
create policy likes_self_insert on public.likes for insert to authenticated
  with check (from_id = public.current_profile_id() and public.can_like(from_id, to_id));

-- =============================================================================
-- matches — 당사자만. 차단자 화면에서는 제거(피차단자는 종료 상태로 열람)
-- =============================================================================
grant select on public.matches to authenticated;
create policy matches_participant_read on public.matches for select to authenticated
  using (
    public.current_profile_id() in (a_id, b_id)
    and not exists (
      select 1 from public.blocks bl
      where bl.blocker_id = public.current_profile_id()
        and bl.blocked_id = case when a_id = public.current_profile_id() then b_id else a_id end
    )
  );

-- =============================================================================
-- blocks — 본인이 차단한 것만. insert 는 apply_block RPC 권장(직접 insert 도 트리거로 동일 효과)
-- =============================================================================
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_self on public.blocks for all to authenticated
  using (blocker_id = public.current_profile_id()) with check (blocker_id = public.current_profile_id());

-- =============================================================================
-- messages — 당사자만, 원문 body 는 컬럼 권한으로 차단(v_messages 사용), read_at 은 수신자만
-- =============================================================================
grant select (id, match_id, sender_id, masked_body, image_path, suggestion_template_id, is_held, created_at, read_at)
  on public.messages to authenticated;
grant insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create policy messages_participant_read on public.messages for select to authenticated
  using (
    public.is_match_participant(match_id, public.current_profile_id())
    and (not is_held or sender_id = public.current_profile_id())
    and not exists (
      select 1 from public.matches m join public.blocks bl
        on bl.blocker_id = public.current_profile_id()
       and bl.blocked_id = case when m.a_id = public.current_profile_id() then m.b_id else m.a_id end
      where m.id = match_id
    )
  );
create policy messages_sender_insert on public.messages for insert to authenticated
  with check (
    sender_id = public.current_profile_id()
    and public.can_send_message(match_id, sender_id)
    and (image_path is null or public.can_send_chat_image(match_id, sender_id))
    and read_at is null
  );
create policy messages_recipient_mark_read on public.messages for update to authenticated
  using (sender_id <> public.current_profile_id() and public.is_match_participant(match_id, public.current_profile_id()))
  with check (sender_id <> public.current_profile_id() and public.is_match_participant(match_id, public.current_profile_id()));

-- =============================================================================
-- reports — insert 는 create_report RPC 만. 신고자는 자기 신고의 상태만(증거·상세 제외)
-- =============================================================================
grant select (id, reporter_id, target_id, match_id, surface, reason_code, priority, status, created_at, handled_at)
  on public.reports to authenticated;
create policy reports_reporter_read on public.reports for select to authenticated
  using (reporter_id = public.current_profile_id());
create policy reports_mod_read on public.reports for select to authenticated using (public.is_moderator());

-- =============================================================================
-- sanctions / appeals — 본인 열람, 경고 확인(acknowledged_at), 이의신청 1회
-- =============================================================================
grant select (id, profile_id, level, reason, reason_code, starts_at, ends_at, acknowledged_at, revoked_at, created_at)
  on public.sanctions to authenticated;
grant update (acknowledged_at) on public.sanctions to authenticated;
create policy sanctions_self_read on public.sanctions for select to authenticated using (profile_id = public.current_profile_id());
create policy sanctions_self_ack  on public.sanctions for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy sanctions_mod_read  on public.sanctions for select to authenticated using (public.is_moderator());

grant select, insert on public.appeals to authenticated;
create policy appeals_self_read   on public.appeals for select to authenticated using (profile_id = public.current_profile_id());
create policy appeals_self_insert on public.appeals for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and status = 'pending' and decided_by is null and decided_at is null
    and exists (
      select 1 from public.sanctions s
      where s.id = sanction_id and s.profile_id = public.current_profile_id()
        and s.level >= 3 and s.revoked_at is null
        and s.starts_at > now() - interval '7 days'
        and s.reason not like 'AUTO:MINOR_CONFIRMED%'
    )
  );
create policy appeals_mod_read on public.appeals for select to authenticated using (public.is_moderator());

-- =============================================================================
-- inquiries — company 사이트(anon) + 앱(authenticated) insert, 본인 열람
-- =============================================================================
grant insert on public.inquiries to anon, authenticated;
grant select on public.inquiries to authenticated;
create policy inquiries_anon_insert on public.inquiries for insert to anon
  with check (user_id is null and status = 'open' and handled_by is null);
create policy inquiries_auth_insert on public.inquiries for insert to authenticated
  with check ((user_id is null or user_id = auth.uid()) and status = 'open' and handled_by is null);
create policy inquiries_self_read on public.inquiries for select to authenticated using (user_id = auth.uid());
create policy inquiries_mod_read  on public.inquiries for select to authenticated using (public.is_moderator());

-- =============================================================================
-- payments (Phase 3) — 본인 읽기만. 쓰기는 service role
-- =============================================================================
grant select on public.subscriptions, public.payments, public.item_ledger, public.boosts, public.refund_requests to authenticated;
create policy subscriptions_self_read   on public.subscriptions   for select to authenticated using (user_id = auth.uid());
create policy payments_self_read        on public.payments        for select to authenticated using (user_id = auth.uid());
create policy item_ledger_self_read     on public.item_ledger     for select to authenticated using (user_id = auth.uid());
create policy boosts_self_read          on public.boosts          for select to authenticated using (user_id = auth.uid());
create policy refund_requests_self_read on public.refund_requests for select to authenticated using (user_id = auth.uid());

-- =============================================================================
-- game / events (Phase 2·5) — 읽기 정책만. 쓰기는 Phase 2 이후 F 그룹이 RPC 로 추가
-- =============================================================================
grant select on public.game_profiles, public.game_sessions, public.quests, public.quest_progress,
  public.events, public.event_rsvps to authenticated;
create policy game_profiles_self_read  on public.game_profiles  for select to authenticated using (profile_id = public.current_profile_id());
create policy game_sessions_part_read  on public.game_sessions  for select to authenticated
  using (participants ? public.current_profile_id()::text);
create policy quests_read              on public.quests         for select to authenticated using (is_active);
create policy quest_progress_self_read on public.quest_progress for select to authenticated using (profile_id = public.current_profile_id());
create policy events_open_read         on public.events         for select to authenticated
  using (status in ('open', 'closed', 'done')
         and exists (select 1 from public.profiles me where me.id = public.current_profile_id() and me.verify_level >= 2));
create policy event_rsvps_self_read    on public.event_rsvps    for select to authenticated using (profile_id = public.current_profile_id());

-- =============================================================================
-- push / analytics
-- =============================================================================
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_self on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.notification_log to authenticated;
create policy notification_log_self_read on public.notification_log for select to authenticated using (user_id = auth.uid());

grant insert on public.analytics_events to anon, authenticated;
create policy analytics_events_insert on public.analytics_events for insert to anon, authenticated with check (true);

-- =============================================================================
-- 뷰 (owner = 마이그레이션 실행 롤 → RLS 우회. 따라서 뷰 안에 접근 규칙을 명시한다)
-- =============================================================================

-- 타인 프로필 카드: can_view_profile 통과한 행만, 민감 컬럼(birth_date·seeking_gender·phone_hash 등) 제외
create view public.v_profile_public with (security_barrier = true) as
select
  p.id,
  p.nickname,
  p.birth_year,
  case
    when public.age_years_kst(p.birth_date) < 24 then '20_early'
    when public.age_years_kst(p.birth_date) < 27 then '20_mid'
    when public.age_years_kst(p.birth_date) < 30 then '20_late'
    when public.age_years_kst(p.birth_date) < 34 then '30_early'
    when public.age_years_kst(p.birth_date) < 37 then '30_mid'
    when public.age_years_kst(p.birth_date) < 40 then '30_late'
    else '40_plus' end as age_band,
  p.gender,
  p.region_code,
  r.sido,
  r.sigungu,
  p.bio,
  p.now_into,
  p.verify_level,
  p.mode,
  p.last_active_at,
  p.created_at
from public.profiles p
left join public.regions r on r.code = p.region_code
where public.can_view_profile(public.current_profile_id(), p.id);
grant select on public.v_profile_public to authenticated;
comment on view public.v_profile_public is '타인 프로필은 이 뷰로만 읽는다. 본인 행은 profiles 직접 select.';

-- 메시지: 당사자만, 원문 body 는 발신자 본인에게만, 수신자는 masked_body(display_body)
create view public.v_messages with (security_barrier = true) as
select
  m.id,
  m.match_id,
  m.sender_id,
  case when m.sender_id = public.current_profile_id() then m.body else null end as body,
  m.masked_body,
  case when m.sender_id = public.current_profile_id() then m.body else m.masked_body end as display_body,
  m.image_path,
  m.suggestion_template_id,
  m.is_held,
  m.created_at,
  m.read_at,
  (m.sender_id = public.current_profile_id()) as is_mine
from public.messages m
join public.matches mt on mt.id = m.match_id
where public.current_profile_id() in (mt.a_id, mt.b_id)
  and (not m.is_held or m.sender_id = public.current_profile_id())
  and not exists (
    select 1 from public.blocks bl
    where bl.blocker_id = public.current_profile_id()
      and bl.blocked_id = case when mt.a_id = public.current_profile_id() then mt.b_id else mt.a_id end
  );
grant select on public.v_messages to authenticated;
comment on view public.v_messages is '클라이언트는 messages 대신 이 뷰를 읽는다(display_body 렌더). Realtime 은 D4 가 masked_body 만 브로드캐스트.';

-- 내 매칭 목록 + 상대 요약 (채팅 목록용)
create view public.v_my_matches with (security_barrier = true) as
select
  mt.id as match_id,
  mt.status,
  mt.mode,
  mt.matched_at,
  mt.first_message_at,
  mt.last_message_at,
  mt.ended_at,
  case when mt.a_id = public.current_profile_id() then mt.b_id else mt.a_id end as partner_id,
  op.nickname as partner_nickname,
  op.verify_level as partner_verify_level,
  op.status as partner_status,
  (select count(*)::integer from public.messages x
     where x.match_id = mt.id and x.sender_id <> public.current_profile_id() and x.read_at is null and not x.is_held) as unread_count,
  (select x.masked_body from public.messages x where x.match_id = mt.id and not x.is_held order by x.created_at desc limit 1) as last_masked_body,
  (mt.matched_at + interval '72 hours' <= now() and me.verify_level >= 3 and op.verify_level >= 3) as contact_unmasked
from public.matches mt
join public.profiles me on me.id = public.current_profile_id()
join public.profiles op on op.id = case when mt.a_id = me.id then mt.b_id else mt.a_id end
where me.id in (mt.a_id, mt.b_id)
  and not exists (select 1 from public.blocks bl where bl.blocker_id = me.id and bl.blocked_id = op.id);
grant select on public.v_my_matches to authenticated;

-- 주간 슈퍼라이크 사용량 (A4 weekly_quota_used)
create view public.v_weekly_quota_used with (security_barrier = true) as
select public.current_profile_id() as profile_id,
       public.week_start_loop_date(now()) as week_start,
       public.weekly_superlike_used(public.current_profile_id()) as superlike_used;
grant select on public.v_weekly_quota_used to authenticated;
