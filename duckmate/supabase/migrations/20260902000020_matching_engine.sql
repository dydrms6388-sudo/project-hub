-- =============================================================================
-- 0020 — matching engine (D3)
--   · app_settings: reco_params / reco_gender_balance (service role 전용 런타임 파라미터)
--   · entitlement_value(tier, key)      — ENTITLEMENTS 미러(SQL 쪽 단일 지점)
--   · pair_features(a, b)                — 점수 구성요소 + reasons jsonb (한 번의 조회로 4항 + 보정 계산)
--   · score_pair(a profiles, b profiles) — 최종 점수 numeric(0~1)
--   · reco_reasons(a, b)                 — 추천 이유 jsonb
--   · reco_candidates(profile, loop_date)— 후보 필터(모드·가시성·차단·성별·리전 폴백·재노출 규칙)
--   · generate_daily_recommendations()   — 후보 점수화 → 우선 노출 규칙 → insert (멱등)
--   · run_daily_recommendation_batch()   — 활성 프로필 순회(페이지) — pg_cron / Edge Function 공용
--   · ensure_today_recommendations()     — 유저 첫 접속 온디맨드 생성 (authenticated)
--   · v_reco_daily_summary / v_reco_metrics_daily / v_reco_gender_balance — D7 푸시·D8 지표(service role)
-- 의존: 0001~0014 만. 다른 D 에이전트 마이그레이션(003x~006x)에 의존하지 않는다.
-- 모든 SECURITY DEFINER 함수는 search_path 를 고정한다. service 전용 함수는 public/anon/authenticated 에서 execute 회수.
-- =============================================================================

-- ---------- 런타임 파라미터 (service role 전용 app_settings) ----------
insert into public.app_settings (key, value) values
  ('reco_params', jsonb_build_object(
    'liker_ratio',          0.40,   -- 나를 좋아한 사람 일일 상한 비율(pro liker_priority 면 해제)
    'liker_bonus',          0.10,   -- 나를 좋아함 보정
    'new_bonus',            0.05,   -- 신규 72h 완성 프로필 보정
    'new_hours',            72,
    'new_daily_exposure_cap', 40,   -- 신규 부스트 일 노출 상한(초과 시 보정 없이 순수 점수)
    'active_bonus',         0.03,   -- 최근 활동 48h
    'inactive_penalty',     0.10,   -- 7일 이상 미활동
    'boost_bonus',          0.15,   -- Phase 3 유료 부스트(온디맨드 생성에만)
    'region_pool_min',      300,    -- 같은 시도 풀이 이보다 작으면 전국 폴백
    'pass_cooldown_days',   30,
    'seen_cooldown_days',   7,
    'seen_second_cooldown_days', 30,
    'inactive_exclude_days', 14,    -- 미접속 14일 후보 제외
    'viewer_inactive_days', 30,     -- 배치 생성 대상(뷰어) 범위: 최근 30일 접속. 그 외는 온디맨드
    'intensity_penalty_gap', 3,     -- |intensity 차| ≥ 3 → 해당 태그 기여 ×0.5
    'quiz_min_answers',     3       -- 3문항 미만이면 퀴즈 항 중립 0.5
  )),
  ('reco_gender_balance', jsonb_build_object(
    'enabled',               true,
    'min_female_ratio',      0.35,  -- 데이팅 모드 여성 비율이 이보다 낮으면 큐 조정 발동
    'female_daily_exposure_cap', 30 -- 남성 뷰어 추천에 같은 여성 프로필이 하루 노출되는 상한
  ))
on conflict (key) do nothing;

create or replace function public.reco_param(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> p_key)::numeric from public.app_settings where key = 'reco_params'), p_default)
$$;

-- ---------- ENTITLEMENTS 미러 (packages/db/src/entitlements.ts 와 값 동기 유지) ----------
create or replace function public.entitlement_value(p_tier public.subscription_tier, p_key text)
returns numeric language sql immutable parallel safe as $$
  select case p_key
    when 'daily_reco_limit'       then case p_tier when 'pro' then 30 when 'plus' then 15 else 5 end
    when 'weekly_superlike_quota' then case p_tier when 'pro' then 15 when 'plus' then 5 else 1 end
    when 'undo'                   then case p_tier when 'free' then 0 else 1 end
    when 'liker_priority'         then case p_tier when 'pro' then 1 else 0 end
    when 'daily_superlike_cap'    then 5
    when 'undo_window_sec'        then 300
    else null end::numeric
$$;
comment on function public.entitlement_value is 'ENTITLEMENTS[tier][key] 의 SQL 미러. Phase 1 은 get_effective_tier() 가 항상 free.';

