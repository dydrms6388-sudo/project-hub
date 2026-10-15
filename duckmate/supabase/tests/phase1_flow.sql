-- =============================================================================
-- supabase/tests/phase1_flow.sql — Phase 1 게이트 DB 통합 테스트 (G1)
-- 가입 → 프로필(온보딩) → 본인인증(L2) → 추천 → 상호 좋아요 → 매칭 → 제안 카드 → 메시지(마스킹)
-- → 신고 → 차단 → 차단 후 전송 거부 를 SQL 만으로 관통한다.
-- 실행: scripts/db-test.sh (셰임 → 마이그레이션 → seed.sql → 이 파일). 기대값은 전부 raise exception 으로 단정.
-- 세션 전환은 D 그룹 검증과 같은 방식(set role + request.jwt.* GUC). 실 Supabase 에서는 PostgREST/GoTrue 가 같은 GUC 를 세팅한다.
-- =============================================================================
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- ---------- 고정 id ----------
\set uA '00000000-0000-4000-8000-000000000011'
\set uB '00000000-0000-4000-8000-000000000012'
\set uC '00000000-0000-4000-8000-000000000013'
-- 세션 헬퍼 (authenticated / service / superuser)
\set as_A 'do $x$ begin perform set_config(''role'',''authenticated'',false); perform set_config(''request.jwt.claim.sub'',''00000000-0000-4000-8000-000000000011'',false); perform set_config(''request.jwt.claim.role'',''authenticated'',false); perform set_config(''request.jwt.claims'',''{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}'',false); end $x$;'
\set as_B 'do $x$ begin perform set_config(''role'',''authenticated'',false); perform set_config(''request.jwt.claim.sub'',''00000000-0000-4000-8000-000000000012'',false); perform set_config(''request.jwt.claim.role'',''authenticated'',false); perform set_config(''request.jwt.claims'',''{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}'',false); end $x$;'
\set as_C 'do $x$ begin perform set_config(''role'',''authenticated'',false); perform set_config(''request.jwt.claim.sub'',''00000000-0000-4000-8000-000000000013'',false); perform set_config(''request.jwt.claim.role'',''authenticated'',false); perform set_config(''request.jwt.claims'',''{"sub":"00000000-0000-4000-8000-000000000013","role":"authenticated"}'',false); end $x$;'
\set as_service 'do $x$ begin perform set_config(''role'',''service_role'',false); perform set_config(''request.jwt.claim.sub'','''',false); perform set_config(''request.jwt.claim.role'',''service_role'',false); perform set_config(''request.jwt.claims'',''{"role":"service_role"}'',false); end $x$;'
\set as_pg 'do $x$ begin perform set_config(''role'',''none'',false); perform set_config(''request.jwt.claim.sub'','''',false); perform set_config(''request.jwt.claim.role'','''',false); perform set_config(''request.jwt.claims'','''',false); end $x$;'

-- 테스트 상태 저장용 임시 테이블 (match id 등)
create temp table t_state (k text primary key, v text);
grant select, insert on t_state to anon, authenticated, service_role;

