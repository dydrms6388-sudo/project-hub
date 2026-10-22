-- ============================================================================
-- BETWEEN — 권한 / RLS / 공개 뷰 / RPC
--
-- 핵심 원칙
--  * Supabase Anonymous Auth 사용자도 role=authenticated 이다. "로그인됨" 만으로
--    아무 행이나 수정할 수 없도록 모든 정책은 auth.uid() 소유권을 검사한다.
--  * 운영자 권한은 admin_roles + "익명이 아닌(JWT is_anonymous=false)" 계정에만.
--  * 타인 프로필은 원본 테이블이 아니라 마스킹된 뷰 public.profile_cards 로만 조회.
--  * 상태 컬럼(status, suspended_until, last_active_at …)은 컬럼 권한으로 사용자 수정 차단.
--  * SECURITY DEFINER 함수는 search_path = '' 로 고정하고 전부 스키마 한정 이름 사용.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 헬퍼 함수
-- ---------------------------------------------------------------------------
create or replace function public.jwt_is_anonymous() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.is_active_member(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid
      and (p.status = 'active'
           or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until < now()))
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not public.jwt_is_anonymous()
     and exists (select 1 from public.admin_roles r where r.user_id = auth.uid())
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.is_matched(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.matches m
    where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.unmatched_at is null
  )
$$;

-- 현재 요청자(auth.uid())가 target 프로필을 볼 수 있는가
create or replace function public.is_visible_profile(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and public.is_active_member(auth.uid())
     and exists (
       select 1 from public.profiles p
       where p.id = p_target
         and not p.is_hidden
         and (p.expires_at is null or p.expires_at > now())
         and (p.status = 'active'
              or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until < now()))
     )
     and not public.is_blocked_between(auth.uid(), p_target)
$$;

create or replace function public.profile_exists(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_id)
$$;

-- 필드 공개 여부. 기본값: 몸무게·성향·동 은 비공개, 나머지 공개
create or replace function public.field_public(p_visibility jsonb, p_field text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    p_visibility ->> p_field,
    case when p_field in ('weight', 'position', 'dong') then 'private' else 'public' end
  ) = 'public'
$$;

-- ---------------------------------------------------------------------------
-- 공개 프로필 카드 뷰 (마스킹). 뷰 소유자 권한으로 실행되며 WHERE 절이 접근 제어를 수행.
-- 정확한 last_active_at / 좌표 / 주소는 노출하지 않는다.
-- ---------------------------------------------------------------------------
create view public.profile_cards with (security_barrier = true) as
select
  p.id,
  p.nickname,
  p.birth_year,
  (extract(year from (now() at time zone 'Asia/Seoul'))::int - p.birth_year) as age,
  p.sido,
  case when public.field_public(p.field_visibility, 'sigungu') then p.sigungu end as sigungu,
  case when public.field_public(p.field_visibility, 'dong') then p.dong end as dong,
  case when public.field_public(p.field_visibility, 'height') then p.height end as height,
  case when public.field_public(p.field_visibility, 'weight') then p.weight end as weight,
  case when public.field_public(p.field_visibility, 'body_type') then p.body_type end as body_type,
  case when p.sensitive_consent_at is not null and public.field_public(p.field_visibility, 'position')
       then p.position end as position,
  case when public.field_public(p.field_visibility, 'styles') then p.styles else '{}'::text[] end as styles,
  case when public.field_public(p.field_visibility, 'personality') then p.personality else '{}'::text[] end as personality,
  case when public.field_public(p.field_visibility, 'interests') then p.interests else '{}'::text[] end as interests,
  case when public.field_public(p.field_visibility, 'bio') then p.bio end as bio,
  case when public.field_public(p.field_visibility, 'purposes') then p.purposes else '{}'::text[] end as purposes,
  case when public.field_public(p.field_visibility, 'active_times') then p.active_times else '{}'::text[] end as active_times,
  case when public.field_public(p.field_visibility, 'smoking') then p.smoking end as smoking,
  case when public.field_public(p.field_visibility, 'drinking') then p.drinking end as drinking,
  case
    when a.status is null then 'off'::public.availability
    when a.expires_at is not null and a.expires_at <= now() then 'off'::public.availability
    else a.status
  end as availability,
  case
    when p.last_active_at > now() - interval '10 minutes' then 'online'
    when p.last_active_at > now() - interval '1 day' then 'today'
    when p.last_active_at > now() - interval '7 days' then 'week'
    else 'away'
  end as presence,
  date_trunc('hour', p.last_active_at) as active_hour,
  date_trunc('day', p.created_at) as joined_day,
  (p.created_at > now() - interval '7 days') as is_new,
  ph.primary_photo_id,
  coalesce(ph.photo_count, 0)::int as photo_count
