-- =============================================================================
-- 0021 — matching actions (D3)
--   · superlike_status(p_profile_id)        — 주간 쿼터/일 상한 상태 (본인만)
--   · act_on_recommendation(target, action) — like | super | pass. 상호 좋아요 → matches 생성 + suggestion_input 반환
--   · set_match_first_suggestion(match, cards) — service 전용. 비어 있을 때만 기록(멱등·레이스 안전)
--   · match_suggestion_input(match)         — 당사자용. 제안 카드 3장 조립 입력(TS buildSuggestions 가 사용)
--   · undo_last_action()                    — 300초, ENTITLEMENTS.undo (free = NOT_ENTITLED)
--   · likers_count() / pending_likes_count() / matching_home_summary() — 홈 카운터(무료: 숫자만)
--   · pg_cron: 06:50 KST(21:50 UTC) run_daily_recommendation_batch (pg_cron 없으면 notice 후 skip)
-- 의존: 0001~0014, 0020. 에러 코드는 constants.ts ERROR_CODES 접두어(첫 토큰)로 던진다.
-- =============================================================================

-- ---------- 슈퍼라이크 상태 ----------
create or replace function public.superlike_status(p_profile_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me    uuid := coalesce(p_profile_id, public.current_profile_id());
  v_uid   uuid;
  v_tier  public.subscription_tier;
  v_quota integer; v_used integer; v_cap integer; v_today integer;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if auth.role() <> 'service_role' and v_me <> public.current_profile_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select user_id into v_uid from public.profiles where id = v_me;
  v_tier  := public.get_effective_tier(v_uid);
  v_quota := public.entitlement_value(v_tier, 'weekly_superlike_quota')::integer;
  v_cap   := public.entitlement_value(v_tier, 'daily_superlike_cap')::integer;
  v_used  := public.weekly_superlike_used(v_me);
  select count(*) into v_today from public.likes
  where from_id = v_me and type = 'super' and public.loop_date(created_at) = public.loop_date(now());
  return jsonb_build_object('tier', v_tier, 'weekly_quota', v_quota, 'weekly_used', v_used,
    'weekly_remaining', greatest(0, v_quota - v_used), 'daily_cap', v_cap, 'used_today', v_today,
    'week_start', public.week_start_loop_date(now()), 'resets_at', 'monday 07:00 KST');
end $$;

-- ---------- 제안 카드 입력 (당사자 · service) ----------
create or replace function public.match_suggestion_input(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_m   public.matches%rowtype;
  v_me  uuid := public.current_profile_id();
  v_a   public.profiles%rowtype;
  v_b   public.profiles%rowtype;
  v_common jsonb; v_slots jsonb; v_ra public.regions%rowtype; v_rb public.regions%rowtype;
begin
  select * into v_m from public.matches where id = p_match_id;
  if v_m.id is null then raise exception 'NOT_FOUND: match' using errcode = 'no_data_found'; end if;
  if auth.role() <> 'service_role' and (v_me is null or v_me not in (v_m.a_id, v_m.b_id)) then
    raise exception 'FORBIDDEN: not a participant' using errcode = '42501';
  end if;
  select * into v_a from public.profiles where id = v_m.a_id;
  select * into v_b from public.profiles where id = v_m.b_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'hobby_id', h.id, 'slug', h.slug, 'name', h.name, 'category_slug', hc.slug,
           'rank_sum', ha.rank + hb.rank,
           'intensity_a', ha.intensity, 'intensity_b', hb.intensity,
           'fav_a', ha.fav_note, 'fav_b', hb.fav_note) order by ha.rank + hb.rank, h.id), '[]'::jsonb)
  into v_common
  from public.profile_hobbies ha
  join public.profile_hobbies hb on hb.hobby_id = ha.hobby_id and hb.profile_id = v_m.b_id
  join public.hobbies h on h.id = ha.hobby_id
  join public.hobby_categories hc on hc.id = h.category_id
  where ha.profile_id = v_m.a_id;

  select coalesce(jsonb_agg(jsonb_build_object('weekday', sa.weekday, 'slot', sa.slot) order by sa.weekday, sa.slot), '[]'::jsonb)
  into v_slots
  from public.availability sa
  join public.availability sb on sb.weekday = sa.weekday and sb.slot = sa.slot and sb.profile_id = v_m.b_id
  where sa.profile_id = v_m.a_id;

  select * into v_ra from public.regions where code = v_a.region_code;
  select * into v_rb from public.regions where code = v_b.region_code;

  return jsonb_build_object(
    'match_id', v_m.id, 'mode', v_m.mode, 'a_id', v_m.a_id, 'b_id', v_m.b_id,
    'common_hobbies', v_common,
    'common_slots', v_slots,
    'same_sido', (v_ra.sido_code is not null and v_ra.sido_code = v_rb.sido_code),
    'same_sigungu', (v_a.region_code is not null and v_a.region_code = v_b.region_code),
    'region_label', case when v_a.region_code = v_b.region_code then v_ra.sigungu
                         when v_ra.sido_code = v_rb.sido_code then v_ra.sido else null end,
    'categories_a', (select coalesce(jsonb_agg(distinct hc.slug), '[]'::jsonb) from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id join public.hobby_categories hc on hc.id = h.category_id where ph.profile_id = v_m.a_id),
    'categories_b', (select coalesce(jsonb_agg(distinct hc.slug), '[]'::jsonb) from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id join public.hobby_categories hc on hc.id = h.category_id where ph.profile_id = v_m.b_id),
    'has_now_into_a', v_a.now_into is not null, 'has_now_into_b', v_b.now_into is not null,
    'first_suggestion_set', jsonb_array_length(v_m.first_suggestion) > 0
  );
