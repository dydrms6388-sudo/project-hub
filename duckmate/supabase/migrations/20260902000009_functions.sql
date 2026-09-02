-- =============================================================================
-- 0009 — functions & triggers
--   시간 헬퍼 · 세션/역할 헬퍼 · 관계 판정 · verify_level 산정 · tier · 신고/차단 RPC · auth 트리거
-- 모든 SECURITY DEFINER 함수는 search_path 를 고정한다.
-- =============================================================================

-- ---------- 공통 트리거: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger trg_photos_updated_at        before update on public.photos        for each row execute function public.set_updated_at();
create trigger trg_matches_updated_at       before update on public.matches       for each row execute function public.set_updated_at();
create trigger trg_reports_updated_at       before update on public.reports       for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at      before update on public.payments      for each row execute function public.set_updated_at();
create trigger trg_game_sessions_updated_at before update on public.game_sessions for each row execute function public.set_updated_at();
create trigger trg_events_updated_at        before update on public.events        for each row execute function public.set_updated_at();
create trigger trg_app_settings_updated_at  before update on public.app_settings  for each row execute function public.set_updated_at();

-- ---------- 시간 헬퍼 (KST 07:00 경계) ----------
create or replace function public.loop_date(p_at timestamptz default now())
returns date language sql immutable parallel safe as $$
  select ((p_at at time zone 'Asia/Seoul') - interval '7 hours')::date
$$;
comment on function public.loop_date is '하루 경계 = 07:00 KST. daily_recommendations.loop_date / 푸시 예산 / 퀘스트 날짜 축.';

create or replace function public.week_start_loop_date(p_at timestamptz default now())
returns date language sql immutable parallel safe as $$
  select date_trunc('week', public.loop_date(p_at)::timestamp)::date   -- ISO 주(월요일 시작)
$$;
comment on function public.week_start_loop_date is '주간 경계 = 월요일 07:00 KST. 슈퍼라이크 쿼터 리셋 축.';

create or replace function public.age_years_kst(p_birth date, p_at timestamptz default now())
returns integer language sql immutable parallel safe as $$
  select extract(year from age((p_at at time zone 'Asia/Seoul')::date, p_birth))::integer
$$;

create or replace function public.is_adult(p_birth date, p_at timestamptz default now())
returns boolean language sql immutable parallel safe as $$
  select p_birth is not null and public.age_years_kst(p_birth, p_at) >= 19
$$;

-- ---------- 세션 / 역할 ----------
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (select role::text from public.admin_users where user_id = auth.uid())
  )
$$;
comment on function public.app_role is 'admin | moderator | null. JWT app_metadata.role 우선, 없으면 admin_users. service role 은 RLS 를 우회하므로 여기 해당 없음.';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() = 'admin'
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() in ('admin', 'moderator')
$$;

-- ---------- 제재 / 관계 판정 ----------
create or replace function public.active_sanction_level(p_profile_id uuid)
returns smallint language sql stable security definer set search_path = public as $$
  select coalesce(max(level), 0)::smallint
  from public.sanctions
  where profile_id = p_profile_id
    and revoked_at is null
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
$$;

create or replace function public.are_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