from public.profiles p
left join public.activity_status a on a.user_id = p.id
left join lateral (
  select
    (array_agg(x.id order by x.position, x.created_at))[1] as primary_photo_id,
    count(*) as photo_count
  from public.profile_photos x
  where x.user_id = p.id and x.removed_at is null and x.visibility = 'public'
) ph on true
where (select auth.uid()) is not null
  and (select public.is_active_member(auth.uid()))
  and not p.is_hidden
  and (p.expires_at is null or p.expires_at > now())
  and (p.status = 'active'
       or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until < now()))
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
  );

comment on view public.profile_cards is
  'Masked, access-controlled public profile projection. The only way for users to read other profiles.';

-- ---------------------------------------------------------------------------
-- 트리거: 상호 좋아요 → 매칭 / 차단 → 매칭 해제 / 신고 누적 → 자동 보류
-- ---------------------------------------------------------------------------
create or replace function public.likes_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'like' and exists (
    select 1 from public.likes l
    where l.liker_id = new.target_id and l.target_id = new.liker_id and l.kind = 'like'
  ) and not public.is_blocked_between(new.liker_id, new.target_id) then
    insert into public.matches (user_a, user_b)
    values (least(new.liker_id, new.target_id), greatest(new.liker_id, new.target_id))
    on conflict (user_a, user_b) do nothing;
  end if;
  return new;
end $$;
create trigger likes_after_insert after insert on public.likes
  for each row execute function public.likes_after_insert();

create or replace function public.blocks_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.matches
     set unmatched_at = now(), unmatched_by = new.blocker_id
   where user_a = least(new.blocker_id, new.blocked_id)
     and user_b = greatest(new.blocker_id, new.blocked_id)
     and unmatched_at is null;
  return new;
end $$;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- 서로 다른 신고자 3명(미성년 의심은 2명) 이상의 미처리 신고 → 검토 전 자동 노출 중지
create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_total int;
  v_minor int;
begin
  select count(distinct reporter_id),
         count(distinct reporter_id) filter (where reason = 'minor')
    into v_total, v_minor
    from public.reports
   where reported_id = new.reported_id and status = 'open';

  if (v_total >= 3 or v_minor >= 2) and exists (
    select 1 from public.profiles where id = new.reported_id and status = 'active'
  ) then
    update public.profiles set status = 'suspended', suspended_until = null
     where id = new.reported_id;
    insert into public.moderation_actions (admin_id, target_user_id, report_id, action, reason)
    values (null, new.reported_id, new.id, 'auto_hold', 'report threshold reached');
  end if;
  return new;
