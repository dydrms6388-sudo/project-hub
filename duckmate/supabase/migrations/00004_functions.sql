-- =============================================================================
-- 덕메이트(DuckMate) · D1 마이그레이션 00004 — 핵심 Postgres 함수 + 트리거
-- (RLS 가 참조하는 헬퍼 — current_profile_id / current_verify_level / is_admin /
--  is_blocked / is_active_member / can_engage / can_view_profile / can_appeal —
--  는 실행 순서 제약으로 00003 상단에 선행 정의되어 있다.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- calc_age(birth_date) — 만 나이 (M1: 연령 게이트는 birth_date 만 나이 계산)
-- -----------------------------------------------------------------------------
create or replace function public.calc_age(p_birth_date date)
returns integer
language sql stable
as $$
  select date_part('year', age(current_date, p_birth_date))::integer;
$$;

-- -----------------------------------------------------------------------------
-- handle_new_user() — auth.users → profiles 자동 생성
--   가입 메타데이터(raw_user_meta_data): nickname, birth_date(YYYY-MM-DD), gender
--   만 19세 미만은 여기서 예외 발생 → 가입 자체가 롤백 (A5 §1.3 게이트 1)
--   ※ E1/D2 규약: signUp 시 options.data 에 위 3키를 반드시 담는다.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_birth_date date;
  v_nickname   text;
  v_gender     public.gender_type;
begin
  v_birth_date := (new.raw_user_meta_data ->> 'birth_date')::date;
  if v_birth_date is null then
    raise exception 'DUCKMATE_SIGNUP_BIRTH_DATE_REQUIRED';
  end if;
  if public.calc_age(v_birth_date) < 19 then
    -- 입력값 미저장 원칙: 트랜잭션 롤백으로 auth.users 행도 남지 않는다.
    raise exception 'DUCKMATE_SIGNUP_UNDERAGE';
  end if;

  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    '덕친' || left(replace(new.id::text, '-', ''), 6)
  );
  v_gender := coalesce(
    (new.raw_user_meta_data ->> 'gender')::public.gender_type,
    'n'::public.gender_type
  );

  insert into public.profiles (user_id, nickname, birth_date, gender)
  values (new.id, v_nickname, v_birth_date, v_gender);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- try_create_match(a, b) — 상호 좋아요 + 양측 Lv≥2 + 비차단·활성일 때 matches 생성
