-- =============================================================================
-- 덕메이트(DuckMate) · D3 마이그레이션 00008 — 매칭 엔진 (Postgres 함수)
-- 근거: ORCHESTRATOR_SPEC §3 D3 점수식 + 06_PRD F-DIS-01/02/05/06 + 02_persona
--       (성향 축 거리 감점·P3×P4 배제·intent 목적 축) + 03_core_loop(KST 06:00,
--       first_suggestion 3개 사전 생성) + 14_schema(D1 규약) + 15_auth(D2 규약).
--
-- 점수 공식 (확정):
--   compat = 0.40 × hobby_jaccard        (취미태그 가중 자카드 — Top3 가중 1.5)
--          + 0.35 × quiz_cosine          (궁합퀴즈 5축 가중 벡터 코사인, [0,1] 정규화)
--          + 0.15 × availability_overlap (활동 시간대 겹침 — overlap coefficient)
--          + 0.10 × mutual_signal        (상호 관심: 역방향 좋아요/카드 열람)
--   − 감점: meeting·tempo 축 거리가 1.0 을 넘는 초과분 × 0.10 (축당, 최대 0.20)
--   제외: intent(관계 목적) 축 극단 차 — 한쪽 ≤ -0.5(친구 고정) AND 다른쪽 ≥ +0.5
--         (연애 지향) 이면 compat_score 가 NULL 을 반환 → 큐에서 제외.
--
-- KST 규약(D1): for_date 의 KST 변환 책임은 발행자(Edge Function) — 이 파일의
--   함수들은 전달받은 date 만 사용한다.
-- 권한: 아래 함수 전부 service role 전용 (말미 revoke). daily_recommendations
--   발행/삭제는 service role 전용(00003), matches.first_suggestion 은 트리거가 채움.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- hobby_jaccard(a, b) — 취미 가중 자카드 [0,1]
--   가중치: Top3(rank not null) = 1.5, 일반 = 1.0 (확정)
--   가중 자카드 = Σ min(w_a, w_b) / Σ max(w_a, w_b)  (합집합 기준, 미보유 = 0)
-- -----------------------------------------------------------------------------
create or replace function public.hobby_jaccard(p_a uuid, p_b uuid)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  with a as (
    select hobby_id, case when rank is not null then 1.5 else 1.0 end as w
    from public.profile_hobbies where profile_id = p_a
  ),
  b as (
    select hobby_id, case when rank is not null then 1.5 else 1.0 end as w
    from public.profile_hobbies where profile_id = p_b
  ),
  u as (
    select coalesce(a.w, 0) as wa, coalesce(b.w, 0) as wb
    from a full outer join b using (hobby_id)
  )
  select coalesce(sum(least(wa, wb)) / nullif(sum(greatest(wa, wb)), 0), 0)
  from u;
$$;

-- -----------------------------------------------------------------------------
-- quiz_axis_values(p) — 프로필의 5축 성향 값 (축별 응답 벡터값 평균, [-1,1])
--   weight 미적용 "생값" — 감점·intent 제외·reasons 근거 계산에 사용.
-- -----------------------------------------------------------------------------
create or replace function public.quiz_axis_values(p uuid)
returns table (category text, val numeric)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select qq.category,
         avg((qq.options -> qa.choice::int ->> 'value')::numeric)
  from public.quiz_answers qa
  join public.quiz_questions qq on qq.id = qa.question_id
  where qa.profile_id = p
  group by qq.category;
$$;