end $$;

-- ---------- 제안 카드 기록 (service 전용, 비어 있을 때만) ----------
create or replace function public.set_match_first_suggestion(p_match_id uuid, p_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cur jsonb;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) <> 3 then
    raise exception 'INVALID_INPUT: first_suggestion must be 3 cards' using errcode = 'check_violation';
  end if;
  select first_suggestion into v_cur from public.matches where id = p_match_id for update;
  if v_cur is null then raise exception 'NOT_FOUND: match' using errcode = 'no_data_found'; end if;
  if jsonb_array_length(v_cur) > 0 then
    return jsonb_build_object('set', false, 'first_suggestion', v_cur);
  end if;
  update public.matches set first_suggestion = p_cards where id = p_match_id;
  return jsonb_build_object('set', true, 'first_suggestion', p_cards);
end $$;

-- ---------- 좋아요 / 슈퍼라이크 / 패스 ----------
-- 반환 {action, reco_id, loop_date, already, matched, match_id, like_id, suggestion_input?, superlike?}
create or replace function public.act_on_recommendation(p_target_id uuid, p_action public.reco_action)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me     public.profiles%rowtype;
  v_t      public.profiles%rowtype;
  v_reco   public.daily_recommendations%rowtype;
  v_like   uuid;
  v_match  public.matches%rowtype;
  v_new_match boolean := false;
  v_sl     jsonb;
  v_ltype  public.like_type;