--   반환: 생성(또는 기존) match id, 조건 미충족 시 null ("매칭 보류" 상태)
--   first_suggestion 은 null 로 생성 — D3 가 매칭 직후 채운다(규약).
-- -----------------------------------------------------------------------------
create or replace function public.try_create_match(p_a uuid, p_b uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_lo uuid := least(p_a, p_b);
  v_hi uuid := greatest(p_a, p_b);
  v_match_id uuid;
begin
  if p_a = p_b then
    return null;
  end if;

  -- 상호 좋아요 확인
  if not exists (select 1 from public.likes where from_id = p_a and to_id = p_b)
     or not exists (select 1 from public.likes where from_id = p_b and to_id = p_a) then
    return null;
  end if;

  -- 양측 Lv≥2 + active (미인증 유저 간 DM 불가 — 절대 규칙)
  if (select count(*) from public.profiles
      where id in (p_a, p_b) and verify_level >= 2 and status = 'active') <> 2 then
    return null;
  end if;

  -- 차단 관계 불가
  if public.is_blocked(p_a, p_b) then
    return null;
  end if;

  -- 활성 제재(기능제한 이상) 대상 제외
  if exists (select 1 from public.sanctions s
             where s.profile_id in (p_a, p_b)
               and s.status = 'ACTIVE' and s.level >= 2
               and (s.ends_at is null or s.ends_at > now())) then
    return null;
  end if;

  insert into public.matches (a_id, b_id)
  values (v_lo, v_hi)
  on conflict (a_id, b_id) where a_id is not null and b_id is not null
  do nothing;

  select id into v_match_id
  from public.matches
  where a_id = v_lo and b_id = v_hi
  order by matched_at desc
  limit 1;

  return v_match_id;
end;
$$;

-- 좋아요 insert 시 상호 확인 → 매칭 생성
create or replace function public.check_mutual_like_and_match()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.try_create_match(new.from_id, new.to_id);
  return new;
end;
$$;

create trigger trg_likes_mutual_match
  after insert on public.likes
  for each row execute function public.check_mutual_like_and_match();

-- Lv2 도달 시 보류 매칭 성립 (12_flows §8.5 "상대가 본인인증을 완료하면 매칭됩니다")
create or replace function public.resolve_pending_matches_on_verify()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in
    select l_in.from_id as other_id
    from public.likes l_in
    join public.likes l_out
      on l_out.from_id = new.id and l_out.to_id = l_in.from_id
    where l_in.to_id = new.id
  loop
    perform public.try_create_match(new.id, r.other_id);
  end loop;
  return new;
end;
$$;

create trigger trg_profiles_verify_match
  after update of verify_level on public.profiles
  for each row
  when (old.verify_level < 2 and new.verify_level >= 2)
  execute function public.resolve_pending_matches_on_verify();

-- -----------------------------------------------------------------------------
-- 신고 자동 분류 트리거 — reason_code → priority + sla_due_at (A5 §6-②)
--   P0 = +1h, P1/P2 = +24h. AUTO_* 제재 룰 자체는 D5 소관(Edge Function).
-- -----------------------------------------------------------------------------
create or replace function public.triage_report()
returns trigger
language plpgsql
as $$
begin
  if new.priority is null then
    new.priority := case
      when new.reason_code in (
        'HARASS_SEXUAL_IMAGE', 'HARASS_STALKING', 'HARASS_THREAT',
        'SCAM_ROMANCE', 'SCAM_MONEY', 'SPAM_PROSTITUTION',
        'SAFETY_MINOR', 'SAFETY_OFFLINE',
        'CONTENT_ILLEGAL', 'CONTENT_SELF_HARM'
      ) then 'P0'::public.report_priority
      when new.reason_code in (
        'HARASS_SEXUAL', 'SCAM_EXTERNAL_LINK',
        'FAKE_PROFILE', 'FAKE_INFO', 'CONTENT_HATE'
      ) then 'P1'::public.report_priority
      else 'P2'::public.report_priority
    end;
  end if;

  if new.sla_due_at is null then
    new.sla_due_at := new.created_at
      + case when new.priority = 'P0' then interval '1 hour' else interval '24 hours' end;
  end if;

  return new;
end;
$$;

create trigger trg_reports_triage
  before insert on public.reports
  for each row execute function public.triage_report();

-- -----------------------------------------------------------------------------
-- create_report_snapshot(report_id) — 증거 스냅샷 (A5 §4.2)
--   신고 시점 기준 직전 72시간 · 최대 200개 메시지(초과 시 최신 우선) + 플래그 +
--   피신고 프로필 요약을 reports.evidence 에 동기 기록.
--   이미지 원본의 evidence/ 버킷 복사는 Storage API 가 필요 → D5 Edge Function 이
--   이 함수 호출 직후 수행하고 evidence.images_copied 를 병합한다(규약).
--   service role 전용 (클라이언트 execute 불가).
-- -----------------------------------------------------------------------------
create or replace function public.create_report_snapshot(p_report_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_report   public.reports%rowtype;
  v_from     timestamptz;
  v_messages jsonb;
  v_flags    jsonb;
  v_profile  jsonb;
  v_evidence jsonb;
begin
  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'DUCKMATE_REPORT_NOT_FOUND: %', p_report_id;
  end if;

  v_from := v_report.created_at - interval '72 hours';

  -- 해당 match 두 당사자의 대화만, 최신 우선 최대 200개 (원문 body 포함)
  select coalesce(jsonb_agg(m.msg), '[]'::jsonb) into v_messages
  from (
    select jsonb_build_object(
             'id', id, 'sender_id', sender_id, 'body', body,
             'image_path', image_path, 'created_at', created_at, 'read_at', read_at
           ) as msg
    from public.messages
    where match_id = v_report.match_id
      and created_at between v_from and v_report.created_at
    order by created_at desc
    limit 200
  ) m;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rule_code', rule_code, 'action', action, 'created_at', created_at
         )), '[]'::jsonb) into v_flags
  from public.moderation_flags
  where match_id = v_report.match_id
    and created_at between v_from and v_report.created_at;

  select jsonb_build_object(
           'nickname', p.nickname, 'bio', p.bio,
           'photos', coalesce((select jsonb_agg(ph.path) from public.photos ph
                               where ph.profile_id = p.id), '[]'::jsonb)
         ) into v_profile
  from public.profiles p
  where p.id = v_report.target_id;

  v_evidence := jsonb_build_object(
    'snapshot_at', now(),
    'match_id', v_report.match_id,
    'window', jsonb_build_object('from', v_from, 'to', v_report.created_at),
    'messages', v_messages,
    'images_copied', '[]'::jsonb,      -- Edge Function 이 복사 후 병합
    'reported_profile', coalesce(v_profile, '{}'::jsonb),
    'flags', v_flags
  );

  update public.reports set evidence = v_evidence where id = p_report_id;
  return v_evidence;
end;
$$;

-- -----------------------------------------------------------------------------
-- calc_refund(payment_ref, at) — 환불 계산 뼈대 (A4 §5 — Phase 3 에서 D6 이 구현)
--   구현 예정 계산식 (A4 §5.2, 서버 단일 구현 원칙):
--     사용일수 d      = ceil((at − 결제시각) / 24h), 최소 1
--     일할사용액       = 월요금 × d / 30 (원단위 절사)
--     지급아이템사용액 = Σ(해당 결제 grant_sub 사용 개수 × 정가단가:
--                        superlike ₩980, boost ₩3,900)
--     환불액          = max(0, 월요금 − 일할사용액 − 지급아이템사용액)
--   소모성(A4 §5.3): 팩 = 결제액 × 미사용수/총수, 부스트 = 사용 전 전액/후 0.
--   payments 테이블은 D6(Phase 3)이 추가 — 그 전까지 호출 시 예외.
-- -----------------------------------------------------------------------------
create or replace function public.calc_refund(p_payment_ref text, p_at timestamptz default now())
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'DUCKMATE_NOT_IMPLEMENTED: calc_refund 는 Phase 3(D6)에서 구현된다. payment_ref=%', p_payment_ref;
end;
$$;

-- -----------------------------------------------------------------------------
-- 실행 권한: 쓰기 성격의 definer 함수는 클라이언트 호출 금지 (service role 전용)
-- -----------------------------------------------------------------------------
revoke execute on function public.try_create_match(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_report_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.calc_refund(text, timestamptz) from public, anon, authenticated;