-- -----------------------------------------------------------------------------
-- quiz_cosine(a, b) — 5축 가중 벡터 코사인 유사도 → [0,1]
--   축값 = 축별 응답 벡터값 평균 × quiz_questions.weight (meeting·intent 1.2)
--   반환 = (cos + 1) / 2. 응답 없음/영벡터 = 0.5 (중립 — 미응답자 불이익 방지, 확정)
-- -----------------------------------------------------------------------------
create or replace function public.quiz_cosine(p_a uuid, p_b uuid)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  with a as (
    select qq.category,
           avg((qq.options -> qa.choice::int ->> 'value')::numeric) * max(qq.weight) as v
    from public.quiz_answers qa
    join public.quiz_questions qq on qq.id = qa.question_id
    where qa.profile_id = p_a
    group by qq.category
  ),
  b as (
    select qq.category,
           avg((qq.options -> qa.choice::int ->> 'value')::numeric) * max(qq.weight) as v
    from public.quiz_answers qa
    join public.quiz_questions qq on qq.id = qa.question_id
    where qa.profile_id = p_b
    group by qq.category
  ),
  j as (
    select a.v as va, b.v as vb
    from a join b using (category)
  )
  select coalesce(
    (select case
       when sum(va * va) = 0 or sum(vb * vb) = 0 then 0.5
       else (sum(va * vb) / (sqrt(sum(va * va)) * sqrt(sum(vb * vb))) + 1) / 2
     end
     from j
     having count(*) > 0),
    0.5);
$$;

-- -----------------------------------------------------------------------------
-- availability_overlap(a, b) — 활동 시간대 겹침 비율 [0,1]
--   overlap coefficient = |A ∩ B| / min(|A|, |B|) (확정 — 슬롯이 적은 쪽 기준이라
--   입력이 적은 유저가 불리하지 않다). 한쪽이라도 미입력 = 0.5 중립 (확정 —
--   availability 는 온보딩 필수 스텝이 아니라 미입력자가 많다).
-- -----------------------------------------------------------------------------
create or replace function public.availability_overlap(p_a uuid, p_b uuid)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  with a as (select weekday, slot from public.availability where profile_id = p_a),
  b as (select weekday, slot from public.availability where profile_id = p_b),
  s as (
    select (select count(*) from a) as na,
           (select count(*) from b) as nb,
           (select count(*) from a join b using (weekday, slot)) as ni
  )
  select case
    when na = 0 or nb = 0 then 0.5
    else ni::numeric / least(na, nb)
  end
  from s;
$$;

-- -----------------------------------------------------------------------------
-- mutual_signal(a, b) — 상호 관심 신호 [0,1] (a 관점: 상대 b 가 나에게 보인 신호)
--   가용 데이터 기준 정의 (확정):
--     상대가 나에게 슈퍼라이크 = 1.0 / 좋아요 = 0.9
--     상대가 자기 추천 큐에서 내 카드를 열람(seen_at) = 0.2 / 없음 = 0.0
--   ※ 이 신호는 점수에만 녹는다 — reasons 문구로 "상대의 좋아요"를 노출하지 않는다
--     (무료 티어 '나를 좋아한 사람' 블러 수익 모델 보호, A4).
-- -----------------------------------------------------------------------------
create or replace function public.mutual_signal(p_a uuid, p_b uuid)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when exists (select 1 from public.likes
                 where from_id = p_b and to_id = p_a and type = 'super') then 1.0
    when exists (select 1 from public.likes
                 where from_id = p_b and to_id = p_a) then 0.9
    when exists (select 1 from public.daily_recommendations
                 where profile_id = p_b and target_id = p_a and seen_at is not null) then 0.2
    else 0.0
  end;
$$;

-- -----------------------------------------------------------------------------
-- compat_score(a, b) — 최종 궁합 점수 [0,1] 또는 NULL(목적 불일치 제외)
--   가중합(0.40/0.35/0.15/0.10) + meeting·tempo 축 거리 감점(A2 §3 — P3×P4 자연
--   배제) + intent 축 극단 차 제외(PRD "모드·intent 불일치 쌍 큐 제외").
-- -----------------------------------------------------------------------------
create or replace function public.compat_score(p_a uuid, p_b uuid)
returns numeric
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_a       record;
  v_b       record;
  v_score   numeric;
  v_penalty numeric := 0;
