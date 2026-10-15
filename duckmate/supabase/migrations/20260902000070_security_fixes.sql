-- =============================================================================
-- 0070 — G2 보안 리뷰 수정 (docs/agents/G2_security.md)
--   G2-01  0040/0050 신규 테이블·뷰·함수에 남은 default privilege 회수 (anon/authenticated)
--   G2-02  관계 오라클 차단: is_matched / match_id_of / is_recommended_recently 는 정의자 함수 내부 전용,
--          are_blocked / is_match_participant / can_view_profile / weekly_superlike_used /
--          get_effective_tier / has_marketing_consent 는 "본인 인자 또는 service/cron/moderator" 만 실행
--   G2-03  profiles / profile_hobbies 텍스트 컬럼 직접 update 우회 방어 (연락처 패턴·닉네임 30일 쿨다운)
--   G2-04  rate_limits 정리 함수(+pg_cron) · mask_contacts/detect_contacts 의 safety_preprocess 실행 권한
-- 모든 함수는 SECURITY DEFINER + search_path 고정. 시그니처 변경 없음(타입/앱 코드 영향 없음).
-- =============================================================================

-- ---------- G2-01 default privilege 잔재 회수 ----------
revoke all on public.admin_notifications, public.consent_rechecks, public.push_queue, public.rate_limits from public, anon, authenticated;
revoke all on public.push_templates from public, anon;   -- authenticated select(정책 push_templates_read)은 유지
revoke all on public.push_prefs from public, anon;       -- 본인 CRUD(RLS push_prefs_self)만 authenticated 에 남긴다
revoke all on public.reports_overdue, public.v_rule_hit_stats, public.v_messages, public.v_my_blocks,
  public.v_my_matches, public.v_profile_public, public.v_weekly_quota_used from public, anon;
revoke insert, update, delete, references, trigger, truncate on public.reports_overdue, public.v_rule_hit_stats,
  public.v_messages, public.v_my_blocks, public.v_my_matches, public.v_profile_public, public.v_weekly_quota_used from authenticated;
revoke execute on function public.can_like(uuid, uuid), public.can_send_message(uuid, uuid), public.can_send_chat_image(uuid, uuid)
  from public, anon;

-- ---------- G2-02 관계 오라클 ----------
-- 신뢰 호출자: service role JWT · DB 롤이 service_role(SET ROLE, 정의자 중첩과 무관하게 role GUC 로 판정) ·
--             JWT 없음(pg_cron/마이그레이션/psql) · moderator/admin JWT
create or replace function public.g2_trusted_caller()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), 'service_role') = 'service_role'
      or current_setting('role', true) = 'service_role'
      or coalesce(public.is_moderator(), false)
$$;
revoke execute on function public.g2_trusted_caller() from public, anon;
grant execute on function public.g2_trusted_caller() to authenticated, service_role;