end $$;
create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------
create or replace function public.unmatch(p_match_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  update public.matches
     set unmatched_at = now(), unmatched_by = auth.uid()
   where id = p_match_id
     and auth.uid() in (user_a, user_b)
     and unmatched_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

-- 마지막 활동 시각 갱신 (2분 이내 중복 갱신 생략)
create or replace function public.touch_activity() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now()
   where id = auth.uid() and last_active_at < now() - interval '2 minutes'
$$;

-- 고정 윈도 rate limit. true = 허용. authenticated 호출 시 키는 항상 사용자 ID 로 한정
create or replace function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_window timestamptz;
  v_count int;
begin
  if p_window_seconds < 1 or p_limit < 1 or char_length(p_bucket) > 100 then
    raise exception 'INVALID_RATE_LIMIT';
  end if;
  if auth.role() = 'authenticated' then
    if auth.uid() is null then
      return false;
    end if;
    v_key := 'u:' || auth.uid()::text || ':' || p_bucket;
  else
    v_key := p_bucket;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, count)
  values (v_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end $$;

-- 운영자 조치 (운영자 = admin_roles + 익명 아님)
create or replace function public.moderate(
  p_target uuid,
  p_action public.moderation_kind,
  p_reason text default null,
  p_hours int default null,
  p_report_id uuid default null,
  p_photo_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_expires timestamptz;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  if p_action = 'auto_hold' then
    raise exception 'INVALID_ACTION';
  end if;
  if p_hours is not null then
    if p_hours < 1 or p_hours > 24 * 365 then
      raise exception 'INVALID_DURATION';
    end if;
    v_expires := now() + make_interval(hours => p_hours);
  end if;

  case p_action
    when 'suspend' then
      update public.profiles set status = 'suspended', suspended_until = v_expires where id = p_target;
    when 'ban' then
      update public.profiles set status = 'banned', suspended_until = null where id = p_target;
      update public.matches set unmatched_at = now(), unmatched_by = auth.uid()
       where (user_a = p_target or user_b = p_target) and unmatched_at is null;
    when 'hide_profile' then
      update public.profiles set is_hidden = true where id = p_target;
    when 'remove_photo' then
      update public.profile_photos set removed_at = now()
       where id = p_photo_id and user_id = p_target;
    when 'restore' then
      update public.profiles set status = 'active', suspended_until = null, is_hidden = false
       where id = p_target;
    else
      null; -- warn / dismiss_report: 기록만
  end case;

  if p_report_id is not null then
    update public.reports
       set status = case when p_action = 'dismiss_report' then 'dismissed'::public.report_status
                         else 'actioned'::public.report_status end,
           handled_by = auth.uid(), handled_at = now()
     where id = p_report_id and reported_id = p_target;
  end if;
  -- 같은 대상의 나머지 미처리 신고도 함께 정리 (기각 제외)
  if p_action in ('suspend', 'ban', 'hide_profile') then
    update public.reports set status = 'actioned', handled_by = auth.uid(), handled_at = now()
     where reported_id = p_target and status = 'open';
  end if;

  insert into public.moderation_actions (admin_id, target_user_id, report_id, action, reason, expires_at)
  values (auth.uid(), p_target, p_report_id, p_action, p_reason, v_expires)
  returning id into v_id;
  return v_id;
end $$;

-- 만료 처리 (서버 크론 전용). 만료 7일 경과 프로필의 auth 사용자 삭제 → cascade.
-- 삭제된 사진의 storage 경로를 반환해 호출자가 Storage 에서도 지운다.
create or replace function public.purge_expired() returns setof text
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  update public.activity_status set status = 'off', expires_at = null
   where expires_at is not null and expires_at <= now();
  return query
    with doomed as (
      select p.id from public.profiles p
       where p.expires_at is not null and p.expires_at < now() - interval '7 days'
    ), paths as (
      select ph.storage_path from public.profile_photos ph join doomed d on d.id = ph.user_id
    ), del as (
      delete from auth.users u using doomed d where u.id = d.id
    )
    select storage_path from paths;
end $$;

-- ---------------------------------------------------------------------------
-- RLS 활성화
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.contact_methods enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.admin_roles enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.activity_status enable row level security;
alter table public.rate_limits enable row level security;
alter table public.account_recovery enable row level security;

-- profiles: 본인 행만 (타인은 profile_cards 뷰로만), 운영자는 전체 조회
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and status <> 'banned')
  with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

-- profile_photos
create policy photos_select on public.profile_photos for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (removed_at is null
        and public.is_visible_profile(user_id)
        and (visibility = 'public' or public.is_matched((select auth.uid()), user_id)))
  );
create policy photos_insert_own on public.profile_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
    and (select public.is_active_member(auth.uid()))
  );
create policy photos_update_own on public.profile_photos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy photos_delete_own on public.profile_photos for delete to authenticated
  using (user_id = (select auth.uid()));

-- profile_preferences: 본인만
create policy prefs_all_own on public.profile_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- contact_methods: 공개 또는 매칭 상대에게만. 비공개 연락처는 뷰가 아닌 이 정책으로 분리
create policy contacts_select on public.contact_methods for select to authenticated
  using (
    user_id = (select auth.uid())
    or (public.is_visible_profile(user_id)
        and (visibility = 'public' or public.is_matched((select auth.uid()), user_id)))
  );
create policy contacts_insert_own on public.contact_methods for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_member(auth.uid())));
create policy contacts_update_own on public.contact_methods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy contacts_delete_own on public.contact_methods for delete to authenticated
  using (user_id = (select auth.uid()));