create or replace function public.match_id_of(p_a uuid, p_b uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.matches
  where a_id = least(p_a, p_b) and b_id = greatest(p_a, p_b)
  limit 1
$$;

create or replace function public.is_matched(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches
    where a_id = least(p_a, p_b) and b_id = greatest(p_a, p_b) and status = 'active'
  )
$$;

create or replace function public.is_match_participant(p_match_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches where id = p_match_id and p_profile_id in (a_id, b_id)
  )
$$;

create or replace function public.is_recommended_recently(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.daily_recommendations
    where profile_id = p_viewer and target_id = p_target
      and loop_date >= public.loop_date(now()) - 1
  )
$$;

create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_viewer public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  if p_viewer is null or p_target is null then return false; end if;
  if p_viewer = p_target then return true; end if;

  select * into v_viewer from public.profiles where id = p_viewer;
  select * into v_target from public.profiles where id = p_target;
  if v_viewer.id is null or v_target.id is null then return false; end if;

  -- 양쪽 모두 L2 이상 + active. 미인증(L0/L1)은 타인 프로필을 볼 수 없다(성인 전용 근거).
  if v_viewer.verify_level < 2 or v_viewer.status <> 'active' then return false; end if;
  if v_target.verify_level < 2 or v_target.status <> 'active' then return false; end if;
  if public.are_blocked(p_viewer, p_target) then return false; end if;

  -- 매칭 상대는 항상(채팅 헤더·신고용). 그 외는 최근 추천 대상 + 비노출/정지 아님.
  if public.is_matched(p_viewer, p_target) then return true; end if;
  if v_target.hidden_at is not null then return false; end if;
  if public.active_sanction_level(p_target) >= 3 then return false; end if;
  return public.is_recommended_recently(p_viewer, p_target);
end $$;

-- ---------- verify_level 산정 (유일한 갱신 지점) ----------
create or replace function public.recompute_verify_level(p_profile_id uuid)
returns smallint language plpgsql security definer set search_path = public as $$
declare
  v_profile   public.profiles%rowtype;
  v_phone_ok  boolean;
  v_level     smallint := 0;
  v_mode      public.profile_mode;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then return null; end if;

  select (u.phone_confirmed_at is not null) into v_phone_ok from auth.users u where u.id = v_profile.user_id;
  if coalesce(v_phone_ok, false) then v_level := 1; end if;

  if v_level >= 1 and exists (
    select 1 from public.identity_verifications iv
    where iv.user_id = v_profile.user_id and iv.result = 'success' and iv.is_active
  ) then v_level := 2; end if;

  if v_level >= 2 and exists (
    select 1 from public.photos ph
    where ph.profile_id = p_profile_id and ph.is_primary and ph.review_status = 'approved'
  ) then v_level := 3; end if;

  -- 성인 조건 선행: 생년월일이 미성년이면 L2 이상 불가 (status 처리는 D2)
  if v_profile.birth_date is not null and not public.is_adult(v_profile.birth_date) then
    v_level := least(v_level, 1);
  end if;

  v_mode := case when v_level < 3 and v_profile.mode = 'dating' then 'friend'::public.profile_mode else v_profile.mode end;

  if v_level <> v_profile.verify_level or v_mode <> v_profile.mode then
    update public.profiles set verify_level = v_level, mode = v_mode where id = p_profile_id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before, after)
    values (auth.uid(), 'system', 'verify_level_recomputed', 'profile', p_profile_id::text,
            jsonb_build_object('verify_level', v_profile.verify_level, 'mode', v_profile.mode),
            jsonb_build_object('verify_level', v_level, 'mode', v_mode));
  end if;
  return v_level;
end $$;

-- 사진 검수 결과 / 본인인증 결과가 바뀌면 자동 재계산
create or replace function public.trg_recompute_verify_level_photos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_verify_level(coalesce(new.profile_id, old.profile_id));
  return null;
end $$;
create trigger trg_photos_recompute_level
  after insert or update of review_status, is_primary or delete on public.photos
  for each row execute function public.trg_recompute_verify_level_photos();

create or replace function public.trg_recompute_verify_level_identity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = new.user_id;
  if v_profile_id is not null then perform public.recompute_verify_level(v_profile_id); end if;
  return null;
end $$;
create trigger trg_identity_recompute_level
  after insert or update of result, is_active on public.identity_verifications
  for each row execute function public.trg_recompute_verify_level_identity();

-- ---------- tier (Phase 1 = 항상 free) ----------
create or replace function public.get_effective_tier(p_user_id uuid)
returns public.subscription_tier language plpgsql stable security definer set search_path = public as $$
declare v_enabled boolean; v_tier public.subscription_tier;
begin
  select (value = 'true'::jsonb) into v_enabled from public.app_settings where key = 'payments_enabled';
  if not coalesce(v_enabled, false) then return 'free'; end if;
  select tier into v_tier
  from public.subscriptions
  where user_id = p_user_id
    and status in ('active', 'past_due', 'canceled')
    and current_period_end > now()
  order by case tier when 'pro' then 2 when 'plus' then 1 else 0 end desc
  limit 1;
  return coalesce(v_tier, 'free');
end $$;
comment on function public.get_effective_tier is '앱 코드에서 tier 를 직접 계산하지 말 것. app_settings.payments_enabled=false 면 항상 free.';