begin
  if p_a = p_b then
    return null;
  end if;

  select max(val) filter (where category = 'intent')  as intent,
         max(val) filter (where category = 'meeting') as meeting,
         max(val) filter (where category = 'tempo')   as tempo
  into v_a from public.quiz_axis_values(p_a);

  select max(val) filter (where category = 'intent')  as intent,
         max(val) filter (where category = 'meeting') as meeting,
         max(val) filter (where category = 'tempo')   as tempo
  into v_b from public.quiz_axis_values(p_b);

  -- 목적 불일치 제외 (확정): intent 축에서 한쪽은 "취미 친구 고정"(≤ -0.5),
  -- 다른쪽은 "연애 지향"(≥ +0.5) — 서로 원하는 관계가 다른 쌍은 큐에 올리지 않는다.
  if v_a.intent is not null and v_b.intent is not null and (
       (v_a.intent <= -0.5 and v_b.intent >= 0.5) or
       (v_b.intent <= -0.5 and v_a.intent >= 0.5)
     ) then
    return null;
  end if;

  v_score := 0.40 * public.hobby_jaccard(p_a, p_b)
           + 0.35 * public.quiz_cosine(p_a, p_b)
           + 0.15 * public.availability_overlap(p_a, p_b)
           + 0.10 * public.mutual_signal(p_a, p_b);

  -- A2 성향 축 거리 감점 (확정): meeting·tempo 축 거리(최대 2.0)가 1.0 을 넘는
  -- 초과분 × 0.10 씩 감점 → 축당 최대 0.10, 합계 최대 0.20.
  -- (P3 오프모임×P4 온라인 조합이 meeting 축 극단 차로 자연 배제되는 규모)
  if v_a.meeting is not null and v_b.meeting is not null then
    v_penalty := v_penalty + 0.10 * greatest(0, abs(v_a.meeting - v_b.meeting) - 1.0);
  end if;
  if v_a.tempo is not null and v_b.tempo is not null then
    v_penalty := v_penalty + 0.10 * greatest(0, abs(v_a.tempo - v_b.tempo) - 1.0);
  end if;

  return round(greatest(0, least(1, v_score - v_penalty)), 4);
end;
$$;