-- ---------- 완성 프로필 판정 (신규 부스트 조건: 승인 사진 1 + Top3 + 퀴즈 10) ----------
create or replace function public.is_complete_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.photos ph where ph.profile_id = p_profile_id and ph.review_status = 'approved')
     and (select count(*) from public.profile_hobbies h where h.profile_id = p_profile_id and h.rank <= 3) = 3
     and (select count(*) from public.quiz_answers q where q.profile_id = p_profile_id) >= 10
$$;

-- ---------- 점수 구성요소 + 이유 (a = 뷰어, b = 후보) ----------
-- 반환 jsonb:
--   { hobby, quiz, avail, mutual, base, liker, active_bonus, inactive_penalty, new_eligible, boost,
--     score_no_new, score_with_new, reasons: [...] }
create or replace function public.pair_features(p_a uuid, p_b uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_a            public.profiles%rowtype;
  v_b            public.profiles%rowtype;
  v_gap          numeric := public.reco_param('intensity_penalty_gap', 3);
  v_quiz_min     integer := public.reco_param('quiz_min_answers', 3)::integer;
  v_tag_inter    numeric := 0;
  v_tag_union    numeric := 0;
  v_cat_inter    integer := 0;
  v_cat_union    integer := 0;
  v_hobby        numeric := 0;
  v_tag_j        numeric := 0;
  v_cat_j        numeric := 0;
  v_quiz         numeric := 0.5;
  v_qa           integer;
  v_qb           integer;
  v_dot          numeric := 0;
  v_na           numeric := 0;
  v_nb           numeric := 0;
  v_avail        numeric := 0;
  v_slot_inter   integer := 0;
  v_slot_union   integer := 0;
  v_mutual       numeric := 0;
  v_liker        boolean := false;
  v_active_bonus numeric := 0;
  v_inactive_pen numeric := 0;
  v_new_eligible boolean := false;
  v_boost        numeric := 0;
  v_base         numeric;
  v_adj          numeric;
  v_reasons      jsonb := '[]'::jsonb;
  v_common       jsonb;
  v_common_cats  jsonb;
  v_slots        jsonb;
  v_slot_label   text;
  v_quiz_same    integer := 0;
  v_quiz_total   integer := 0;
  v_same_sido    boolean := false;
  v_same_sigungu boolean := false;
  v_sido         text;
begin
  select * into v_a from public.profiles where id = p_a;
  select * into v_b from public.profiles where id = p_b;
  if v_a.id is null or v_b.id is null then return null; end if;

  -- 1) 취미: 세부 태그 가중 자카드(Top3 ×2, intensity 차 ≥ gap → 기여 ×0.5) 0.7 + 카테고리 자카드 0.3
  select
    coalesce(sum(case when ha.hobby_id is not null and hb.hobby_id is not null
                      then least(ha.w, hb.w) * (case when abs(ha.intensity - hb.intensity) >= v_gap then 0.5 else 1 end)
                      else 0 end), 0),
    coalesce(sum(greatest(coalesce(ha.w, 0), coalesce(hb.w, 0))), 0)
  into v_tag_inter, v_tag_union
  from (select hobby_id, intensity, case when rank <= 3 then 2 else 1 end as w from public.profile_hobbies where profile_id = p_a) ha
  full outer join (select hobby_id, intensity, case when rank <= 3 then 2 else 1 end as w from public.profile_hobbies where profile_id = p_b) hb
    on ha.hobby_id = hb.hobby_id;
  v_tag_j := case when v_tag_union > 0 then v_tag_inter / v_tag_union else 0 end;

  select count(*) filter (where ca.category_id is not null and cb.category_id is not null), count(*)
  into v_cat_inter, v_cat_union
  from (select distinct h.category_id from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id where ph.profile_id = p_a) ca
  full outer join (select distinct h.category_id from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id where ph.profile_id = p_b) cb
    on ca.category_id = cb.category_id;
  v_cat_j := case when v_cat_union > 0 then v_cat_inter::numeric / v_cat_union else 0 end;
  v_hobby := 0.7 * v_tag_j + 0.3 * v_cat_j;

  -- 2) 퀴즈: (문항, 선택) one-hot × 문항 weight 의 코사인. 어느 한쪽 3문항 미만 → 0.5 중립
  select count(*) into v_qa from public.quiz_answers where profile_id = p_a;
  select count(*) into v_qb from public.quiz_answers where profile_id = p_b;
  if v_qa >= v_quiz_min and v_qb >= v_quiz_min then
    select coalesce(sum(case when qa.choice = qb.choice then q.weight * q.weight else 0 end), 0),
           count(*) filter (where qa.choice = qb.choice), count(*)
    into v_dot, v_quiz_same, v_quiz_total
    from public.quiz_answers qa
    join public.quiz_answers qb on qb.question_id = qa.question_id and qb.profile_id = p_b
    join public.quiz_questions q on q.id = qa.question_id
    where qa.profile_id = p_a;
    select coalesce(sum(q.weight * q.weight), 0) into v_na from public.quiz_answers x join public.quiz_questions q on q.id = x.question_id where x.profile_id = p_a;
    select coalesce(sum(q.weight * q.weight), 0) into v_nb from public.quiz_answers x join public.quiz_questions q on q.id = x.question_id where x.profile_id = p_b;
    v_quiz := case when v_na > 0 and v_nb > 0 then v_dot / sqrt(v_na * v_nb) else 0 end;
  end if;

  -- 3) 활동 시간대: (weekday, slot) 자카드
  select count(*) filter (where sa.weekday is not null and sb.weekday is not null), count(*)
  into v_slot_inter, v_slot_union
  from (select weekday, slot from public.availability where profile_id = p_a) sa
  full outer join (select weekday, slot from public.availability where profile_id = p_b) sb
    on sa.weekday = sb.weekday and sa.slot = sb.slot;
  v_avail := case when v_slot_union > 0 then v_slot_inter::numeric / v_slot_union else 0 end;

  -- 4) 상호 관심: b 가 나를 좋아함 = 만점, 아니면 b 의 최근 활동(48h) 0.3
  v_liker := exists (select 1 from public.likes l where l.from_id = p_b and l.to_id = p_a);
  v_mutual := case when v_liker then 1.0
                   when v_b.last_active_at >= now() - interval '48 hours' then 0.3
                   else 0 end;

  v_base := 0.40 * v_hobby + 0.35 * v_quiz + 0.15 * v_avail + 0.10 * v_mutual;

  -- 보정 (PRD §0-40 / A3 §6.3)
  if v_b.last_active_at >= now() - interval '48 hours' then v_active_bonus := public.reco_param('active_bonus', 0.03);
  elsif v_b.last_active_at < now() - interval '7 days' then v_inactive_pen := public.reco_param('inactive_penalty', 0.10);
  end if;
  v_new_eligible := v_b.created_at >= now() - make_interval(hours => public.reco_param('new_hours', 72)::integer)
                    and public.is_complete_profile(p_b);
  -- Phase 3 부스트(boosts 는 Phase 3 전 쓰기 금지 → 행이 없으므로 0). 온디맨드 생성에만 영향(A3 §6.3-4)
  if exists (select 1 from public.boosts bo where bo.user_id = v_b.user_id and bo.starts_at <= now() and bo.ends_at > now()) then
    v_boost := public.reco_param('boost_bonus', 0.15);
  end if;

  v_adj := (case when v_liker then public.reco_param('liker_bonus', 0.10) else 0 end) + v_active_bonus - v_inactive_pen + v_boost;

  -- ---- reasons (E2 는 상위 2개를 카드에 표시) ----
  select coalesce(jsonb_agg(h.slug order by ha.rank + hb.rank, h.id), '[]'::jsonb),
         string_agg(h.name, '·' order by ha.rank + hb.rank, h.id)
  into v_common, v_slot_label
  from public.profile_hobbies ha
  join public.profile_hobbies hb on hb.hobby_id = ha.hobby_id and hb.profile_id = p_b
  join public.hobbies h on h.id = ha.hobby_id
  where ha.profile_id = p_a;
  if jsonb_array_length(v_common) > 0 then
    v_reasons := v_reasons || jsonb_build_object('kind', 'hobby_overlap', 'hobbies', v_common,
      'label', '공통 취미: ' || v_slot_label);
  elsif v_cat_inter > 0 then
    select jsonb_agg(c.slug order by c.sort_order), string_agg(c.name, '·' order by c.sort_order)
    into v_common_cats, v_slot_label
    from (
      select distinct hc.id, hc.slug, hc.name, hc.sort_order
      from public.profile_hobbies pa join public.hobbies h1 on h1.id = pa.hobby_id
      join public.hobby_categories hc on hc.id = h1.category_id
      where pa.profile_id = p_a
        and hc.id in (select h2.category_id from public.profile_hobbies pb join public.hobbies h2 on h2.id = pb.hobby_id where pb.profile_id = p_b)
    ) c;
    v_reasons := v_reasons || jsonb_build_object('kind', 'category_adjacent', 'categories', v_common_cats,
      'label', '비슷한 취미 분야: ' || v_slot_label);
  end if;

  if v_slot_inter > 0 then
    select jsonb_agg(code order by weekday, ord), min(label)
    into v_slots, v_slot_label
    from (
      select sa.weekday, sa.slot,
             (array['mon','tue','wed','thu','fri','sat','sun'])[sa.weekday] || '_' || sa.slot::text as code,
             case sa.slot when 'morning' then 1 when 'afternoon' then 2 when 'evening' then 3 else 4 end as ord,
             (array['월요일','화요일','수요일','목요일','금요일','토요일','일요일'])[sa.weekday] || ' ' ||
             case sa.slot when 'morning' then '아침' when 'afternoon' then '오후' when 'evening' then '저녁' else '밤' end as label
      from public.availability sa
      join public.availability sb on sb.weekday = sa.weekday and sb.slot = sa.slot and sb.profile_id = p_b
      where sa.profile_id = p_a
      order by sa.weekday, ord
    ) s;
    v_reasons := v_reasons || jsonb_build_object('kind', 'slot_overlap', 'slots', v_slots,
      'label', v_slot_label || '에 시간이 맞아요');
  end if;

  if v_quiz_total > 0 and v_quiz_same >= 3 then
    v_reasons := v_reasons || jsonb_build_object('kind', 'quiz_similar', 'same', v_quiz_same, 'total', v_quiz_total,
      'label', '궁합 퀴즈 ' || v_quiz_same || '/' || v_quiz_total || ' 일치');
  end if;

  if v_a.region_code is not null and v_b.region_code is not null then
    v_same_sido := left(v_a.region_code, 2) = left(v_b.region_code, 2);
    v_same_sigungu := v_a.region_code = v_b.region_code;
    if v_same_sido then
      select case when v_same_sigungu then r.sigungu else r.sido end into v_sido from public.regions r where r.code = v_b.region_code;
      v_reasons := v_reasons || jsonb_build_object('kind', 'region_same', 'level', case when v_same_sigungu then 'sigungu' else 'sido' end,
        'label', coalesce(v_sido, '같은 지역') || ' 근처');
    end if;
  end if;

  return jsonb_build_object(
    'hobby', round(v_hobby, 4), 'tag_jaccard', round(v_tag_j, 4), 'category_jaccard', round(v_cat_j, 4),
    'quiz', round(v_quiz, 4), 'avail', round(v_avail, 4), 'mutual', round(v_mutual, 4),
    'base', round(v_base, 4),
    'liker', v_liker, 'active_bonus', v_active_bonus, 'inactive_penalty', v_inactive_pen,
    'new_eligible', v_new_eligible, 'boost', v_boost,
    'same_sido', v_same_sido, 'same_sigungu', v_same_sigungu,
    'score_no_new', round(least(1, greatest(0, v_base + v_adj)), 4),
    'score_with_new', round(least(1, greatest(0, v_base + v_adj + public.reco_param('new_bonus', 0.05))), 4),
    'reasons', v_reasons
  );