create or replace function public.weekly_superlike_used(p_profile_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.likes
  where from_id = p_profile_id and type = 'super'
    and public.loop_date(created_at) >= public.week_start_loop_date(now())
$$;

-- ---------- 취미 상한 트리거 ----------
create or replace function public.trg_hobbies_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.hobbies where is_active) > 60 then
    raise exception 'HOBBY_CAP_EXCEEDED: 세부 취미는 60개 상한' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.hobby_categories where is_active) > 12 then
    raise exception 'HOBBY_CATEGORY_CAP_EXCEEDED: 대분류는 12개 상한' using errcode = 'check_violation';
  end if;
  return null;
end $$;
create trigger trg_hobbies_cap after insert or update on public.hobbies
  for each statement execute function public.trg_hobbies_cap();
create trigger trg_hobby_categories_cap after insert or update on public.hobby_categories
  for each statement execute function public.trg_hobbies_cap();

create or replace function public.trg_profile_hobbies_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.profile_hobbies where profile_id = new.profile_id) > 5 then
    raise exception 'PROFILE_HOBBY_CAP_EXCEEDED: 취미는 최대 5개' using errcode = 'check_violation';
  end if;
  return null;
end $$;
create trigger trg_profile_hobbies_cap after insert on public.profile_hobbies
  for each row execute function public.trg_profile_hobbies_cap();

-- ---------- auth.users → profiles ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, verify_level, status, mode, onboarding_step)
  values (new.id, case when new.phone_confirmed_at is not null then 1 else 0 end, 'active', 'friend', 'basic')
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_phone_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile_id uuid;
begin
  if new.phone_confirmed_at is not null and (old.phone_confirmed_at is null or old.phone <> new.phone) then
    select id into v_profile_id from public.profiles where user_id = new.id;
    if v_profile_id is not null then perform public.recompute_verify_level(v_profile_id); end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_phone_confirmed
  after update of phone_confirmed_at, phone on auth.users
  for each row execute function public.handle_user_phone_confirmed();

-- ---------- 매칭/메시지 트리거 ----------
create or replace function public.trg_touch_match_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.matches
  set first_message_at = coalesce(first_message_at, new.created_at),
      last_message_at  = new.created_at
  where id = new.match_id;
  return null;
end $$;
create trigger trg_messages_touch_match after insert on public.messages
  for each row execute function public.trg_touch_match_on_message();

-- 차단 insert 시 매칭 종료 + 좋아요/오늘 추천 정리 (idempotent)
create or replace function public.trg_blocks_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.matches
  set status = 'blocked', ended_at = now()
  where a_id = least(new.blocker_id, new.blocked_id)
    and b_id = greatest(new.blocker_id, new.blocked_id)
    and status = 'active';
  delete from public.likes
  where (from_id = new.blocker_id and to_id = new.blocked_id)
     or (from_id = new.blocked_id and to_id = new.blocker_id);
  delete from public.daily_recommendations
  where loop_date >= public.loop_date(now())
    and ((profile_id = new.blocker_id and target_id = new.blocked_id)
      or (profile_id = new.blocked_id and target_id = new.blocker_id));
  return null;
end $$;
create trigger trg_blocks_after_insert after insert on public.blocks
  for each row execute function public.trg_blocks_after_insert();

-- 제재 insert 부수효과: level 5 → 매칭 paused, level 6 → banned + CI 블록리스트
create or replace function public.trg_sanctions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ci text;
begin
  if new.level >= 5 and new.profile_id is not null then
    update public.matches set status = 'paused', ended_at = coalesce(ended_at, now())
    where status = 'active' and new.profile_id in (a_id, b_id);
  end if;
  if new.level = 6 and new.profile_id is not null then
    update public.profiles set status = 'banned', banned_at = now(), hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'banned')
    where id = new.profile_id and status <> 'banned';
    select iv.ci_hash into v_ci from public.identity_verifications iv
    join public.profiles p on p.user_id = iv.user_id
    where p.id = new.profile_id and iv.result = 'success' and iv.is_active
    limit 1;
    if v_ci is not null then
      insert into public.blocked_ci_hashes (ci_hash, reason, source_profile_id, expires_at)
      values (v_ci, new.reason, new.profile_id, now() + interval '5 years')
      on conflict (ci_hash) do nothing;
      update public.sanctions set profile_ci_hash = v_ci where id = new.id;
    end if;
  end if;
  return null;