-- likes: 보낸 기록 + 나를 좋아요한 기록(pass 는 상대에게 비공개)
create policy likes_select on public.likes for select to authenticated
  using (
    liker_id = (select auth.uid())
    or (target_id = (select auth.uid()) and kind = 'like' and public.is_visible_profile(liker_id))
  );
create policy likes_insert_own on public.likes for insert to authenticated
  with check (
    liker_id = (select auth.uid())
    and (select public.is_active_member(auth.uid()))
    and public.is_visible_profile(target_id)
  );
create policy likes_delete_own on public.likes for delete to authenticated
  using (liker_id = (select auth.uid()));

-- matches: 당사자만 조회. 생성은 트리거, 해제는 unmatch() 로만
create policy matches_select_participant on public.matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- blocks: 본인 차단 목록만
create policy blocks_select_own on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy blocks_insert_own on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- reports: 본인 신고 생성/조회, 운영자 전체 조회
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and reported_id <> (select auth.uid())
    and public.profile_exists(reported_id)
    and status = 'open'
  );
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

-- admin_roles / moderation_actions
create policy admin_roles_select on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy moderation_select_admin on public.moderation_actions for select to authenticated
  using ((select public.is_admin()));

-- activity_status: 본인만 (타인은 뷰의 availability 로만)
create policy activity_select_own on public.activity_status for select to authenticated
  using (user_id = (select auth.uid()));
create policy activity_insert_own on public.activity_status for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_member(auth.uid())));
create policy activity_update_own on public.activity_status for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_active_member(auth.uid())));

-- rate_limits / account_recovery: 정책 없음 = authenticated/anon 접근 불가 (service_role 전용)

-- ---------------------------------------------------------------------------
-- 권한 (Supabase 기본 grant 를 걷어내고 최소 권한만 부여)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on public.profile_cards to authenticated;

grant select, delete on public.profiles to authenticated;
grant insert (
  id, nickname, birth_year, sido, sigungu, dong, height, weight, body_type, position,
  styles, personality, interests, bio, purposes, active_times, smoking, drinking,
  field_visibility, is_hidden, expires_at, adult_confirmed_at, privacy_consent_at, sensitive_consent_at
) on public.profiles to authenticated;
grant update (
  nickname, birth_year, sido, sigungu, dong, height, weight, body_type, position,
  styles, personality, interests, bio, purposes, active_times, smoking, drinking,
  field_visibility, is_hidden, expires_at, sensitive_consent_at
) on public.profiles to authenticated;

grant select, delete on public.profile_photos to authenticated;
grant insert (id, user_id, storage_path, position, width, height, bytes, visibility)
  on public.profile_photos to authenticated;
grant update (position, visibility) on public.profile_photos to authenticated;

grant select, insert, update, delete on public.profile_preferences to authenticated;

grant select, delete on public.contact_methods to authenticated;
grant insert (user_id, kind, value, visibility) on public.contact_methods to authenticated;
grant update (value, visibility) on public.contact_methods to authenticated;

grant select, delete on public.likes to authenticated;
grant insert (liker_id, target_id, kind) on public.likes to authenticated;

grant select on public.matches to authenticated;

grant select, delete on public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

grant select on public.reports to authenticated;
grant insert (reporter_id, reported_id, reason, detail) on public.reports to authenticated;

grant select on public.admin_roles to authenticated;
grant select on public.moderation_actions to authenticated;

grant select on public.activity_status to authenticated;
grant insert (user_id, status, expires_at) on public.activity_status to authenticated;
grant update (status, expires_at) on public.activity_status to authenticated;

grant execute on function
  public.jwt_is_anonymous(),
  public.is_active_member(uuid),
  public.is_admin(),
  public.is_blocked_between(uuid, uuid),
  public.is_matched(uuid, uuid),
  public.is_visible_profile(uuid),
  public.profile_exists(uuid),
  public.field_public(jsonb, text),
  public.unmatch(uuid),
  public.touch_activity(),
  public.rate_limit_hit(text, int, int),
  public.moderate(uuid, public.moderation_kind, text, int, uuid, uuid)
to authenticated;

revoke execute on function public.purge_expired() from authenticated;