end $$;
comment on function public.pair_features is 'D3 점수식 구성요소 + reasons. score = 0.40 hobby + 0.35 quiz + 0.15 avail + 0.10 mutual + 보정(liker +0.10 / 활동 48h +0.03 / 7d↑ −0.10 / 신규 72h +0.05 / 부스트 +0.15), clamp 0~1.';

-- 최종 점수 (신규 부스트는 노출 상한 판정이 필요하므로 여기서는 미적용 = score_no_new)
create or replace function public.score_pair(a public.profiles, b public.profiles)
returns numeric language sql stable security definer set search_path = public as $$
  select (public.pair_features(a.id, b.id) ->> 'score_no_new')::numeric
$$;

create or replace function public.reco_reasons(p_a uuid, p_b uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(public.pair_features(p_a, p_b) -> 'reasons', '[]'::jsonb)
$$;

-- ---------- 후보 필터 ----------
-- 반환: target_id, is_liker, same_sido, pool_size(같은 시도 풀 크기), nationwide(폴백 여부)
create or replace function public.reco_candidates(p_profile_id uuid, p_loop_date date default null)
returns table (target_id uuid, is_liker boolean, same_sido boolean, pool_size integer, nationwide boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me        public.profiles%rowtype;
  v_ld        date := coalesce(p_loop_date, public.loop_date(now()));
  v_pool_min  integer := public.reco_param('region_pool_min', 300)::integer;
  v_pass_d    integer := public.reco_param('pass_cooldown_days', 30)::integer;
  v_seen_d    integer := public.reco_param('seen_cooldown_days', 7)::integer;
  v_seen2_d   integer := public.reco_param('seen_second_cooldown_days', 30)::integer;
  v_inact_d   integer := public.reco_param('inactive_exclude_days', 14)::integer;
  v_sido      text;
  v_pool      integer;
  v_nationwide boolean;
begin
  select * into v_me from public.profiles where id = p_profile_id;
  if v_me.id is null or v_me.status <> 'active' or v_me.verify_level < 2 or v_me.hidden_at is not null
     or public.active_sanction_level(v_me.id) >= 3 then
    return;   -- 뷰어 자격 없음 → 빈 결과
  end if;
  v_sido := left(v_me.region_code, 2);

  create temp table if not exists _reco_pool (target_id uuid primary key, is_liker boolean, same_sido boolean) on commit drop;
  truncate _reco_pool;

  insert into _reco_pool (target_id, is_liker, same_sido)
  select t.id,
         exists (select 1 from public.likes l where l.from_id = t.id and l.to_id = v_me.id),
         (v_sido is not null and left(t.region_code, 2) = v_sido)
  from public.profiles t
  where t.id <> v_me.id
    and t.status = 'active' and t.verify_level >= 2 and t.hidden_at is null
    and t.mode = v_me.mode
    and t.onboarding_step in ('verify', 'done')
    and t.last_active_at >= now() - make_interval(days => v_inact_d)
    and public.active_sanction_level(t.id) < 3
    -- 데이팅 모드: seeking_gender 상호 일치(F-056). friend 모드는 성별 무관
    and (v_me.mode <> 'dating' or (
          t.gender is not null and v_me.gender is not null
          and t.seeking_gender is not null and v_me.seeking_gender is not null
          and (v_me.seeking_gender = 'any' or v_me.seeking_gender::text = t.gender::text)
          and (t.seeking_gender = 'any' or t.seeking_gender::text = v_me.gender::text)))
    -- 차단 양방향 · 매칭 이력(상태 무관) · 내가 보낸 좋아요 · 신고 양방향 영구 제외
    and not public.are_blocked(v_me.id, t.id)
    and not exists (select 1 from public.matches m where m.a_id = least(v_me.id, t.id) and m.b_id = greatest(v_me.id, t.id))
    and not exists (select 1 from public.likes l where l.from_id = v_me.id and l.to_id = t.id)
    and not exists (select 1 from public.reports r where (r.reporter_id = v_me.id and r.target_id = t.id) or (r.reporter_id = t.id and r.target_id = v_me.id))
    -- 오늘 이미 추천된 상대 제외
    and not exists (select 1 from public.daily_recommendations d where d.profile_id = v_me.id and d.target_id = t.id and d.loop_date = v_ld)
    -- 패스 30일
    and not exists (select 1 from public.daily_recommendations d where d.profile_id = v_me.id and d.target_id = t.id
                      and d.action = 'pass' and d.loop_date > v_ld - v_pass_d)
    -- 본 것만(무행동): 7일 후 1회 재노출, 2회째도 무행동이면 30일
    and not exists (select 1 from public.daily_recommendations d where d.profile_id = v_me.id and d.target_id = t.id
                      and d.seen_at is not null and d.acted_at is null and d.loop_date > v_ld - v_seen_d)
    and not (
      (select count(*) from public.daily_recommendations d where d.profile_id = v_me.id and d.target_id = t.id
         and d.seen_at is not null and d.acted_at is null and d.loop_date > v_ld - v_seen2_d) >= 2
    );

  select count(*) into v_pool from _reco_pool p where p.same_sido;
  v_nationwide := (v_sido is null) or (v_pool < v_pool_min);

  return query
    select p.target_id, p.is_liker, p.same_sido, v_pool, v_nationwide
    from _reco_pool p
    where v_nationwide or p.same_sido;
end $$;
comment on function public.reco_candidates is '재노출·제외 규칙(A3 §6.2)을 적용한 후보. 같은 시도 풀 < region_pool_min(300) 이면 전국 폴백(F-017).';

-- ---------- 일일 추천 생성 (멱등) ----------
create or replace function public.generate_daily_recommendations(p_profile_id uuid, p_loop_date date default null, p_limit integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me         public.profiles%rowtype;
  v_ld         date := coalesce(p_loop_date, public.loop_date(now()));
  v_tier       public.subscription_tier;
  v_limit      integer;
  v_liker_cap  integer;
  v_liker_pri  boolean;
  v_new_cap    integer := public.reco_param('new_daily_exposure_cap', 40)::integer;
  v_existing   integer;
  v_gb         jsonb;
  v_gb_on      boolean := false;
  v_female_cap integer;
  v_pos        integer := 0;
  v_liker_n    integer := 0;
  v_row        record;
  v_score      numeric;
  v_boosted    boolean;
  v_pool       integer := 0;
  v_nationwide boolean := false;
  v_cands      integer := 0;
begin
  if p_profile_id is null then raise exception 'INVALID_INPUT: profile_id' using errcode = 'check_violation'; end if;
  select * into v_me from public.profiles where id = p_profile_id;
  if v_me.id is null then raise exception 'NOT_FOUND: profile' using errcode = 'no_data_found'; end if;

  -- 멱등: 같은 loop_date 에 이미 있으면 skip
  select count(*) into v_existing from public.daily_recommendations where profile_id = p_profile_id and loop_date = v_ld;
  if v_existing > 0 then
    return jsonb_build_object('generated', false, 'skipped', true, 'loop_date', v_ld, 'count', v_existing);
  end if;

  if v_me.status <> 'active' or v_me.verify_level < 2 or v_me.hidden_at is not null or public.active_sanction_level(v_me.id) >= 3 then
    return jsonb_build_object('generated', false, 'skipped', true, 'loop_date', v_ld, 'count', 0, 'reason', 'not_eligible');
  end if;

  v_tier := public.get_effective_tier(v_me.user_id);
  v_limit := coalesce(p_limit, public.entitlement_value(v_tier, 'daily_reco_limit')::integer);
  v_liker_pri := public.entitlement_value(v_tier, 'liker_priority') = 1;
  v_liker_cap := case when v_liker_pri then v_limit else ceil(v_limit * public.reco_param('liker_ratio', 0.40))::integer end;

  -- 성비 불균형 큐 조정 (데이팅 · 남성 뷰어 · 여성 비율 < min_female_ratio)
  select value into v_gb from public.app_settings where key = 'reco_gender_balance';
  if coalesce((v_gb ->> 'enabled')::boolean, false) and v_me.mode = 'dating' and v_me.gender = 'male' then
    select (count(*) filter (where gender = 'female'))::numeric / nullif(count(*), 0) < (v_gb ->> 'min_female_ratio')::numeric
    into v_gb_on
    from public.profiles where mode = 'dating' and status = 'active' and verify_level >= 3;
    v_gb_on := coalesce(v_gb_on, false);
    v_female_cap := coalesce((v_gb ->> 'female_daily_exposure_cap')::integer, 30);
  end if;

  -- 후보 점수화 → 점수순(동점: 같은 시도 → created_at 최신) 순회하며 상한 규칙 적용
  for v_row in
    select c.target_id, c.is_liker, c.same_sido, c.pool_size, c.nationwide,
           f.features, t.created_at as target_created_at, t.gender as target_gender
    from public.reco_candidates(p_profile_id, v_ld) c
    join public.profiles t on t.id = c.target_id
    cross join lateral (select public.pair_features(p_profile_id, c.target_id) as features) f
    order by (f.features ->> 'score_no_new')::numeric desc, c.same_sido desc, t.created_at desc
  loop
    v_cands := v_cands + 1;
    v_pool := v_row.pool_size; v_nationwide := v_row.nationwide;
    exit when v_pos >= v_limit;

    -- 나를 좋아한 사람 상한(40%). pro liker_priority 는 상한 해제 + 최상단(점수 +0.10 으로 자연 정렬)
    if v_row.is_liker and v_liker_n >= v_liker_cap then continue; end if;

    -- 성비 큐 조정: 여성 후보의 오늘 노출 수가 상한 이상이면 건너뜀
    if v_gb_on and v_row.target_gender = 'female' then
      if (select count(*) from public.daily_recommendations d where d.target_id = v_row.target_id and d.loop_date = v_ld) >= v_female_cap then
        continue;
      end if;
    end if;

    -- 신규 부스트: 완성 프로필 + 72h + 오늘 부스트 노출 < 40
    v_boosted := false;
    v_score := (v_row.features ->> 'score_no_new')::numeric;
    if (v_row.features ->> 'new_eligible')::boolean then
      if (select count(*) from public.daily_recommendations d where d.target_id = v_row.target_id and d.loop_date = v_ld and d.is_boosted) < v_new_cap then
        v_boosted := true;
        v_score := (v_row.features ->> 'score_with_new')::numeric;
      end if;
    end if;

    v_pos := v_pos + 1;
    if v_row.is_liker then v_liker_n := v_liker_n + 1; end if;

    insert into public.daily_recommendations (profile_id, target_id, loop_date, position, score, reasons, is_from_liker, is_boosted)
    values (p_profile_id, v_row.target_id, v_ld, v_pos, v_score, coalesce(v_row.features -> 'reasons', '[]'::jsonb), v_row.is_liker, v_boosted)
    on conflict (profile_id, target_id, loop_date) do nothing;
  end loop;

  -- D7 훅: 새 추천 생성됨 (LISTEN 'duckmate_reco'). 부족분은 재노출로 채우지 않는다(A3 §6.1)
  perform pg_notify('duckmate_reco', jsonb_build_object('profile_id', p_profile_id, 'loop_date', v_ld, 'count', v_pos)::text);

  return jsonb_build_object('generated', true, 'skipped', false, 'loop_date', v_ld, 'count', v_pos,
                            'limit', v_limit, 'candidates', v_cands, 'liker_count', v_liker_n,
                            'pool_size', v_pool, 'nationwide', v_nationwide, 'gender_balance_applied', v_gb_on);
end $$;
comment on function public.generate_daily_recommendations is 'service 전용. 같은 loop_date 에 이미 있으면 skip(멱등). limit = ENTITLEMENTS[tier].daily_reco_limit. 나를 좋아한 사람 ≤ 40%, 신규 부스트 일 노출 ≤ 40, 성비 큐 조정(app_settings.reco_gender_balance).';

-- ---------- 배치: 활성 프로필 순회 (pg_cron / Edge Function 공용) ----------
-- p_loop_date null → loop_date(now() + 10분): 06:50 KST 실행 시 새 loop_date 를 만든다.
-- p_batch_size null → 전체. 반환 {loop_date, processed, generated, skipped, failed, next_offset, done}
create or replace function public.run_daily_recommendation_batch(p_loop_date date default null, p_batch_size integer default null, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ld        date := coalesce(p_loop_date, public.loop_date(now() + interval '10 minutes'));
  v_viewer_d  integer := public.reco_param('viewer_inactive_days', 30)::integer;
  v_id        uuid;
  v_res       jsonb;
  v_processed integer := 0;
  v_generated integer := 0;
  v_skipped   integer := 0;
  v_failed    integer := 0;
  v_total     integer;
  v_errors    jsonb := '[]'::jsonb;
begin
  select count(*) into v_total from public.profiles p
  where p.status = 'active' and p.verify_level >= 2 and p.hidden_at is null
    and p.onboarding_step in ('verify', 'done')
    and p.last_active_at >= now() - make_interval(days => v_viewer_d);

  for v_id in
    select p.id from public.profiles p
    where p.status = 'active' and p.verify_level >= 2 and p.hidden_at is null
      and p.onboarding_step in ('verify', 'done')
      and p.last_active_at >= now() - make_interval(days => v_viewer_d)
    order by p.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit coalesce(p_batch_size, 2147483647)
  loop
    v_processed := v_processed + 1;
    begin
      v_res := public.generate_daily_recommendations(v_id, v_ld, null);
      if (v_res ->> 'generated')::boolean then v_generated := v_generated + 1; else v_skipped := v_skipped + 1; end if;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_errors) < 20 then
        v_errors := v_errors || jsonb_build_object('profile_id', v_id, 'error', left(sqlerrm, 200));
      end if;
    end;
  end loop;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
  values (null, 'system', 'reco_batch_ran', 'loop_date', v_ld::text,
          jsonb_build_object('processed', v_processed, 'generated', v_generated, 'skipped', v_skipped, 'failed', v_failed,
                             'offset', coalesce(p_offset, 0), 'batch_size', p_batch_size, 'total', v_total));

  return jsonb_build_object('loop_date', v_ld, 'processed', v_processed, 'generated', v_generated, 'skipped', v_skipped,
                            'failed', v_failed, 'total', v_total,
                            'next_offset', coalesce(p_offset, 0) + v_processed,
                            'done', (p_batch_size is null) or (coalesce(p_offset, 0) + v_processed >= v_total) or v_processed = 0,
                            'errors', v_errors);
end $$;
comment on function public.run_daily_recommendation_batch is 'service 전용. 06:50 KST pg_cron(0021) 또는 Edge Function daily-recommendations 가 호출. 프로필 단위 예외 격리, 멱등.';

-- ---------- 온디맨드: 유저 첫 접속 시 당일 추천 없으면 생성 ----------
create or replace function public.ensure_today_recommendations()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me  uuid := public.current_profile_id();
  v_ld  date := public.loop_date(now());
  v_res jsonb;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if (select verify_level from public.profiles where id = v_me) < 2 then
    raise exception 'NOT_VERIFIED: recommendations require verify_level 2' using errcode = '42501';
  end if;
  -- 접속 갱신(미접속 14일 제외 규칙의 기준)
  update public.profiles set last_active_at = now() where id = v_me and last_active_at < now() - interval '5 minutes';
  v_res := public.generate_daily_recommendations(v_me, v_ld, null);
  return v_res;
end $$;
comment on function public.ensure_today_recommendations is 'authenticated. 오늘 loop_date 추천이 없으면 생성(배치 실패/배치 후 가입 폴백). 하루 1회만 생성된다.';

-- ---------- D7 / D8 용 뷰 (service role 전용) ----------
create view public.v_reco_daily_summary as
select d.profile_id, p.user_id, d.loop_date,
       count(*)::integer as reco_count,
       count(*) filter (where d.seen_at is not null)::integer as seen_count,
       count(*) filter (where d.acted_at is not null)::integer as acted_count,
       count(*) filter (where d.action in ('like', 'super'))::integer as like_count,
       count(*) filter (where d.action = 'pass')::integer as pass_count,
       count(*) filter (where d.is_from_liker)::integer as liker_count,
       count(*) filter (where d.is_boosted)::integer as boosted_count,
       min(d.created_at) as generated_at
from public.daily_recommendations d
join public.profiles p on p.id = d.profile_id
group by d.profile_id, p.user_id, d.loop_date;
comment on view public.v_reco_daily_summary is 'D7 슬롯 A("새 추천 N명")·슬롯 B("아직 N명 남았어요") + D8 유저별 지표. service role 전용.';

create view public.v_reco_metrics_daily as
with per_user as (select * from public.v_reco_daily_summary)
select s.loop_date,
       count(*)::integer as users_with_reco,
       sum(s.reco_count)::integer as reco_rows,
       round(avg(s.reco_count), 2) as avg_reco_count,
       count(*) filter (where s.reco_count < 5)::integer as users_under_5,
       round(count(*) filter (where s.reco_count < 5)::numeric / nullif(count(*), 0), 4) as under_5_ratio,
       round(sum(s.seen_count)::numeric / nullif(sum(s.reco_count), 0), 4) as seen_rate,
       sum(s.like_count)::integer as likes_sent,
       sum(s.pass_count)::integer as passes_sent,
       (select count(*) from public.matches m where public.loop_date(m.matched_at) = s.loop_date)::integer as matches_created,
       round((select count(*) from public.matches m where public.loop_date(m.matched_at) = s.loop_date)::numeric / nullif(sum(s.like_count), 0), 4) as like_to_match
from per_user s
group by s.loop_date;
comment on view public.v_reco_metrics_daily is 'D8 대시보드: 추천 부족 유저 비율(≤30% 목표), 좋아요→매칭 전환(≥8% 목표). service role 전용.';

create view public.v_reco_gender_balance as
select p.mode,
       count(*)::integer as total,
       count(*) filter (where p.gender = 'female')::integer as female,
       count(*) filter (where p.gender = 'male')::integer as male,
       round(count(*) filter (where p.gender = 'female')::numeric / nullif(count(*), 0), 4) as female_ratio,
       (select (value ->> 'min_female_ratio')::numeric from public.app_settings where key = 'reco_gender_balance') as min_female_ratio
from public.profiles p
where p.status = 'active' and p.verify_level >= 2
group by p.mode;
comment on view public.v_reco_gender_balance is 'PRD 1순위 지표(데이팅 여성 비율 ≥ 35%). service role 전용.';

revoke all on public.v_reco_daily_summary, public.v_reco_metrics_daily, public.v_reco_gender_balance from public, anon, authenticated;
grant select on public.v_reco_daily_summary, public.v_reco_metrics_daily, public.v_reco_gender_balance to service_role;

-- ---------- 권한 (15_auth §0-28: service 전용은 authenticated 에서도 명시 회수) ----------
revoke execute on function
  public.reco_param(text, numeric),
  public.is_complete_profile(uuid),
  public.pair_features(uuid, uuid),
  public.score_pair(public.profiles, public.profiles),
  public.reco_reasons(uuid, uuid),
  public.reco_candidates(uuid, date),
  public.generate_daily_recommendations(uuid, date, integer),
  public.run_daily_recommendation_batch(date, integer, integer),
  public.ensure_today_recommendations()
from public, anon, authenticated;

revoke execute on function public.entitlement_value(public.subscription_tier, text) from public, anon;

grant execute on function
  public.reco_param(text, numeric),
  public.is_complete_profile(uuid),
  public.pair_features(uuid, uuid),
  public.score_pair(public.profiles, public.profiles),
  public.reco_reasons(uuid, uuid),
  public.reco_candidates(uuid, date),
  public.generate_daily_recommendations(uuid, date, integer),
  public.run_daily_recommendation_batch(date, integer, integer)
to service_role;

grant execute on function public.entitlement_value(public.subscription_tier, text), public.ensure_today_recommendations()
to authenticated, service_role;