end $$;
create trigger trg_sanctions_after_insert after insert on public.sanctions
  for each row execute function public.trg_sanctions_after_insert();

-- 신고 종결 시 증거 만료일 계산 (dismissed 90일 / confirmed 180일 / 영구정지 5년)
create or replace function public.trg_reports_before_update()
returns trigger language plpgsql as $$
begin
  if new.status in ('confirmed', 'dismissed') and old.status not in ('confirmed', 'dismissed') then
    new.handled_at := coalesce(new.handled_at, now());
    new.expires_at := new.handled_at + case when new.status = 'confirmed' then interval '180 days' else interval '90 days' end;
    if exists (select 1 from public.sanctions s where s.report_id = new.id and s.level = 6) then
      new.expires_at := new.handled_at + interval '5 years';
    end if;
  end if;
  return new;
end $$;
create trigger trg_reports_before_update before update on public.reports
  for each row execute function public.trg_reports_before_update();

-- ---------- 신고: 우선순위 / SLA ----------
create or replace function public.report_default_priority(p_reason public.report_reason)
returns public.report_priority language sql immutable parallel safe as $$
  select case p_reason
    when 'ROMANCE_SCAM' then 'P0' when 'MINOR_SUSPECT' then 'P0' when 'STALKING' then 'P0'
    when 'INAPPROPRIATE_PHOTO' then 'P0' when 'THREAT_VIOLENCE' then 'P0'
    when 'SEXUAL_HARASSMENT' then 'P1' when 'IMPERSONATION' then 'P1' when 'COMMERCIAL_SPAM' then 'P1'
    when 'HATE_SPEECH' then 'P1' when 'PII_REQUEST' then 'P1'
    when 'OFF_PLATFORM_LURE' then 'P2' when 'FAKE_PROFILE' then 'P2'
    else 'P3' end::public.report_priority
$$;

create or replace function public.report_sla_interval(p_priority public.report_priority)
returns interval language sql immutable parallel safe as $$
  select case p_priority
    when 'P0' then interval '1 hour' when 'P1' then interval '6 hours'
    when 'P2' then interval '24 hours' else interval '72 hours' end
$$;

-- ---------- 제재 발급 (service role / 내부 전용) ----------
create or replace function public.issue_sanction(
  p_profile_id uuid, p_level integer, p_reason text,
  p_duration interval default null, p_report_id uuid default null,
  p_reason_code public.report_reason default null, p_issued_by uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ends timestamptz;
begin
  if p_level between 1 and 5 then
    v_ends := now() + coalesce(p_duration, case p_level
      when 1 then interval '0' when 2 then interval '24 hours' when 3 then interval '3 days'
      when 4 then interval '7 days' else interval '30 days' end);
  else
    v_ends := null;
  end if;
  -- 자동 조치는 level 1·2 까지만. 3 이상은 사람(issued_by)이 있어야 한다. 예외: 미성년 확정(reason 'MINOR_CONFIRMED').
  if p_level >= 3 and p_issued_by is null and p_reason not like 'AUTO:MINOR_CONFIRMED%' then
    raise exception 'MANUAL_APPROVAL_REQUIRED: level>=3 제재는 사람이 승인해야 합니다' using errcode = 'check_violation';
  end if;
  insert into public.sanctions (profile_id, level, reason, reason_code, report_id, starts_at, ends_at, issued_by)
  values (p_profile_id, p_level::smallint, p_reason, p_reason_code, p_report_id, now(), v_ends, p_issued_by)
  returning id into v_id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, after)
  values (p_issued_by, case when p_issued_by is null then 'system' else public.app_role() end,
          'sanction_issued', 'profile', p_profile_id::text,
          jsonb_build_object('sanction_id', v_id, 'level', p_level, 'reason', p_reason, 'report_id', p_report_id));
  return v_id;
end $$;