begin
  select * into v_me from public.profiles where user_id = auth.uid();
  if v_me.id is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_target_id is null or p_action is null then raise exception 'INVALID_INPUT: target/action' using errcode = 'check_violation'; end if;
  if p_target_id = v_me.id then raise exception 'INVALID_INPUT: self' using errcode = 'check_violation'; end if;

  -- 오늘(없으면 어제) 추천 행. 행 잠금으로 이중 클릭 직렬화
  select * into v_reco from public.daily_recommendations
  where profile_id = v_me.id and target_id = p_target_id and loop_date >= public.loop_date(now()) - 1
  order by loop_date desc limit 1 for update;
  if v_reco.id is null then raise exception 'NOT_FOUND: recommendation' using errcode = 'no_data_found'; end if;

  if v_reco.action is not null then
    if v_reco.action = p_action then
      select * into v_match from public.matches where a_id = least(v_me.id, p_target_id) and b_id = greatest(v_me.id, p_target_id);
      return jsonb_build_object('action', p_action, 'reco_id', v_reco.id, 'loop_date', v_reco.loop_date, 'already', true,
                                'matched', v_match.id is not null and v_match.status = 'active', 'match_id', v_match.id);
    end if;
    raise exception 'ALREADY_ACTED: %', v_reco.action using errcode = 'check_violation';
  end if;

  if p_action = 'pass' then
    update public.daily_recommendations set action = 'pass', acted_at = now(), seen_at = coalesce(seen_at, now()) where id = v_reco.id;
    return jsonb_build_object('action', 'pass', 'reco_id', v_reco.id, 'loop_date', v_reco.loop_date, 'already', false, 'matched', false);
  end if;

  -- like / super: RLS 판정 함수와 동일한 can_like → 실패 사유 매핑
  select * into v_t from public.profiles where id = p_target_id;
  if not public.can_like(v_me.id, p_target_id) then
    if v_me.verify_level < 2 then raise exception 'NOT_VERIFIED' using errcode = '42501'; end if;
    if public.active_sanction_level(v_me.id) >= 2 then raise exception 'SANCTIONED' using errcode = '42501'; end if;
    if v_me.status <> 'active' then raise exception 'NOT_ENTITLED: status %', v_me.status using errcode = '42501'; end if;
    raise exception 'NOT_ENTITLED: target unavailable' using errcode = '42501';
  end if;

  if p_action = 'super' then
    v_sl := public.superlike_status(v_me.id);
    if (v_sl ->> 'used_today')::integer >= (v_sl ->> 'daily_cap')::integer then
      raise exception 'NOT_ENTITLED: SUPERLIKE_DAILY_CAP' using errcode = '42501';
    end if;
    if (v_sl ->> 'weekly_remaining')::integer <= 0 then
      raise exception 'NOT_ENTITLED: NO_SUPERLIKE' using errcode = '42501';
    end if;
  end if;
  v_ltype := case when p_action = 'super' then 'super'::public.like_type else 'like'::public.like_type end;

  insert into public.likes (from_id, to_id, type) values (v_me.id, p_target_id, v_ltype)
  on conflict (from_id, to_id) do update set type = greatest(public.likes.type, excluded.type)
  returning id into v_like;

  update public.daily_recommendations set action = p_action, acted_at = now(), seen_at = coalesce(seen_at, now()) where id = v_reco.id;

  -- 상호 좋아요 → 매칭 (least/greatest 정규화, 유니크). 종료된 매칭(left/blocked/paused)은 되살리지 않는다
  if exists (select 1 from public.likes l where l.from_id = p_target_id and l.to_id = v_me.id) then
    insert into public.matches (a_id, b_id, mode) values (least(v_me.id, p_target_id), greatest(v_me.id, p_target_id), v_me.mode)
    on conflict (a_id, b_id) do nothing
    returning * into v_match;
    if v_match.id is not null then
      v_new_match := true;
      -- 상대의 오늘 추천 행(있으면)도 acted 로: 단일 진실(A3 §9 F 열린 질문 해소)
      update public.daily_recommendations set action = 'like', acted_at = now(), seen_at = coalesce(seen_at, now())
      where profile_id = p_target_id and target_id = v_me.id and action is null and loop_date >= public.loop_date(now()) - 1;
      insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
      values (auth.uid(), 'user', 'match_created', 'match', v_match.id::text,
              jsonb_build_object('a_id', v_match.a_id, 'b_id', v_match.b_id, 'mode', v_match.mode, 'initiator', v_me.id, 'like_type', v_ltype));
      -- D7 훅: matches insert(Realtime/DB webhook) 이 정식. 보조로 NOTIFY
      perform pg_notify('duckmate_match', jsonb_build_object('match_id', v_match.id, 'a_id', v_match.a_id, 'b_id', v_match.b_id)::text);
    else
      select * into v_match from public.matches where a_id = least(v_me.id, p_target_id) and b_id = greatest(v_me.id, p_target_id);
    end if;
  end if;

  return jsonb_build_object(
    'action', p_action, 'reco_id', v_reco.id, 'loop_date', v_reco.loop_date, 'already', false,
    'like_id', v_like,
    'matched', v_new_match, 'match_id', case when v_new_match then v_match.id else null end,
    'existing_match_status', case when not v_new_match and v_match.id is not null then v_match.status::text else null end,
    'suggestion_input', case when v_new_match then public.match_suggestion_input(v_match.id) else null end,
    'superlike', case when p_action = 'super' then public.superlike_status(v_me.id) else null end
  );
end $$;
comment on function public.act_on_recommendation is 'authenticated. like|super|pass. can_like 준수, 슈퍼라이크 주간 쿼터(무료 1)·일 상한 5, 상호 좋아요 시 matches 생성 + suggestion_input 반환(서버 액션이 buildSuggestions → set_match_first_suggestion).';

-- ---------- 되돌리기 (300초, ENTITLEMENTS.undo) ----------
create or replace function public.undo_last_action()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me   public.profiles%rowtype;
  v_tier public.subscription_tier;
  v_reco public.daily_recommendations%rowtype;
  v_win  integer := public.entitlement_value('free', 'undo_window_sec')::integer;