-- -----------------------------------------------------------------------------
-- build_reasons(a, b) — reasons jsonb: 한국어 궁합 이유 3줄 (S2 카드 노출용)
--   [공통 취미명 / 퀴즈 축 근거 / 시간대·활동 근거] 순. 항상 문자열 3개 배열.
-- -----------------------------------------------------------------------------
create or replace function public.build_reasons(p_a uuid, p_b uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_common_cnt   integer;
  v_common_names text;
  v_axis         text;
  v_axis_name    text;
  v_overlap      integer;
  v_l1 text;
  v_l2 text;
  v_l3 text;
begin
  -- 1줄: 공통 취미 (Top3 우선 최대 2개 이름 + 총 개수)
  select count(*) into v_common_cnt
  from public.profile_hobbies pa
  join public.profile_hobbies pb on pb.hobby_id = pa.hobby_id and pb.profile_id = p_b
  where pa.profile_id = p_a;

  if v_common_cnt > 0 then
    select string_agg(name, '·') into v_common_names
    from (
      select h.name
      from public.profile_hobbies pa
      join public.profile_hobbies pb on pb.hobby_id = pa.hobby_id and pb.profile_id = p_b
      join public.hobbies h on h.id = pa.hobby_id
      where pa.profile_id = p_a
      order by (pa.rank is null), coalesce(pa.rank, 9), (pa.intensity + pb.intensity) desc
      limit 2
    ) top_names;
    v_l1 := case
      when v_common_cnt = 1 then format('%s 취미가 겹쳐요', v_common_names)
      else format('%s 등 취미 %s개가 겹쳐요', v_common_names, v_common_cnt)
    end;
  else
    v_l1 := '서로의 취미 세계를 넓혀 줄 수 있는 상대예요';
  end if;

  -- 2줄: 궁합 퀴즈 — 가장 가까운 성향 축
  select a.category into v_axis
  from public.quiz_axis_values(p_a) a
  join public.quiz_axis_values(p_b) b using (category)
  order by abs(a.val - b.val) asc
  limit 1;

  if v_axis is not null then
    v_axis_name := case v_axis
      when 'immersion' then '몰입도'
      when 'meeting'   then '만남 성향'
      when 'tempo'     then '소통 템포'
      when 'explore'   then '탐험성'
      when 'intent'    then '관계 목적'
      else v_axis
    end;
    v_l2 := format('궁합 퀴즈 「%s」 성향이 비슷했어요', v_axis_name);
  else
    v_l2 := '궁합 퀴즈 응답 경향이 잘 맞는 편이에요';
  end if;

  -- 3줄: 활동 시간대 겹침 (없으면 활동성 문구 — 상대의 좋아요는 노출 금지)
  select count(*) into v_overlap
  from public.availability a
  join public.availability b using (weekday, slot)
  where a.profile_id = p_a and b.profile_id = p_b;

  if v_overlap > 0 then
    v_l3 := format('활동 시간대가 %s칸 겹쳐요 — 약속 잡기 좋아요', v_overlap);
  else
    v_l3 := '요즘 활발하게 활동 중인 상대예요';
  end if;

  return jsonb_build_array(v_l1, v_l2, v_l3);
end;
$$;

-- -----------------------------------------------------------------------------
-- build_daily_recommendations(for_date) — 일일 추천 발행 (KST 06:00 cron 이 호출)
--
-- 수신자: status=active · verify_level≥1 · 온보딩 완료 · 활성 제재 Lv3+ 없음
-- 티어별 인원수: free 5 / plus 15 / pro 30
--   ※ packages/db/src/tier-limits.ts TIER_LIMITS.dailyRecs 와 동일 값 유지 규약 —
--     값 변경 시 양쪽을 함께 갱신한다.
-- 후보 규칙:
--   · active · 온보딩 완료 · 활성 제재 Lv3+ 없음 (can_view_profile 과 동일 기준)
--   · 모드 호환: 같은 mode 끼리. dating 모드는 후보도 Lv≥2 + 이성
--     (m↔f; 어느 한쪽이 'n'이면 허용 — 별도 선호 데이터가 없는 현 스키마의 확정)
--   · 차단 양방향 제외 / 이미 매칭된 쌍 제외 / 내가 이미 좋아요 보낸 상대 제외
--   · 목적 불일치(intent 극단 차) 제외 — compat_score = null
--   · 재노출 규칙 (확정): 열람(seen_at)한 카드의 상대는 14일 내 재노출 금지.
--     미열람 발행분은 다음 날 재추천 허용 (S2 "미소진 카드 당일 유지"와 정합).
--   · 빈 큐 완화 (F-DIS-05): 신규 후보가 부족하면 재노출 금지를 풀고
--     "가장 오래전에 본 상대"부터 백필 — "추천 0명" 화면 방지.
-- 큐 조정(정렬 가중 — 저장 score 는 순수 궁합 점수):
--   · 성비 감쇠 (F-DIS-06, 스펙): dating 모드 활성(Lv2+) 회원의 m:f 비율 기준,
--     과잉 성별 후보의 정렬 점수 × (소수성별/과잉성별), 하한 0.8
--   · 신규 48h 부스트 ×1.15 (A1 §4.1) / 부스트 아이템 활성 ×1.25 (D1 규약)
-- 반환: 통계 jsonb {for_date, recipients, issued, backfilled, duration_ms}
-- -----------------------------------------------------------------------------
create or replace function public.build_daily_recommendations(p_for_date date)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r             record;
  v_limit       integer;
  v_inserted    integer;
  v_extra       integer;
  v_recipients  integer := 0;
  v_issued      integer := 0;
  v_backfilled  integer := 0;
  v_m           integer;
  v_f           integer;
  v_factor_m    numeric := 1.0;
  v_factor_f    numeric := 1.0;
  v_t0          timestamptz := clock_timestamp();
begin
  -- 성비 감쇠 계수 (dating 모드 · Lv2+ · active 기준)
  select count(*) filter (where gender = 'm'),
         count(*) filter (where gender = 'f')
  into v_m, v_f
  from public.profiles
  where status = 'active' and mode = 'dating' and verify_level >= 2;

  if coalesce(v_m, 0) > 0 and coalesce(v_f, 0) > 0 then
    if v_m > v_f then
      v_factor_m := greatest(0.8, v_f::numeric / v_m);
    elsif v_f > v_m then
      v_factor_f := greatest(0.8, v_m::numeric / v_f);
    end if;
  end if;

  for r in
    select p.id, p.user_id, p.gender, p.mode
    from public.profiles p
    where p.status = 'active'
      and p.verify_level >= 1
      and p.onboarding_step = 'done'
      and not exists (
        select 1 from public.sanctions s
        where s.profile_id = p.id and s.status = 'ACTIVE' and s.level >= 3
          and (s.ends_at is null or s.ends_at > now())
      )
  loop
    v_recipients := v_recipients + 1;

    -- 티어별 인원수 (TIER_LIMITS.dailyRecs 와 동일 값)
    select case s.tier when 'pro' then 30 when 'plus' then 15 else 5 end
    into v_limit
    from public.subscriptions s
    where s.user_id = r.user_id
      and s.status in ('active', 'cancel_scheduled', 'past_due')
    limit 1;
    v_limit := coalesce(v_limit, 5);

    -- 1차: 신규(재노출 금지 적용) 후보
    insert into public.daily_recommendations (profile_id, target_id, score, reasons, for_date)
    select r.id, cand.id, cand.score, public.build_reasons(r.id, cand.id), p_for_date
    from (
      select t.id, sc.score,
             sc.score
               * case when t.boost_active_until is not null and t.boost_active_until > now()
                      then 1.25 else 1.0 end
               * case when t.created_at > now() - interval '48 hours' then 1.15 else 1.0 end
               * case when r.mode = 'dating' then
                       case t.gender when 'm' then v_factor_m
                                     when 'f' then v_factor_f
                                     else 1.0 end
                      else 1.0 end
               as rank_score
      from public.profiles t
      cross join lateral (select public.compat_score(r.id, t.id) as score) sc
      where t.id <> r.id
        and t.status = 'active'
        and t.onboarding_step = 'done'
        and t.mode = r.mode
        and case when r.mode = 'dating'
              then t.verify_level >= 2
                   and (t.gender <> r.gender or t.gender = 'n' or r.gender = 'n')
              else t.verify_level >= 1
            end
        and sc.score is not null                              -- 목적 불일치 제외
        and not public.is_blocked(r.id, t.id)
        and not exists (
          select 1 from public.matches m
          where m.a_id = least(r.id, t.id) and m.b_id = greatest(r.id, t.id)
        )
        and not exists (
          select 1 from public.likes l where l.from_id = r.id and l.to_id = t.id
        )
        and not exists (
          select 1 from public.sanctions s
          where s.profile_id = t.id and s.status = 'ACTIVE' and s.level >= 3
            and (s.ends_at is null or s.ends_at > now())
        )
        and not exists (                                       -- 재노출 금지 14일
          select 1 from public.daily_recommendations d
          where d.profile_id = r.id and d.target_id = t.id
            and d.seen_at is not null
            and d.for_date > p_for_date - 14
        )
      order by rank_score desc, t.last_active_at desc
      limit v_limit
    ) cand
    on conflict (profile_id, target_id, for_date) do nothing;

    get diagnostics v_inserted = row_count;
    v_issued := v_issued + v_inserted;

    -- 2차 백필: 부족분은 재노출 금지 해제, 가장 오래전에 본 상대부터
    if v_inserted < v_limit then
      insert into public.daily_recommendations (profile_id, target_id, score, reasons, for_date)
      select r.id, cand.id, cand.score, public.build_reasons(r.id, cand.id), p_for_date
      from (
        select t.id, sc.score,
               (select max(d.for_date) from public.daily_recommendations d
                where d.profile_id = r.id and d.target_id = t.id) as last_issued
        from public.profiles t
        cross join lateral (select public.compat_score(r.id, t.id) as score) sc
        where t.id <> r.id
          and t.status = 'active'
          and t.onboarding_step = 'done'
          and t.mode = r.mode
          and case when r.mode = 'dating'
                then t.verify_level >= 2
                     and (t.gender <> r.gender or t.gender = 'n' or r.gender = 'n')
                else t.verify_level >= 1
              end
          and sc.score is not null
          and not public.is_blocked(r.id, t.id)
          and not exists (
            select 1 from public.matches m
            where m.a_id = least(r.id, t.id) and m.b_id = greatest(r.id, t.id)
          )
          and not exists (
            select 1 from public.likes l where l.from_id = r.id and l.to_id = t.id
          )
          and not exists (
            select 1 from public.sanctions s
            where s.profile_id = t.id and s.status = 'ACTIVE' and s.level >= 3
              and (s.ends_at is null or s.ends_at > now())
          )
          and not exists (                                     -- 오늘 이미 발행분 제외
            select 1 from public.daily_recommendations d2
            where d2.profile_id = r.id and d2.target_id = t.id and d2.for_date = p_for_date
          )
        order by last_issued asc nulls first, sc.score desc
        limit v_limit - v_inserted
      ) cand
      on conflict (profile_id, target_id, for_date) do nothing;

      get diagnostics v_extra = row_count;
      v_issued := v_issued + v_extra;
      v_backfilled := v_backfilled + v_extra;
    end if;
  end loop;

  return jsonb_build_object(
    'for_date', p_for_date,
    'recipients', v_recipients,
    'issued', v_issued,
    'backfilled', v_backfilled,
    'duration_ms', round(extract(epoch from clock_timestamp() - v_t0) * 1000)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- make_first_suggestion(match_id) — 첫 대화 제안 카드 3개 생성 (A3 §결정-5)
--   공통 취미(Top3·양측 intensity 합 우선) 기반 "같이 할 수 있는 것" 3개를
--   jsonb 로 생성해 matches.first_suggestion 에 저장. 부족분은 범용 제안으로 채움.
--   형식: [{"type":"hobby","hobby_slug":..|null,"hobby_name":..|null,"text":".."}] × 3
--   (suggestion_type 'hobby' — Phase 2 에서 battle|quiz 소스 추가, A3 부록-4)
-- -----------------------------------------------------------------------------
create or replace function public.make_first_suggestion(p_match_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_a           uuid;
  v_b           uuid;
  rec           record;
  v_text        text;
  v_suggestions jsonb := '[]'::jsonb;
  v_top_a       text;
  v_top_b       text;
begin
  select a_id, b_id into v_a, v_b from public.matches where id = p_match_id;
  if not found then
    raise exception 'DUCKMATE_MATCH_NOT_FOUND: %', p_match_id;
  end if;
  if v_a is null or v_b is null then
    return '[]'::jsonb;   -- 탈퇴로 한쪽이 비어 있으면 생성하지 않는다
  end if;

  -- 공통 취미 상위 3개 → 카테고리별 한국어 활동 템플릿 (시드 12 카테고리)
  for rec in
    select h.slug, h.name, h.category
    from public.profile_hobbies pa
    join public.profile_hobbies pb on pb.hobby_id = pa.hobby_id and pb.profile_id = v_b
    join public.hobbies h on h.id = pa.hobby_id
    where pa.profile_id = v_a
    order by (pa.rank is null), coalesce(pa.rank, 9), (pa.intensity + pb.intensity) desc
    limit 3
  loop
    v_text := case rec.category
      when '게임'
        then format('부담 없이 온라인으로 %s 한 판 같이 어때요?', rec.name)
      when '애니·웹툰'
        then format('요즘 보는 %s 작품 하나씩 추천 교환으로 시작해 볼까요?', rec.name)
      when '아이돌·팬덤'
        then format('%s 최애 얘기부터! 요즘 최애 근황 하나씩 공유해요', rec.name)
      when '스포츠·러닝·클라이밍'
        then format('이번 주말에 가볍게 %s 같이 어때요? 입문 코스면 충분해요', rec.name)
      when '보드게임'
        then '이번 주 토요일 보드게임카페 어때요? 튜토리얼 게임부터 가볍게'
      when '카페·맛집'
        then format('서로 아는 %s 리스트 교환하고, 끌리는 곳 한 군데 같이 가 봐요', rec.name)
      when '공연·전시'
        then '요즘 가고 싶은 공연·전시 하나씩 공유해 볼까요?'
      when '사진·영상'
        then '최근에 찍은 최애 사진 한 장씩 공유하는 것부터 시작해요'
      when '코딩·테크'
        then '요즘 만들거나 파고 있는 것 하나씩 소개해 볼까요?'
      when '독서·글쓰기'
        then '인생 책 한 권씩 추천 교환 어때요?'
      when '음악'
        then '요즘 플레이리스트 서로 공유하는 것부터 시작해요'
      when '여행·아웃도어'
        then '가장 기억에 남는 여행지 얘기로 시작해 볼까요?'
      else format('공통 취미 %s 얘기로 첫 인사를 시작해 보세요', rec.name)
    end;
    v_suggestions := v_suggestions || jsonb_build_array(jsonb_build_object(
      'type', 'hobby', 'hobby_slug', rec.slug, 'hobby_name', rec.name, 'text', v_text
    ));
  end loop;

  -- 부족분: 범용 제안 (공통 취미 0~2개인 쌍)
  if jsonb_array_length(v_suggestions) < 3 then
    select h.name into v_top_a
    from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id
    where ph.profile_id = v_a and ph.rank = 1;
    select h.name into v_top_b
    from public.profile_hobbies ph join public.hobbies h on h.id = ph.hobby_id
    where ph.profile_id = v_b and ph.rank = 1;

    if v_top_a is not null and v_top_b is not null and jsonb_array_length(v_suggestions) < 3 then
      v_suggestions := v_suggestions || jsonb_build_array(jsonb_build_object(
        'type', 'hobby', 'hobby_slug', null, 'hobby_name', null,
        'text', format('서로의 Top1 취미(%s ↔ %s)를 하나씩 소개해 주기로 시작해요', v_top_a, v_top_b)
      ));
    end if;
    if jsonb_array_length(v_suggestions) < 3 then
      v_suggestions := v_suggestions || jsonb_build_array(jsonb_build_object(
        'type', 'hobby', 'hobby_slug', null, 'hobby_name', null,
        'text', '요즘 가장 빠져 있는 것 한 가지씩 공유해 볼까요?'
      ));
    end if;
    if jsonb_array_length(v_suggestions) < 3 then
      v_suggestions := v_suggestions || jsonb_build_array(jsonb_build_object(
        'type', 'hobby', 'hobby_slug', null, 'hobby_name', null,
        'text', '다음 주말에 해 보고 싶은 활동을 하나씩 말해 보세요'
      ));
    end if;
  end if;

  update public.matches set first_suggestion = v_suggestions where id = p_match_id;
  return v_suggestions;
end;
$$;

-- matches insert 트리거 — 매칭 성립 즉시 제안 카드 자동 생성
--   (try_create_match 는 first_suggestion 을 null 로 insert → 이 트리거가 채운다.
--    likes 경로·Lv2 승급 보류 해소 경로(D2 규약) 모두 이 한 곳을 지나간다.)
create or replace function public.fill_first_suggestion()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.make_first_suggestion(new.id);
  return new;
end;
$$;

create trigger trg_matches_first_suggestion
  after insert on public.matches
  for each row execute function public.fill_first_suggestion();

-- -----------------------------------------------------------------------------
-- 실행 권한: 매칭 함수 전부 service role 전용
--   (점수 함수는 security definer 로 타인 quiz_answers/availability 를 읽으므로
--    클라이언트 execute 를 반드시 차단한다 — 성향 벡터 유추 공격 방지)
-- -----------------------------------------------------------------------------
revoke execute on function public.hobby_jaccard(uuid, uuid)               from public, anon, authenticated;
revoke execute on function public.quiz_axis_values(uuid)                  from public, anon, authenticated;
revoke execute on function public.quiz_cosine(uuid, uuid)                 from public, anon, authenticated;
revoke execute on function public.availability_overlap(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public.mutual_signal(uuid, uuid)               from public, anon, authenticated;
revoke execute on function public.compat_score(uuid, uuid)                from public, anon, authenticated;
revoke execute on function public.build_reasons(uuid, uuid)               from public, anon, authenticated;
revoke execute on function public.build_daily_recommendations(date)       from public, anon, authenticated;
revoke execute on function public.make_first_suggestion(uuid)             from public, anon, authenticated;
