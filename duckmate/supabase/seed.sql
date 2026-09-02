-- =============================================================================
-- supabase/seed.sql — 로컬/스테이징 개발용 시드 (supabase db reset 시에만 실행, 프로덕션 미적용)
-- 페르소나 4쌍(A2): 서윤(P1) · 도현(P2) · 민재(P3) · 하은(P4)
-- E2E(P1 시나리오) 계정 2개 = 서윤 ↔ 민재 (같은 friend 모드, L2, 서로 오늘 추천에 포함)
-- 휴대폰 번호는 예약 번호대(010-0000-xxxx). 실제 OTP 는 config.toml 의 test OTP 로 통과.
-- =============================================================================

-- ---------- auth.users ----------
insert into auth.users (
  id, instance_id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000001', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000002', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000003', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000004', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), false, false),
  -- 어드민(모더레이터) 계정
  ('00000000-0000-4000-8000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000099', now(), '{"provider":"phone","providers":["phone"],"role":"admin"}', '{}', now(), now(), false, false)
on conflict (id) do nothing;

insert into public.admin_users (user_id, role, note)
values ('00000000-0000-4000-8000-000000000099', 'admin', 'dev seed admin')
on conflict (user_id) do nothing;

-- ---------- profiles (handle_new_user 트리거가 만든 행을 갱신) ----------
-- 고정 profile id 를 쓰기 위해 트리거 생성분의 id 를 교체
update public.profiles set id = '10000000-0000-4000-8000-000000000001' where user_id = '00000000-0000-4000-8000-000000000001';
update public.profiles set id = '10000000-0000-4000-8000-000000000002' where user_id = '00000000-0000-4000-8000-000000000002';
update public.profiles set id = '10000000-0000-4000-8000-000000000003' where user_id = '00000000-0000-4000-8000-000000000003';
update public.profiles set id = '10000000-0000-4000-8000-000000000004' where user_id = '00000000-0000-4000-8000-000000000004';

update public.profiles set nickname = '서윤', birth_date = '1999-03-14', gender = 'female', region_code = '11440',
  bio = '컴백 무대 정주행이 취미예요. 굿즈 촬영도 좋아해요.', now_into = '컴백 무대 정주행', onboarding_step = 'done',
  onboarding_completed_at = now(), status = 'active'
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set nickname = '도현', birth_date = '2002-07-02', gender = 'male', region_code = '11620',
  bio = '보드게임 입문 3개월차. 같이 배워요.', now_into = '스플렌더 전략 공부', onboarding_step = 'done',
  onboarding_completed_at = now(), status = 'active'
where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set nickname = '민재', birth_date = '1995-11-20', gender = 'male', region_code = '11200',
  bio = '주말 아침 한강 러닝. 10k 준비 중이에요.', now_into = '10k 준비 중', onboarding_step = 'done',
  onboarding_completed_at = now(), status = 'active'
where id = '10000000-0000-4000-8000-000000000003';
update public.profiles set nickname = '하은', birth_date = '1997-05-09', gender = 'female', region_code = '41130',
  bio = '온라인 협동 게임이랑 웹툰 얘기 좋아해요.', now_into = '신작 웹툰 정주행', onboarding_step = 'done',
  onboarding_completed_at = now(), status = 'active'
where id = '10000000-0000-4000-8000-000000000004';