-- 정의자 함수(can_view_profile · can_like · 푸시 스케줄러) 안에서만 호출된다 → 클라이언트 RPC 회수
revoke execute on function public.is_matched(uuid, uuid), public.match_id_of(uuid, uuid), public.is_recommended_recently(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.are_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.g2_trusted_caller() or public.current_profile_id() in (p_a, p_b) then
      exists (
        select 1 from public.blocks
        where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
      )
    else false end
$$;

create or replace function public.is_match_participant(p_match_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.g2_trusted_caller() or p_profile_id = public.current_profile_id() then
      exists (select 1 from public.matches where id = p_match_id and p_profile_id in (a_id, b_id))
    else false end
$$;

create or replace function public.can_view_profile(p_viewer uuid, p_target uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_viewer public.profiles%rowtype;
  v_target public.profiles%rowtype;
begin
  if p_viewer is null or p_target is null then return false; end if;
  -- G2: 제3자(viewer ≠ 나) 관계 조회 금지
  if not public.g2_trusted_caller() and p_viewer is distinct from public.current_profile_id() then return false; end if;
  if p_viewer = p_target then return true; end if;

  select * into v_viewer from public.profiles where id = p_viewer;
  select * into v_target from public.profiles where id = p_target;
  if v_viewer.id is null or v_target.id is null then return false; end if;

  if v_viewer.verify_level < 2 or v_viewer.status <> 'active' then return false; end if;
  if v_target.verify_level < 2 or v_target.status <> 'active' then return false; end if;
  if public.are_blocked(p_viewer, p_target) then return false; end if;

  if public.is_matched(p_viewer, p_target) then return true; end if;
  if v_target.hidden_at is not null then return false; end if;
  if public.active_sanction_level(p_target) >= 3 then return false; end if;
  return public.is_recommended_recently(p_viewer, p_target);
end $$;

create or replace function public.weekly_superlike_used(p_profile_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case
    when public.g2_trusted_caller() or p_profile_id = public.current_profile_id() then
      (select count(*)::integer from public.likes
       where from_id = p_profile_id and type = 'super'
         and public.loop_date(created_at) >= public.week_start_loop_date(now()))
    else 0 end
$$;

create or replace function public.get_effective_tier(p_user_id uuid)
returns public.subscription_tier language plpgsql stable security definer set search_path = public as $$
declare v_enabled boolean; v_tier public.subscription_tier;
begin
  if not public.g2_trusted_caller() and p_user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
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

create or replace function public.has_marketing_consent(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.g2_trusted_caller() or p_user_id = auth.uid() then
      coalesce((
        select c.agreed and c.withdrawn_at is null
        from public.consents c
        where c.user_id = p_user_id and c.key = 'marketing_push'
        order by c.agreed_at desc, c.id desc
        limit 1
      ), false)
    else false end
$$;

-- ---------- G2-03 프로필 텍스트 직접 update 우회 방어 ----------
-- 클라이언트는 PostgREST 로 profiles(nickname/bio/now_into/nickname_changed_at)·profile_hobbies(fav_note) 를
-- 직접 update 할 수 있어 서버 액션의 checkText()·30일 쿨다운을 건너뛸 수 있었다. 트리거가 최종 방어선.
create or replace function public.assert_no_contact_in_text(p_field text, p_text text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_text is null or btrim(p_text) = '' then return; end if;
  if jsonb_array_length(coalesce(public.detect_contacts(p_text) -> 'hits', '[]'::jsonb)) > 0 then
    raise exception 'INVALID_INPUT: contact_in_%', p_field using errcode = 'check_violation';
  end if;
end $$;
revoke execute on function public.assert_no_contact_in_text(text, text) from public, anon, authenticated;
grant execute on function public.assert_no_contact_in_text(text, text) to service_role;

create or replace function public.trg_profiles_user_text_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.g2_trusted_caller() then return new; end if;   -- service/cron/admin 경로는 그대로
  -- 닉네임 30일 쿨다운(NICKNAME_CHANGE_INTERVAL_DAYS) — nickname_changed_at 은 서버가 채운다(클라이언트 값 무시)
  if new.nickname is distinct from old.nickname then
    if old.nickname is not null and old.nickname_changed_at is not null
       and old.nickname_changed_at > now() - interval '30 days' then
      raise exception 'NOT_ENTITLED: nickname_change_interval' using errcode = '42501';
    end if;
    new.nickname_changed_at := case when old.nickname is null then old.nickname_changed_at else now() end;
  else
    new.nickname_changed_at := old.nickname_changed_at;
  end if;
  if new.nickname is distinct from old.nickname then perform public.assert_no_contact_in_text('nickname', new.nickname); end if;
  if new.bio      is distinct from old.bio      then perform public.assert_no_contact_in_text('bio', new.bio); end if;
  if new.now_into is distinct from old.now_into then perform public.assert_no_contact_in_text('now_into', new.now_into); end if;
  return new;
end $$;
drop trigger if exists trg_profiles_user_text_guard on public.profiles;
create trigger trg_profiles_user_text_guard
  before update of nickname, nickname_changed_at, bio, now_into on public.profiles
  for each row execute function public.trg_profiles_user_text_guard();

create or replace function public.trg_profile_hobbies_text_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.g2_trusted_caller() then return new; end if;
  if tg_op = 'INSERT' or new.fav_note is distinct from old.fav_note then
    perform public.assert_no_contact_in_text('fav_note', new.fav_note);
  end if;
  return new;
end $$;
drop trigger if exists trg_profile_hobbies_text_guard on public.profile_hobbies;
create trigger trg_profile_hobbies_text_guard
  before insert or update of fav_note on public.profile_hobbies
  for each row execute function public.trg_profile_hobbies_text_guard();

-- ---------- G2-04 rate_limits 정리 · safety_preprocess 권한 ----------
-- D2 §0-23 은 D7 purge_daily 에 rate_limits 정리를 요청했으나 미반영(0042/0051 에 없음). 키는 해시지만 무한 성장 방지.
create or replace function public.purge_rate_limits(p_older_than interval default interval '1 day')
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from public.rate_limits where updated_at < now() - p_older_than;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.purge_rate_limits(interval) from public, anon, authenticated;
grant execute on function public.purge_rate_limits(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from pg_namespace where nspname = 'cron') then
      perform cron.unschedule(jobid) from cron.job where jobname = 'dm_purge_rate_limits';
      perform cron.schedule('dm_purge_rate_limits', '20 18 * * *', $c$select public.purge_rate_limits()$c$);   -- 03:20 KST
    end if;
  else
    raise notice 'pg_cron not available: schedule dm_purge_rate_limits (select public.purge_rate_limits()) via dashboard';
  end if;
end $$;

-- 17_chat §29: mask_contacts/detect_contacts 는 authenticated 실행 가능해야 하지만 내부 safety_preprocess 권한이 없어 42501 이었다.
-- (순수 텍스트 함수, 데이터 접근 없음)
grant execute on function public.safety_preprocess(text), public.contact_rule_patterns() to authenticated;