-- =============================================================================
-- S1. 가입: auth.users insert(GoTrue 역할) → handle_new_user → profiles(L0, step basic) → phone_confirmed → L1
-- =============================================================================
insert into auth.users (id, instance_id, aud, role, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (:'uA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000011', '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  (:'uB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000012', '{"provider":"phone","providers":["phone"]}', '{}', now(), now()),
  (:'uC', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '821000000013', '{"provider":"phone","providers":["phone"]}', '{}', now(), now());
do $$ begin
  if (select count(*) from public.profiles where user_id in ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000013')) <> 3
    then raise exception 'S1 FAIL: handle_new_user did not create 3 profiles'; end if;
  if (select verify_level from public.profiles where user_id = '00000000-0000-4000-8000-000000000011') <> 0
    then raise exception 'S1 FAIL: new profile should be L0'; end if;
end $$;
update auth.users set phone_confirmed_at = now() where id in (:'uA', :'uB', :'uC');
do $$ begin
  if (select count(*) from public.profiles where user_id in ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012') and verify_level = 1 and onboarding_step = 'basic') <> 2
    then raise exception 'S1 FAIL: phone confirmed should give L1 + step basic'; end if;
end $$;
select 'S1 PASS signup: 3 users → profiles L1 step=basic';

-- =============================================================================
-- S2. 연령 게이트: create_profile (A·B 성인 / C 미성년 → age_blocked, 생년월일 미저장)
-- =============================================================================
:as_A
do $$ declare r jsonb; begin
  r := public.create_profile('1996-03-14', 'e2e-phone-hash-A');
  if (r->>'age_blocked')::boolean then raise exception 'S2 FAIL: A should be adult, got %', r; end if;
end $$;
-- 온보딩 필수 동의 5종 (본인 insert 정책)
insert into public.consents (user_id, key, version, agreed, source)
select '00000000-0000-4000-8000-000000000011', k, '1.0.0', true, 'onboarding'
from unnest(array['age_19','terms','privacy','evidence_snapshot','youth_policy']::public.consent_key[]) k;
:as_B
do $$ declare r jsonb; begin
  r := public.create_profile('1995-11-20', 'e2e-phone-hash-B');
  if (r->>'age_blocked')::boolean then raise exception 'S2 FAIL: B should be adult, got %', r; end if;
end $$;
insert into public.consents (user_id, key, version, agreed, source)
select '00000000-0000-4000-8000-000000000012', k, '1.0.0', true, 'onboarding'
from unnest(array['age_19','terms','privacy','evidence_snapshot','youth_policy']::public.consent_key[]) k;
:as_C
do $$ declare r jsonb; begin
  r := public.create_profile('2010-01-01', 'e2e-phone-hash-C');
  if not (r->>'age_blocked')::boolean then raise exception 'S2 FAIL: C (2010-01-01) should be age_blocked, got %', r; end if;
end $$;
:as_pg
do $$ begin
  if (select status from public.profiles where user_id = '00000000-0000-4000-8000-000000000013') <> 'age_blocked' then raise exception 'S2 FAIL: C status'; end if;
  if (select birth_date from public.profiles where user_id = '00000000-0000-4000-8000-000000000013') is not null then raise exception 'S2 FAIL: minor birth_date must not be stored'; end if;
  if (select count(*) from public.consents where user_id = '00000000-0000-4000-8000-000000000011') <> 5 then raise exception 'S2 FAIL: A consents'; end if;
end $$;
select 'S2 PASS age gate: A/B adult, C age_blocked without birth_date';

-- =============================================================================
-- S3. 온보딩 6화면 저장 (사용자 권한·RLS): basic → hobbies(취미 겹침: idol 공통) → quiz → card → photos(skip) → step verify
-- =============================================================================
:as_A
update public.profiles set nickname = '테스터A', gender = 'female', region_code = '11440', now_into = '컴백 무대 정주행', bio = 'e2e A'
where user_id = '00000000-0000-4000-8000-000000000011';
insert into public.availability (profile_id, weekday, slot)
select id, w, 'evening'::public.availability_slot from public.profiles, generate_series(1,5) w where user_id = '00000000-0000-4000-8000-000000000011';
insert into public.profile_hobbies (profile_id, hobby_id, rank, intensity, fav_note)
select id, h.hobby_id, h.rank, h.intensity, h.fav_note from public.profiles,
  (values (1, 1, 4, '○○ 컴백 무대'), (2, 2, 3, null), (36, 3, 2, null)) as h(hobby_id, rank, intensity, fav_note)
where user_id = '00000000-0000-4000-8000-000000000011';
insert into public.quiz_answers (profile_id, question_id, choice)
select id, q, ((q % 4) + 1) from public.profiles, generate_series(1,10) q where user_id = '00000000-0000-4000-8000-000000000011';
-- step 전진 (온보딩 액션과 동일한 조건부 update: 앞으로만)
update public.profiles set onboarding_step = 'hobbies' where user_id = '00000000-0000-4000-8000-000000000011' and onboarding_step = 'basic';
update public.profiles set onboarding_step = 'quiz'    where user_id = '00000000-0000-4000-8000-000000000011' and onboarding_step = 'hobbies';
update public.profiles set onboarding_step = 'card'    where user_id = '00000000-0000-4000-8000-000000000011' and onboarding_step = 'quiz';
update public.profiles set onboarding_step = 'photos'  where user_id = '00000000-0000-4000-8000-000000000011' and onboarding_step = 'card';
update public.profiles set onboarding_step = 'verify', onboarding_completed_at = now() where user_id = '00000000-0000-4000-8000-000000000011' and onboarding_step = 'photos';
:as_B
update public.profiles set nickname = '테스터B', gender = 'male', region_code = '11440', now_into = '10k 준비 중', bio = 'e2e B'
where user_id = '00000000-0000-4000-8000-000000000012';
insert into public.availability (profile_id, weekday, slot)
select id, w, 'evening'::public.availability_slot from public.profiles, generate_series(1,5) w where user_id = '00000000-0000-4000-8000-000000000012';
insert into public.profile_hobbies (profile_id, hobby_id, rank, intensity, fav_note)
select id, h.hobby_id, h.rank, h.intensity, h.fav_note from public.profiles,
  (values (1, 1, 5, '같은 최애'), (11, 2, 4, null), (36, 3, 3, null)) as h(hobby_id, rank, intensity, fav_note)
where user_id = '00000000-0000-4000-8000-000000000012';
insert into public.quiz_answers (profile_id, question_id, choice)
select id, q, ((q % 4) + 1) from public.profiles, generate_series(1,10) q where user_id = '00000000-0000-4000-8000-000000000012';
update public.profiles set onboarding_step = 'hobbies' where user_id = '00000000-0000-4000-8000-000000000012' and onboarding_step = 'basic';
update public.profiles set onboarding_step = 'quiz'    where user_id = '00000000-0000-4000-8000-000000000012' and onboarding_step = 'hobbies';
update public.profiles set onboarding_step = 'card'    where user_id = '00000000-0000-4000-8000-000000000012' and onboarding_step = 'quiz';
update public.profiles set onboarding_step = 'photos'  where user_id = '00000000-0000-4000-8000-000000000012' and onboarding_step = 'card';
update public.profiles set onboarding_step = 'verify', onboarding_completed_at = now() where user_id = '00000000-0000-4000-8000-000000000012' and onboarding_step = 'photos';
-- 게이트 상태: step verify, L1 → 추천은 아직 불가(NOT_VERIFIED)
do $$ declare g jsonb; begin
  g := public.get_gate_state();
  if g->>'onboarding_step' <> 'verify' or (g->>'verify_level')::int <> 1 then raise exception 'S3 FAIL: gate state after onboarding %', g; end if;
  begin
    perform public.ensure_today_recommendations();
    raise exception 'S3 FAIL: L1 must not get recommendations';
  exception when insufficient_privilege then null; end;
end $$;
:as_pg
do $$ begin
  if (select count(*) from public.profile_hobbies ph join public.profiles p on p.id = ph.profile_id where p.user_id in ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012')) <> 6 then raise exception 'S3 FAIL: hobbies'; end if;
  if (select count(*) from public.profiles where user_id in ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012') and onboarding_step = 'verify' and onboarding_completed_at is not null) <> 2 then raise exception 'S3 FAIL: step verify'; end if;
end $$;
select 'S3 PASS onboarding: profile/hobbies(idol common)/quiz/availability saved by user, step=verify, L1 blocked from reco';

-- =============================================================================
-- S4. 본인인증(mock success, service role) → L2 + step done. authenticated 호출은 거부
-- =============================================================================
:as_A
do $$ begin
  begin
    perform public.apply_identity_verification('00000000-0000-4000-8000-000000000011', 'mock', 'success', 'ci-A', 'di-A', '1996-03-14', 'female');
    raise exception 'S4 FAIL: apply_identity_verification callable by authenticated';
  exception when insufficient_privilege then null; end;
end $$;
:as_service
do $$ declare r jsonb; begin
  r := public.apply_identity_verification('00000000-0000-4000-8000-000000000011', 'mock', 'success', 'ci-e2e-A', 'di-e2e-A', '1996-03-14', 'female');
  if not (r->>'ok')::boolean or (r->>'verify_level')::int <> 2 then raise exception 'S4 FAIL: A verify result %', r; end if;
  r := public.apply_identity_verification('00000000-0000-4000-8000-000000000012', 'mock', 'success', 'ci-e2e-B', 'di-e2e-B', '1995-11-20', 'male');
  if not (r->>'ok')::boolean or (r->>'verify_level')::int <> 2 then raise exception 'S4 FAIL: B verify result %', r; end if;
end $$;
:as_A
do $$ declare g jsonb; begin
  g := public.get_gate_state();
  if (g->>'verify_level')::int <> 2 or g->>'onboarding_step' <> 'done' or g->>'status' <> 'active' then raise exception 'S4 FAIL: gate after verify %', g; end if;
end $$;
select 'S4 PASS identity: A/B → L2, step done';

-- =============================================================================
-- S5. 추천: ensure_today_recommendations (온디맨드 생성, 멱등) + 서로 포함 보장(테스트 헬퍼 insert, E2E helpers/db.ts 와 동일)
-- =============================================================================
:as_A
do $$ declare r jsonb; begin
  r := public.ensure_today_recommendations();
  if r is null then raise exception 'S5 FAIL: ensure_today_recommendations returned null'; end if;
end $$;
:as_B
do $$ declare r jsonb; begin r := public.ensure_today_recommendations(); end $$;
:as_pg
insert into t_state select 'pA', id::text from public.profiles where user_id = '00000000-0000-4000-8000-000000000011';
insert into t_state select 'pB', id::text from public.profiles where user_id = '00000000-0000-4000-8000-000000000012';
insert into public.daily_recommendations (profile_id, target_id, loop_date, position, score, reasons)
values ((select v::uuid from t_state where k='pA'), (select v::uuid from t_state where k='pB'), public.loop_date(now()), 1, 0.8100, '[{"kind":"hobby_overlap","hobbies":["idol","photography"],"label":"공통 취미: 아이돌·사진"}]'),
       ((select v::uuid from t_state where k='pB'), (select v::uuid from t_state where k='pA'), public.loop_date(now()), 1, 0.8100, '[{"kind":"hobby_overlap","hobbies":["idol","photography"],"label":"공통 취미: 아이돌·사진"}]')
on conflict (profile_id, target_id, loop_date) do nothing;
:as_A
do $$ declare n int; begin
  -- 사용자 권한으로 오늘 추천이 보이고(RLS), 상대 공개 프로필이 보인다
  select count(*) into n from public.daily_recommendations where loop_date = public.loop_date(now());
  if n < 1 then raise exception 'S5 FAIL: A sees no recommendations'; end if;
  if not exists (select 1 from public.v_profile_public where nickname = '테스터B') then raise exception 'S5 FAIL: A cannot see B public profile'; end if;
  -- 남의 추천 행은 보이지 않는다
  if exists (select 1 from public.daily_recommendations d join public.profiles p on p.id = d.profile_id where p.nickname = '테스터B') then raise exception 'S5 FAIL: A sees B rows'; end if;
end $$;
select 'S5 PASS recommendations: on-demand ensure + mutual rows, RLS scoped';

-- =============================================================================
-- S6. 상호 좋아요 → 매칭 (act_on_recommendation), 이중 클릭 멱등
-- =============================================================================
:as_A
do $$ declare r jsonb; pb uuid := (select v::uuid from t_state where k='pB'); begin
  r := public.act_on_recommendation(pb, 'like');
  if (r->>'matched')::boolean then raise exception 'S6 FAIL: first like should not match %', r; end if;
  r := public.act_on_recommendation(pb, 'like');
  if not (r->>'already')::boolean then raise exception 'S6 FAIL: repeat like should be idempotent %', r; end if;
  begin
    perform public.act_on_recommendation(pb, 'pass');
    raise exception 'S6 FAIL: different action after like must be ALREADY_ACTED';
  exception when check_violation then null; end;
end $$;
:as_B
do $$ declare r jsonb; pa uuid := (select v::uuid from t_state where k='pA'); begin
  r := public.act_on_recommendation(pa, 'like');
  if not (r->>'matched')::boolean or r->>'match_id' is null then raise exception 'S6 FAIL: mutual like should match %', r; end if;
  if r->'suggestion_input' is null then raise exception 'S6 FAIL: suggestion_input missing'; end if;
  insert into t_state values ('match', r->>'match_id');
end $$;
:as_pg
do $$ declare m public.matches%rowtype; begin
  select * into m from public.matches where id = (select v::uuid from t_state where k='match');
  if m.status <> 'active' or m.mode <> 'friend' then raise exception 'S6 FAIL: match row %', m; end if;
  if (select count(*) from public.likes where from_id in ((select v::uuid from t_state where k='pA'),(select v::uuid from t_state where k='pB'))) <> 2 then raise exception 'S6 FAIL: likes'; end if;
  if not exists (select 1 from public.audit_logs where action = 'match_created' and target_id = m.id::text) then raise exception 'S6 FAIL: audit match_created'; end if;
end $$;
select 'S6 PASS mutual like → match active (friend), audit match_created';

-- =============================================================================
-- S7. 제안 카드: match_suggestion_input(당사자) → set_match_first_suggestion(service, 3장) → 매칭 뷰에 3장
-- =============================================================================
:as_A
do $$ declare inp jsonb; begin
  inp := public.match_suggestion_input((select v::uuid from t_state where k='match'));
  if jsonb_array_length(inp->'common_hobbies') < 1 then raise exception 'S7 FAIL: no common hobbies in suggestion input %', inp; end if;
  begin
    perform public.set_match_first_suggestion((select v::uuid from t_state where k='match'), '[]'::jsonb);
    raise exception 'S7 FAIL: set_match_first_suggestion callable by authenticated';
  exception when insufficient_privilege then null; end;
end $$;
:as_service
do $$ declare r jsonb; begin
  r := public.set_match_first_suggestion((select v::uuid from t_state where k='match'),
    '[{"id":"c1","template_id":"idol_comeback_talk","title":"컴백 얘기부터","body":"요즘 컴백 무대 어떤 게 제일 좋았어요?","kind":"talk"},
      {"id":"c2","template_id":"photo_walk","title":"출사 같이","body":"주말에 굿즈 촬영 같이 가실래요?","kind":"offline"},
      {"id":"c3","template_id":"online_stream","title":"같이 보기","body":"이번 주 컴백 무대 같이 실시간으로 봐요!","kind":"online"}]'::jsonb);
  if not (r->>'set')::boolean then raise exception 'S7 FAIL: first_suggestion not set %', r; end if;
  -- 두 번째 호출은 덮어쓰지 않는다(멱등)
  r := public.set_match_first_suggestion((select v::uuid from t_state where k='match'), '[{"id":"x"},{"id":"y"},{"id":"z"}]'::jsonb);
  if (r->>'set')::boolean then raise exception 'S7 FAIL: first_suggestion overwritten'; end if;
end $$;
:as_B
do $$ begin
  if jsonb_array_length(public.get_chat_list((select v::uuid from t_state where k='match')) -> 0 -> 'first_suggestion') <> 3
    then raise exception 'S7 FAIL: B does not see 3 suggestion cards via get_chat_list'; end if;
end $$;
select 'S7 PASS first suggestion: 3 cards set once, visible to participants';

-- =============================================================================
-- S8. 메시지: A 가 제안 카드 ③ 본문으로 첫 메시지(service send_message, suggestion_template_id) → B 가 전화번호 → 마스킹
-- =============================================================================
:as_A
do $$ begin
  begin
    insert into public.messages (match_id, sender_id, body, masked_body) values ((select v::uuid from t_state where k='match'), (select v::uuid from t_state where k='pA'), 'x', 'x');
    raise exception 'S8 FAIL: direct insert into messages allowed for authenticated';
  exception when insufficient_privilege then null; end;
end $$;
:as_service
do $$ declare r jsonb; m uuid := (select v::uuid from t_state where k='match'); begin
  r := public.send_message(m, (select v::uuid from t_state where k='pA'), '이번 주 컴백 무대 같이 실시간으로 봐요!', null, '[]'::jsonb, null, null, 'online_stream');
  if r->>'message_id' is null then raise exception 'S8 FAIL: first message %', r; end if;
  r := public.send_message(m, (select v::uuid from t_state where k='pB'), '제 번호는 010-1234-5678 이에요', null,
        '[{"rule_id":"CT_PHONE","matched":"010-1234-5678","score":0}]'::jsonb, null, '제 번호는 [연락처 숨김] 이에요');
  if r->>'masked_body' not like '%[연락처 숨김]%' then raise exception 'S8 FAIL: phone not masked %', r; end if;
  if not (r->>'contact_masked')::boolean then raise exception 'S8 FAIL: contact_masked flag %', r; end if;
end $$;
:as_pg
do $$ declare m public.matches%rowtype; begin
  select * into m from public.matches where id = (select v::uuid from t_state where k='match');
  if m.first_message_at is null or m.last_message_at is null then raise exception 'S8 FAIL: first/last_message_at not set'; end if;
  if (select suggestion_template_id from public.messages where match_id = m.id order by created_at limit 1) <> 'online_stream' then raise exception 'S8 FAIL: suggestion_template_id'; end if;
  if (select count(*) from public.message_flags mf join public.messages ms on ms.id = mf.message_id where ms.match_id = m.id and mf.rule_id = 'CT_PHONE') <> 1 then raise exception 'S8 FAIL: CT_PHONE flag'; end if;
  if not exists (select 1 from realtime.messages where topic = 'match:' || m.id::text) then raise exception 'S8 FAIL: realtime broadcast missing'; end if;
  if exists (select 1 from realtime.messages where topic = 'match:' || m.id::text and payload ? 'body') then raise exception 'S8 FAIL: realtime payload leaks body'; end if;
end $$;
-- 수신자(A) 화면: 마스킹 본문 / 발신자(B) 화면: 원문. 원문 컬럼은 authenticated 에 비공개
:as_A
do $$ declare d text; begin
  select display_body into d from public.v_messages where match_id = (select v::uuid from t_state where k='match') and not is_mine order by created_at desc limit 1;
  if d <> '제 번호는 [연락처 숨김] 이에요' then raise exception 'S8 FAIL: recipient sees % ', d; end if;
  begin
    perform body from public.messages limit 1;
    raise exception 'S8 FAIL: messages.body readable by authenticated';
  exception when insufficient_privilege then null; end;
  if (select (e->>'unread_count')::int from jsonb_array_elements(public.get_chat_list()) e where e->>'match_id' = (select v from t_state where k='match')) <> 1
    then raise exception 'S8 FAIL: A unread should be 1'; end if;
  if (select (public.mark_read((select v::uuid from t_state where k='match'))->>'marked')::int) <> 1 then raise exception 'S8 FAIL: mark_read'; end if;
end $$;
:as_B
do $$ declare d text; begin
  select display_body into d from public.v_messages where match_id = (select v::uuid from t_state where k='match') and is_mine order by created_at desc limit 1;
  if d <> '제 번호는 010-1234-5678 이에요' then raise exception 'S8 FAIL: sender should see original, got %', d; end if;
end $$;
select 'S8 PASS messages: first message via suggestion, phone masked for recipient, body column hidden, unread/mark_read';

-- =============================================================================
-- S9. 신고: A → B ROMANCE_SCAM (채팅 surface) — 증거 스냅샷, 24h 재신고 dedupe, 증거 컬럼 비공개
-- =============================================================================
:as_A
do $$ declare r jsonb; r2 jsonb; m uuid := (select v::uuid from t_state where k='match'); begin
  r := public.create_report((select v::uuid from t_state where k='pB'), 'ROMANCE_SCAM', '연락처를 계속 물어봐요', m, 'chat', null);
  if r->>'report_id' is null then raise exception 'S9 FAIL: report %', r; end if;
  insert into t_state values ('report', r->>'report_id');
  r2 := public.create_report((select v::uuid from t_state where k='pB'), 'ROMANCE_SCAM', '또 물어봐요', m, 'chat', null);
  if not coalesce((r2->>'deduped')::boolean, false) then raise exception 'S9 FAIL: 24h re-report should dedupe %', r2; end if;
  begin
    perform evidence from public.reports limit 1;
    raise exception 'S9 FAIL: reports.evidence readable by authenticated';
  exception when insufficient_privilege then null; end;
end $$;
:as_pg
do $$ declare rp public.reports%rowtype; begin
  select * into rp from public.reports where id = (select v::uuid from t_state where k='report');
  if rp.status <> 'queued' then raise exception 'S9 FAIL: report status %', rp.status; end if;
  if jsonb_array_length(rp.evidence->'messages') <> 2 then raise exception 'S9 FAIL: evidence should snapshot 2 messages, got %', jsonb_array_length(rp.evidence->'messages'); end if;
  if rp.reporter_id <> (select v::uuid from t_state where k='pA') or rp.target_id <> (select v::uuid from t_state where k='pB') then raise exception 'S9 FAIL: report parties'; end if;
  if (select count(*) from public.reports where reporter_id = rp.reporter_id and target_id = rp.target_id) <> 1 then raise exception 'S9 FAIL: dedupe created 2nd row'; end if;
end $$;
select 'S9 PASS report: ROMANCE_SCAM queued with 2-message evidence, 24h dedupe, evidence hidden';

-- =============================================================================
-- S10. 차단: A → B apply_block → v_my_blocks 1건, 매칭 blocked, 좋아요·오늘 추천 삭제, 차단자 화면에서 방 제거
-- =============================================================================
:as_A
do $$ begin
  perform public.apply_block((select v::uuid from t_state where k='pB'));
  if (select count(*) from public.v_my_blocks) <> 1 then raise exception 'S10 FAIL: v_my_blocks count'; end if;
  if (select blocked_nickname from public.v_my_blocks limit 1) <> '테스터B' then raise exception 'S10 FAIL: blocked nickname'; end if;
  if exists (select 1 from public.v_my_matches where match_id = (select v::uuid from t_state where k='match')) then raise exception 'S10 FAIL: blocker still sees match'; end if;
  if jsonb_array_length(public.get_chat_list((select v::uuid from t_state where k='match'))) <> 0 then raise exception 'S10 FAIL: blocker chat list still lists room'; end if;
end $$;
:as_pg
do $$ declare m public.matches%rowtype; begin
  select * into m from public.matches where id = (select v::uuid from t_state where k='match');
  if m.status <> 'blocked' or m.ended_at is null then raise exception 'S10 FAIL: match should be blocked, got %', m.status; end if;
  if exists (select 1 from public.likes where from_id in ((select v::uuid from t_state where k='pA'),(select v::uuid from t_state where k='pB')) and to_id in ((select v::uuid from t_state where k='pA'),(select v::uuid from t_state where k='pB'))) then raise exception 'S10 FAIL: likes not removed'; end if;
  if exists (select 1 from public.daily_recommendations where loop_date >= public.loop_date(now()) and profile_id = (select v::uuid from t_state where k='pA') and target_id = (select v::uuid from t_state where k='pB')) then raise exception 'S10 FAIL: today reco not removed'; end if;
  if not public.are_blocked((select v::uuid from t_state where k='pA'), (select v::uuid from t_state where k='pB')) then raise exception 'S10 FAIL: are_blocked'; end if;
end $$;
select 'S10 PASS block: v_my_blocks=1, match blocked, likes/reco removed, room hidden from blocker';

-- =============================================================================
-- S11. 차단 후 전송 거부: B 의 send_message → NOT_ENTITLED, can_send_message=false, B 의 좋아요 재시도도 거부
-- =============================================================================
:as_service
do $$ declare m uuid := (select v::uuid from t_state where k='match'); begin
  begin
    perform public.send_message(m, (select v::uuid from t_state where k='pB'), '아직 거기 있어요?');
    raise exception 'S11 FAIL: message sent after block';
  exception when insufficient_privilege then
    if sqlerrm not like 'NOT_ENTITLED%' then raise exception 'S11 FAIL: unexpected error %', sqlerrm; end if;
  end;
  begin
    perform public.send_message(m, (select v::uuid from t_state where k='pA'), '차단자 본인도 못 보냄');
    raise exception 'S11 FAIL: blocker could send after block';
  exception when insufficient_privilege then null; end;
end $$;
:as_B
do $$ begin
  if public.can_send_message((select v::uuid from t_state where k='match'), (select v::uuid from t_state where k='pB')) then raise exception 'S11 FAIL: can_send_message true'; end if;
  if public.can_like((select v::uuid from t_state where k='pB'), (select v::uuid from t_state where k='pA')) then raise exception 'S11 FAIL: can_like true after block'; end if;
  -- 차단당한 쪽 화면: 방은 남지만 종료 상태로 보인다
  if (select status from public.v_my_matches where match_id = (select v::uuid from t_state where k='match')) is distinct from 'blocked' then raise exception 'S11 FAIL: blocked side should see status blocked'; end if;
end $$;
-- 차단 해제 → 목록 0 (매칭은 복구되지 않음)
:as_A
do $$ begin
  perform public.remove_block((select v::uuid from t_state where k='pB'));
  if (select count(*) from public.v_my_blocks) <> 0 then raise exception 'S11 FAIL: unblock'; end if;
end $$;
:as_pg
do $$ begin
  if (select status from public.matches where id = (select v::uuid from t_state where k='match')) <> 'blocked' then raise exception 'S11 FAIL: match must stay blocked after unblock'; end if;
end $$;
select 'S11 PASS after block: send_message denied both ways, can_send/can_like false, unblock → 0 blocks, match stays ended';

select 'PHASE1 FLOW: ALL PASS';