-- ---------- 차단 RPC ----------
create or replace function public.apply_block_internal(p_blocker uuid, p_blocked uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_blocker is null or p_blocked is null or p_blocker = p_blocked then
    raise exception 'INVALID_BLOCK' using errcode = 'check_violation';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (p_blocker, p_blocked)
  on conflict do nothing;   -- 매칭 종료·좋아요 삭제는 trg_blocks_after_insert 가 처리
end $$;

create or replace function public.apply_block(p_blocked_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id();
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform public.apply_block_internal(v_me, p_blocked_id);
end $$;

create or replace function public.remove_block(p_blocked_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id();
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  delete from public.blocks where blocker_id = v_me and blocked_id = p_blocked_id;
  -- 해제해도 종료된 매칭·삭제된 좋아요는 복구되지 않는다.
end $$;

-- ---------- 신고 RPC: 신고 insert + 증거 스냅샷 + 자동 분류/조치 (한 트랜잭션) ----------
create or replace function public.create_report(
  p_target_id   uuid,
  p_reason_code public.report_reason,
  p_detail      text default null,
  p_match_id    uuid default null,
  p_surface     public.report_surface default 'profile',
  p_reporter_id uuid default null          -- service role 전용(자동 신고). 일반 호출은 무시됨
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reporter_id   uuid;
  v_is_service    boolean := (auth.role() = 'service_role');
  v_report_id     uuid := gen_random_uuid();
  v_existing      public.reports%rowtype;
  v_reporter      public.profiles%rowtype;
  v_target        public.profiles%rowtype;
  v_match         public.matches%rowtype;
  v_messages      jsonb := '[]'::jsonb;
  v_hits          jsonb := '[]'::jsonb;
  v_hit_count     integer := 0;
  v_photos        jsonb := '[]'::jsonb;
  v_hobbies       jsonb := '[]'::jsonb;
  v_prior_reports integer := 0;
  v_prior_sanc    jsonb := '[]'::jsonb;
  v_evidence      jsonb;
  v_priority      public.report_priority;
  v_auto          jsonb := '[]'::jsonb;
  v_distinct_30d  integer;
  v_same_reason   integer;
  v_detail        text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  -- 신고자 판정
  v_reporter_id := public.current_profile_id();
  if v_reporter_id is null and v_is_service then v_reporter_id := p_reporter_id; end if;
  if v_reporter_id is null and not v_is_service then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if v_reporter_id = p_target_id then
    raise exception 'INVALID_TARGET: 자기 자신은 신고할 수 없습니다' using errcode = 'check_violation';
  end if;
  if p_reason_code = 'OTHER' and v_detail is null then
    raise exception 'DETAIL_REQUIRED: 기타 사유는 내용이 필요합니다' using errcode = 'check_violation';
  end if;
  if v_detail is not null and char_length(v_detail) > 500 then
    raise exception 'DETAIL_TOO_LONG' using errcode = 'check_violation';
  end if;

  select * into v_target from public.profiles where id = p_target_id;
  if not found then raise exception 'TARGET_NOT_FOUND' using errcode = 'no_data_found'; end if;
  if v_reporter_id is not null then
    select * into v_reporter from public.profiles where id = v_reporter_id;
  end if;

  -- 매칭 검증: 신고자가 당사자여야 한다 (service role 은 예외)
  if p_match_id is not null then
    select * into v_match from public.matches where id = p_match_id;
    if not found then raise exception 'MATCH_NOT_FOUND' using errcode = 'no_data_found'; end if;
    if not v_is_service and v_reporter_id not in (v_match.a_id, v_match.b_id) then
      raise exception 'NOT_PARTICIPANT' using errcode = '42501';
    end if;
    if p_target_id not in (v_match.a_id, v_match.b_id) then
      raise exception 'TARGET_NOT_IN_MATCH' using errcode = 'check_violation';
    end if;
  else
    -- 매칭이 없으면 관계상의 매칭을 자동 연결(있으면)
    if v_reporter_id is not null then
      select * into v_match from public.matches
      where a_id = least(v_reporter_id, p_target_id) and b_id = greatest(v_reporter_id, p_target_id);
    end if;
  end if;

  -- 24h 중복: 같은 신고자→같은 대상, 미종결 → detail append
  if v_reporter_id is not null then
    select * into v_existing from public.reports
    where reporter_id = v_reporter_id and target_id = p_target_id
      and created_at > now() - interval '24 hours'
      and status not in ('confirmed', 'dismissed')
    order by created_at desc limit 1;
    if found then
      update public.reports
      set detail = left(concat_ws(E'\n---\n', detail, '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' ' || p_reason_code::text || '] ' || coalesce(v_detail, '')), 4000)
      where id = v_existing.id;
      return jsonb_build_object('report_id', v_existing.id, 'deduped', true, 'priority', v_existing.priority);
    end if;
  end if;

  -- ---- 증거 스냅샷 ----
  if v_match.id is not null then
    select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb) into v_messages
    from (
      select id, sender_id, body, masked_body, image_path, is_held, created_at, read_at
      from public.messages where match_id = v_match.id
      order by created_at desc limit 50
    ) m;

    select coalesce(jsonb_agg(jsonb_build_object('rule_id', f.rule_id, 'message_id', f.message_id, 'matched', f.matched, 'score', f.score)), '[]'::jsonb),
           count(*)::integer
    into v_hits, v_hit_count
    from public.message_flags f
    where f.message_id in (select (e ->> 'id')::uuid from jsonb_array_elements(v_messages) e);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('hobby', h.slug, 'rank', ph.rank, 'intensity', ph.intensity, 'fav_note', ph.fav_note) order by ph.rank), '[]'::jsonb)
  into v_hobbies
  from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id
  where ph.profile_id = p_target_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'photo_id', ph.id, 'path', ph.path,
           'evidence_path', v_report_id::text || '/' || ph.id::text || '.webp',
           'review_status', ph.review_status, 'is_primary', ph.is_primary)), '[]'::jsonb)
  into v_photos
  from public.photos ph where ph.profile_id = p_target_id;

  select count(*)::integer into v_prior_reports from public.reports where target_id = p_target_id;
  select coalesce(jsonb_agg(jsonb_build_object('level', s.level, 'reason', s.reason, 'starts_at', s.starts_at, 'ends_at', s.ends_at)), '[]'::jsonb)
  into v_prior_sanc from public.sanctions s where s.profile_id = p_target_id;

  v_evidence := jsonb_build_object(
    'schema', 1,
    'captured_at', now(),
    'match_id', v_match.id,
    'messages', v_messages,
    'reporter', case when v_reporter.id is null then null else jsonb_build_object(
      'profile_id', v_reporter.id, 'nickname', v_reporter.nickname, 'verify_level', v_reporter.verify_level,
      'mode', v_reporter.mode, 'created_at', v_reporter.created_at) end,
    'target', jsonb_build_object(
      'profile_id', v_target.id, 'nickname', v_target.nickname, 'birth_year', v_target.birth_year,
      'gender', v_target.gender, 'region_code', v_target.region_code, 'bio', v_target.bio,
      'now_into', v_target.now_into, 'verify_level', v_target.verify_level, 'mode', v_target.mode,
      'status', v_target.status, 'created_at', v_target.created_at, 'hobbies', v_hobbies),
    'target_photos', v_photos,
    'relation', jsonb_build_object(
      'like_from_target_at',   (select created_at from public.likes where from_id = p_target_id and to_id = v_reporter_id),
      'like_from_reporter_at', (select created_at from public.likes where from_id = v_reporter_id and to_id = p_target_id),
      'matched_at', v_match.matched_at,
      'blocked', case when v_reporter_id is null then false else public.are_blocked(v_reporter_id, p_target_id) end),
    'detector_hits', v_hits,
    'prior_reports_count', v_prior_reports,
    'prior_sanctions', v_prior_sanc
  );
  if v_evidence is null then
    raise exception 'EVIDENCE_SNAPSHOT_FAILED' using errcode = 'internal_error';
  end if;

  -- ---- 우선순위 (상향만) ----
  v_priority := public.report_default_priority(p_reason_code);
  select count(distinct reporter_id)::integer into v_distinct_30d
  from public.reports
  where target_id = p_target_id and status <> 'dismissed' and created_at > now() - interval '30 days'
    and reporter_id is not null and reporter_id <> coalesce(v_reporter_id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_reporter_id is not null then v_distinct_30d := v_distinct_30d + 1; end if;

  if v_distinct_30d >= 3 and v_priority > 'P1' then v_priority := 'P1'; end if;
  if exists (select 1 from jsonb_array_elements(v_hits) e where e ->> 'rule_id' in ('BW_VIOLENCE', 'BW_ILLEGAL')) then
    v_priority := 'P0';
  end if;

  insert into public.reports (
    id, reporter_id, target_id, match_id, surface, reason_code, detail, priority, due_at,
    evidence, detector_hit_count, status
  ) values (
    v_report_id, v_reporter_id, p_target_id, v_match.id, p_surface, p_reason_code, v_detail,
    v_priority, now() + public.report_sla_interval(v_priority), v_evidence, v_hit_count, 'queued'
  );

  -- ---- 자동 조치 (A5 §3 표, level 2 까지만) ----
  select count(*)::integer into v_same_reason from public.reports
  where target_id = p_target_id and reason_code = p_reason_code and status <> 'dismissed';

  if p_reason_code in ('ROMANCE_SCAM', 'THREAT_VIOLENCE', 'INAPPROPRIATE_PHOTO')
     or (p_reason_code in ('SEXUAL_HARASSMENT', 'COMMERCIAL_SPAM') and v_same_reason >= 2)
     or v_distinct_30d >= 3 then
    if public.active_sanction_level(p_target_id) < 2 then
      perform public.issue_sanction(p_target_id, 2, 'AUTO:' || p_reason_code::text, interval '24 hours', v_report_id, p_reason_code, null);
      v_auto := v_auto || to_jsonb('chat_restricted_24h'::text);
    end if;
  end if;

  if p_reason_code in ('IMPERSONATION', 'INAPPROPRIATE_PHOTO') then
    update public.photos set review_status = 'held', reject_code = null, held_reason = 'AUTO:' || p_reason_code::text
    where profile_id = p_target_id and review_status in ('pending', 'approved');
    v_auto := v_auto || to_jsonb('photos_held'::text);
  end if;

  if p_reason_code = 'MINOR_SUSPECT' then
    update public.profiles set hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'MINOR_SUSPECT')
    where id = p_target_id;
    v_auto := v_auto || to_jsonb('profile_hidden_reverify'::text);
  end if;

  if p_reason_code = 'STALKING' and v_reporter_id is not null then
    perform public.apply_block_internal(v_reporter_id, p_target_id);
    v_auto := v_auto || to_jsonb('auto_block'::text);
  end if;

  if v_distinct_30d >= 5 then
    update public.profiles set hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'CUMULATIVE_5_90D')
    where id = p_target_id;
    v_auto := v_auto || to_jsonb('profile_hidden_cumulative'::text);
  end if;

  update public.reports set auto_actions = v_auto where id = v_report_id;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
  values (auth.uid(), case when v_is_service then 'service' else 'user' end, 'report_created', 'report', v_report_id::text,
          jsonb_build_object('reason_code', p_reason_code, 'priority', v_priority, 'auto_actions', v_auto));

  return jsonb_build_object('report_id', v_report_id, 'deduped', false, 'priority', v_priority, 'auto_actions', v_auto);