-- ---------- 동의 이력 ----------
insert into public.consents (user_id, key, version, agreed, source)
select u, k, '1.0.0', true, 'onboarding'
from unnest(array[
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004']::uuid[]) u
cross join unnest(array['age_19','terms','privacy','evidence_snapshot']::public.consent_key[]) k;

-- ---------- 취미 ----------
insert into public.profile_hobbies (profile_id, hobby_id, rank, intensity, fav_note) values
  ('10000000-0000-4000-8000-000000000001', 1,  1, 4, '○○ 컴백 무대'),
  ('10000000-0000-4000-8000-000000000001', 24, 2, 2, null),
  ('10000000-0000-4000-8000-000000000001', 36, 3, 3, '굿즈 촬영'),
  ('10000000-0000-4000-8000-000000000002', 6,  1, 2, '스플렌더'),
  ('10000000-0000-4000-8000-000000000002', 8,  2, 1, null),
  ('10000000-0000-4000-8000-000000000002', 39, 3, 3, null),
  ('10000000-0000-4000-8000-000000000003', 11, 1, 4, '한강 야간 러닝'),
  ('10000000-0000-4000-8000-000000000003', 6,  2, 4, null),
  ('10000000-0000-4000-8000-000000000003', 26, 3, 3, null),
  ('10000000-0000-4000-8000-000000000003', 36, 4, 2, null),
  ('10000000-0000-4000-8000-000000000004', 21, 1, 4, '협동 게임'),
  ('10000000-0000-4000-8000-000000000004', 17, 2, 5, '요일 웹툰 전부'),
  ('10000000-0000-4000-8000-000000000004', 43, 3, 3, null);

-- ---------- 퀴즈 답변 (10문항) ----------
insert into public.quiz_answers (profile_id, question_id, choice)
select p, q, ((q + i) % 4) + 1
from unnest(array[
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']::uuid[]) with ordinality as t(p, i)
cross join generate_series(1, 10) q;

-- ---------- 활동 시간대 ----------
insert into public.availability (profile_id, weekday, slot) values
  ('10000000-0000-4000-8000-000000000001', 6, 'afternoon'), ('10000000-0000-4000-8000-000000000001', 7, 'afternoon'),
  ('10000000-0000-4000-8000-000000000001', 3, 'evening'),
  ('10000000-0000-4000-8000-000000000002', 6, 'afternoon'), ('10000000-0000-4000-8000-000000000002', 2, 'evening'),
  ('10000000-0000-4000-8000-000000000003', 6, 'morning'),   ('10000000-0000-4000-8000-000000000003', 7, 'morning'),
  ('10000000-0000-4000-8000-000000000003', 6, 'afternoon'),
  ('10000000-0000-4000-8000-000000000004', 1, 'night'), ('10000000-0000-4000-8000-000000000004', 4, 'night'),
  ('10000000-0000-4000-8000-000000000004', 6, 'night');

-- ---------- 본인인증(mock 성공) → L2 (트리거가 recompute) ----------
insert into public.identity_verifications (user_id, profile_id, provider, result, ci_hash, di_hash, birth_date, gender, birth_date_verified, verified_at)
values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'mock', 'success', encode(sha256('seed-ci-1'::bytea), 'hex'), encode(sha256('seed-di-1'::bytea), 'hex'), '1999-03-14', 'female', true, now()),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'mock', 'success', encode(sha256('seed-ci-2'::bytea), 'hex'), encode(sha256('seed-di-2'::bytea), 'hex'), '2002-07-02', 'male',   true, now()),
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'mock', 'success', encode(sha256('seed-ci-3'::bytea), 'hex'), encode(sha256('seed-di-3'::bytea), 'hex'), '1995-11-20', 'male',   true, now()),
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'mock', 'success', encode(sha256('seed-ci-4'::bytea), 'hex'), encode(sha256('seed-di-4'::bytea), 'hex'), '1997-05-09', 'female', true, now());

-- ---------- 민재: 승인 대표 사진 → L3 (파일은 storage 에 없어도 됨, 행만) ----------
insert into public.photos (id, profile_id, path, is_primary, review_status, reviewed_by, reviewed_at)
values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000003/20000000-0000-4000-8000-000000000003.webp', true, 'approved',
        '00000000-0000-4000-8000-000000000099', now());

-- ---------- 오늘 추천 (서윤 ↔ 민재, 서윤 → 도현, 하은 → 도현) ----------
insert into public.daily_recommendations (profile_id, target_id, loop_date, position, score, reasons) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', public.loop_date(now()), 1, 0.7800, '[{"kind":"hobby_overlap","hobbies":["photography"]},{"kind":"slot_overlap","slots":["sat_afternoon"]}]'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', public.loop_date(now()), 2, 0.6100, '[{"kind":"slot_overlap","slots":["sat_afternoon"]}]'),
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', public.loop_date(now()), 1, 0.7800, '[{"kind":"hobby_overlap","hobbies":["photography"]}]'),
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', public.loop_date(now()), 2, 0.7200, '[{"kind":"hobby_overlap","hobbies":["boardgame"]}]'),
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', public.loop_date(now()), 1, 0.5500, '[{"kind":"category_adjacent","categories":["gaming","boardgame"]}]');

-- 검증: 4명 모두 L2 이상, 민재는 L3
do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.profiles
  where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
               '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004')
    and verify_level < 2;
  if v_bad > 0 then raise exception 'seed: % profiles below L2', v_bad; end if;
  if (select verify_level from public.profiles where id = '10000000-0000-4000-8000-000000000003') <> 3 then
    raise exception 'seed: 민재 should be L3';
  end if;
end $$;