begin
  select * into v_me from public.profiles where user_id = auth.uid();
  if v_me.id is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  v_tier := public.get_effective_tier(v_me.user_id);
  if public.entitlement_value(v_tier, 'undo') <> 1 then
    raise exception 'NOT_ENTITLED: undo requires plus' using errcode = '42501';
  end if;
  select * into v_reco from public.daily_recommendations
  where profile_id = v_me.id and acted_at is not null
  order by acted_at desc limit 1 for update;
  if v_reco.id is null or v_reco.acted_at < now() - make_interval(secs => v_win) then
    raise exception 'NOT_FOUND: EXPIRED' using errcode = 'no_data_found';
  end if;
  if v_reco.action in ('like', 'super') then
    if exists (select 1 from public.matches m where m.a_id = least(v_me.id, v_reco.target_id) and m.b_id = greatest(v_me.id, v_reco.target_id)) then
      raise exception 'ALREADY_ACTED: matched' using errcode = 'check_violation';
    end if;
    delete from public.likes where from_id = v_me.id and to_id = v_reco.target_id;
  end if;
  update public.daily_recommendations set action = null, acted_at = null where id = v_reco.id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
  values (auth.uid(), 'user', 'reco_action_undone', 'daily_recommendation', v_reco.id::text,
          jsonb_build_object('previous_action', v_reco.action, 'target_id', v_reco.target_id));
  return jsonb_build_object('reco_id', v_reco.id, 'target_id', v_reco.target_id, 'previous_action', v_reco.action, 'loop_date', v_reco.loop_date);
end $$;

-- ---------- 홈 카운터 ----------
create or replace function public.likers_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.likes l
  join public.profiles p on p.id = l.from_id
  where l.to_id = public.current_profile_id()
    and p.status = 'active' and p.hidden_at is null
    and not public.are_blocked(l.from_id, l.to_id)
    and not exists (select 1 from public.matches m where m.a_id = least(l.from_id, l.to_id) and m.b_id = greatest(l.from_id, l.to_id))
$$;
comment on function public.likers_count is '나를 좋아한 사람 수(미매칭). 무료 티어는 숫자만 노출(see_likers=blur). 0이면 유료 안내 없음.';

create or replace function public.pending_likes_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.likes l
  where l.from_id = public.current_profile_id()
    and not exists (select 1 from public.matches m where m.a_id = least(l.from_id, l.to_id) and m.b_id = greatest(l.from_id, l.to_id))
$$;

create or replace function public.matching_home_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id(); v_ld date := public.loop_date(now());
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return jsonb_build_object(
    'loop_date', v_ld,
    'reco_total',     (select count(*) from public.daily_recommendations d where d.profile_id = v_me and d.loop_date = v_ld and not public.are_blocked(d.profile_id, d.target_id)),
    'reco_remaining', (select count(*) from public.daily_recommendations d where d.profile_id = v_me and d.loop_date = v_ld and d.acted_at is null and not public.are_blocked(d.profile_id, d.target_id)),
    'pending_results', public.pending_likes_count(),
    'matches_today',  (select count(*) from public.matches m where v_me in (m.a_id, m.b_id) and public.loop_date(m.matched_at) = v_ld),
    'likers_count',   public.likers_count(),
    'superlike',      public.superlike_status(v_me)
  );
end $$;

-- ---------- pg_cron: 06:50 KST = 21:50 UTC (pg_cron 은 UTC) ----------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'duckmate_daily_recommendations';
    perform cron.schedule('duckmate_daily_recommendations', '50 21 * * *',
      $job$ select public.run_daily_recommendation_batch(null, null, 0) $job$);
    raise notice 'pg_cron job duckmate_daily_recommendations scheduled (21:50 UTC = 06:50 KST)';
  else
    raise notice 'pg_cron not available: skip schedule (Supabase 프로덕션에서는 자동 등록됨)';
  end if;
end $$;

-- ---------- 권한 ----------
revoke execute on function
  public.superlike_status(uuid),
  public.match_suggestion_input(uuid),
  public.set_match_first_suggestion(uuid, jsonb),
  public.act_on_recommendation(uuid, public.reco_action),
  public.undo_last_action(),
  public.likers_count(), public.pending_likes_count(), public.matching_home_summary()
from public, anon, authenticated;

grant execute on function
  public.superlike_status(uuid),
  public.match_suggestion_input(uuid),
  public.act_on_recommendation(uuid, public.reco_action),
  public.undo_last_action(),
  public.likers_count(), public.pending_likes_count(), public.matching_home_summary()
to authenticated, service_role;

grant execute on function public.set_match_first_suggestion(uuid, jsonb) to service_role;