end $$;
comment on function public.create_report is
  '신고 insert + 증거 스냅샷(jsonb) + 자동 분류/조치를 한 트랜잭션으로. 사진 파일의 evidence 버킷 복사는 D5 Edge Function 이 evidence.target_photos[].evidence_path 경로로 수행.';

-- ---------- 권한 ----------
revoke execute on all functions in schema public from public, anon;

grant execute on function public.loop_date(timestamptz), public.week_start_loop_date(timestamptz),
  public.age_years_kst(date, timestamptz), public.is_adult(date, timestamptz),
  public.current_profile_id(), public.app_role(), public.is_admin(), public.is_moderator(),
  public.active_sanction_level(uuid), public.are_blocked(uuid, uuid), public.match_id_of(uuid, uuid),
  public.is_matched(uuid, uuid), public.is_match_participant(uuid, uuid), public.is_recommended_recently(uuid, uuid),
  public.can_view_profile(uuid, uuid), public.get_effective_tier(uuid), public.weekly_superlike_used(uuid),
  public.report_default_priority(public.report_reason), public.report_sla_interval(public.report_priority),
  public.create_report(uuid, public.report_reason, text, uuid, public.report_surface, uuid),
  public.apply_block(uuid), public.remove_block(uuid)
to authenticated, service_role;

-- service role 전용(서버 액션·Edge Function·D8 어드민 API)
grant execute on function public.recompute_verify_level(uuid),
  public.issue_sanction(uuid, integer, text, interval, uuid, public.report_reason, uuid),
  public.apply_block_internal(uuid, uuid)
to service_role;

-- auth 스키마 트리거는 supabase_auth_admin 이 실행
grant execute on function public.handle_new_user(), public.handle_user_phone_confirmed() to supabase_auth_admin;
