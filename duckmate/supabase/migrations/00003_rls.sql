-- =============================================================================
-- 덕메이트(DuckMate) · D1 마이그레이션 00003 — RLS 전면 적용
--
-- 원칙 (스펙 §4 + A5 + PRD):
--   1) 자기 행만 쓰기
--   2) 매칭/탐색 상대는 프로필 "읽기"만 (can_view_profile)
--   3) 차단 관계는 양방향 완전 불가시 (추천·좋아요·매칭·채팅 전부)
--   4) reports / sanctions / moderation_flags / appeals(결정) / audit_logs /
--      blocked_hashes / evidence = service role 전용 (service role 은 RLS 우회)
--   5) admin 판정 = profiles.role = 'admin' (별도 admin_users 테이블 없이 확정 —
--      단일 테이블 유지가 온보딩/가드와 정합. role 컬럼은 클라이언트 UPDATE 권한에서
--      제외되어 service role 만 부여 가능). admin 정책은 "읽기 큐" 한정,
--      모든 어드민 변경(제재 부과·검수 확정)은 서버 라우트의 service role 로 수행.
--   6) 만 19세 미만·banned·정지 계정은 is_active_member() 로 RLS 레벨에서도 차단.
--
-- 주의: 아래 헬퍼 함수들은 정책이 참조하므로 00004 가 아닌 이 파일 상단에 선행
--   정의한다(마이그레이션 실행 순서 제약). 비즈니스 함수/트리거는 00004.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. RLS 헬퍼 함수 (security definer — 소유자 권한으로 sanctions/blocks 참조)
-- -----------------------------------------------------------------------------

-- 현재 로그인 유저의 profile id
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

-- 현재 유저의 verify_level (프로필 없으면 -1)
create or replace function public.current_verify_level()
returns smallint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select verify_level from public.profiles where user_id = auth.uid()),
    -1
  )::smallint;
$$;

-- admin 판정 (profiles.role 기반 — 결정사항 5)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- 차단 관계 양방향 확인 (a, b = profile id)
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- 활성 회원(열람 자격): active + Lv1+ + 만 19세 이상 + 활성 제재 level 3+ 없음
create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
      and p.verify_level >= 1
      and p.birth_date <= (current_date - interval '19 years')
      and not exists (
        select 1 from public.sanctions s
        where s.profile_id = p.id
          and s.status = 'ACTIVE'
          and s.level >= 3
          and (s.ends_at is null or s.ends_at > now())
      )
  );
$$;

-- 발신 자격(쓰기): 열람 자격 + 기능제한(level 2, 신규 좋아요·발신 정지) 없음
create or replace function public.can_engage()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and not exists (
      select 1 from public.sanctions s
      where s.profile_id = public.current_profile_id()
        and s.status = 'ACTIVE'
        and s.level >= 2
        and (s.ends_at is null or s.ends_at > now())
    );
$$;

-- 상대 프로필 열람 가능 여부: 내가 활성 회원 + 상대 active·Lv1+·제재 비노출 + 비차단
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and not public.is_blocked(public.current_profile_id(), target)
    and exists (
      select 1 from public.profiles t
      where t.id = target
        and t.status = 'active'
        and t.verify_level >= 1
        and not exists (
          select 1 from public.sanctions s
          where s.profile_id = t.id
            and s.status = 'ACTIVE'
            and s.level >= 3
            and (s.ends_at is null or s.ends_at > now())
        )
    );
$$;

-- 이의제기 접수 가능: 내 제재 + 통보 후 30일 내 (건당 1회는 appeals.sanction_id unique)
create or replace function public.can_appeal(p_sanction_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sanctions s
    where s.id = p_sanction_id
      and s.profile_id = public.current_profile_id()
      and now() <= s.created_at + interval '30 days'
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. RLS enable — 전 테이블
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.hobbies               enable row level security;
alter table public.profile_hobbies       enable row level security;
alter table public.quiz_questions        enable row level security;
alter table public.quiz_answers          enable row level security;
alter table public.photos                enable row level security;
alter table public.availability          enable row level security;
alter table public.daily_recommendations enable row level security;
alter table public.likes                 enable row level security;
alter table public.matches               enable row level security;
alter table public.messages              enable row level security;
alter table public.blocks                enable row level security;
alter table public.reports               enable row level security;
alter table public.sanctions             enable row level security;
alter table public.moderation_flags      enable row level security;
alter table public.appeals               enable row level security;
alter table public.blocked_hashes        enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.item_ledger           enable row level security;
alter table public.game_profiles         enable row level security;
alter table public.game_sessions         enable row level security;
alter table public.quests                enable row level security;
alter table public.quest_progress        enable row level security;
alter table public.events                enable row level security;
alter table public.event_rsvps           enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.analytics_events      enable row level security;
alter table public.push_tokens           enable row level security;
alter table public.contact_messages      enable row level security;
alter table public.refund_requests       enable row level security;

-- -----------------------------------------------------------------------------
-- 2. 컬럼 권한 (RLS 는 행 단위 — 열 단위 보호는 grant 로)
-- -----------------------------------------------------------------------------

-- profiles: 클라이언트가 갱신할 수 있는 컬럼 화이트리스트.
--   birth_date(PASS 덮어쓰기)·verify_level·status·role·boost_active_until 은
--   service role 전용 → 권한 상승/연령 위조 원천 차단.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nickname, bio, region_code, mode, onboarding_step,
              fav_note, current_obsession, last_active_at)
  on public.profiles to authenticated;

-- messages: 클라이언트는 원문 body·mask_rules 를 SELECT 불가(A5 — masked_body 만).
--   insert 는 Edge Function(service role)이 마스킹 생성 후 수행. read_at 만 갱신 가능.
revoke select, insert, update, delete on public.messages from anon, authenticated;
grant select (id, match_id, sender_id, masked_body, image_path, read_at, created_at)
  on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- reports: evidence 는 어떤 클라이언트도 SELECT 불가(어드민도 서버 프록시로만).
revoke select, insert, update, delete on public.reports from anon, authenticated;
grant select (id, reporter_id, target_id, match_id, reason_code, detail,
              status, priority, sla_due_at, handled_by, handled_at,
              created_at, updated_at)
  on public.reports to authenticated;   -- 행 접근은 아래 admin 정책이 제한

-- photos: 검수 상태는 클라이언트가 조작 불가.
revoke insert, update, delete on public.photos from anon, authenticated;
grant insert (profile_id, path, is_primary) on public.photos to authenticated;
grant update (is_primary) on public.photos to authenticated;
grant delete on public.photos to authenticated;

-- daily_recommendations: 클라이언트는 seen_at 만 기록.
revoke insert, update, delete on public.daily_recommendations from anon, authenticated;
grant update (seen_at) on public.daily_recommendations to authenticated;

-- matches: 참여자는 status/closed_at(언매치)만 변경 가능. 생성은 트리거/service.
revoke insert, update, delete on public.matches from anon, authenticated;
grant update (status, closed_at) on public.matches to authenticated;

-- -----------------------------------------------------------------------------
-- 3. 정책
-- -----------------------------------------------------------------------------

-- profiles ---------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy profiles_select_visible on public.profiles
  for select to authenticated
  using (user_id <> auth.uid() and public.can_view_profile(id));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- hobbies / quiz_questions: 로그인 유저 전체 읽기, 쓰기는 service role -----
create policy hobbies_select on public.hobbies
  for select to authenticated
  using (is_active or public.is_admin());

create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (is_active or public.is_admin());

-- profile_hobbies ----------------------------------------------------------
create policy profile_hobbies_select on public.profile_hobbies
  for select to authenticated
  using (profile_id = public.current_profile_id()
         or public.can_view_profile(profile_id));

create policy profile_hobbies_write on public.profile_hobbies
  for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- quiz_answers: 성향 벡터는 본인 외 비공개 (궁합 계산은 서버) --------------
create policy quiz_answers_own on public.quiz_answers
  for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- photos --------------------------------------------------------------------
create policy photos_select_own on public.photos
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy photos_select_approved on public.photos
  for select to authenticated
  using (review_status = 'approved' and public.can_view_profile(profile_id));

create policy photos_select_admin on public.photos
  for select to authenticated
  using (public.is_admin());          -- 검수 큐 열람 (확정 처리는 service role)

create policy photos_insert_own on public.photos
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy photos_update_own on public.photos
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy photos_delete_own on public.photos
  for delete to authenticated
  using (profile_id = public.current_profile_id());

-- availability ----------------------------------------------------------------
create policy availability_select on public.availability
  for select to authenticated
  using (profile_id = public.current_profile_id()
         or public.can_view_profile(profile_id));

create policy availability_write on public.availability
  for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- daily_recommendations: 본인 큐만. 발행/삭제는 service role (D3) --------------
create policy daily_recs_select_own on public.daily_recommendations
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy daily_recs_update_seen on public.daily_recommendations
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- likes -------------------------------------------------------------------------
-- 보낸 것 + 받은 것(블러 카운트) 읽기. 발신은 활성·비제재·상대 열람 가능일 때만.
-- Lv1 일 3회 제한은 서버(Edge)에서 카운트 — RLS 는 자격만 방어 (D2/D3 규약).
create policy likes_select_own on public.likes
  for select to authenticated
  using (from_id = public.current_profile_id()
         or to_id = public.current_profile_id());

create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (
    from_id = public.current_profile_id()
    and public.can_engage()
    and public.can_view_profile(to_id)
  );

-- matches ------------------------------------------------------------------------
-- 차단 발생 시 방 자체가 비노출 (양방향 불가시 원칙).
create policy matches_select_participant on public.matches
  for select to authenticated
  using (
    (a_id = public.current_profile_id() or b_id = public.current_profile_id())
    and (a_id is null or b_id is null or not public.is_blocked(a_id, b_id))
  );

create policy matches_update_participant on public.matches
  for update to authenticated
  using (a_id = public.current_profile_id() or b_id = public.current_profile_id())
  with check (a_id = public.current_profile_id() or b_id = public.current_profile_id());

-- messages -------------------------------------------------------------------------
-- 참여자만 + 차단 시 불가시. (컬럼 권한으로 masked_body 만 노출됨)
create policy messages_select_participant on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.a_id = public.current_profile_id() or m.b_id = public.current_profile_id())
      and (m.a_id is null or m.b_id is null or not public.is_blocked(m.a_id, m.b_id))
  ));

create policy messages_update_read on public.messages
  for update to authenticated
  using (
    sender_id is distinct from public.current_profile_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.a_id = public.current_profile_id() or m.b_id = public.current_profile_id())
    )
  )
  with check (true);   -- 컬럼 권한이 read_at 로 제한

-- blocks -------------------------------------------------------------------------------
create policy blocks_own on public.blocks
  for all to authenticated
  using (blocker_id = public.current_profile_id())
  with check (blocker_id = public.current_profile_id());

-- reports: service role 전용 접수·처리. admin 은 큐 "읽기"만 (evidence 컬럼 제외) ----
create policy reports_select_admin on public.reports
  for select to authenticated
  using (public.is_admin());

-- sanctions: service role 전용. admin 읽기만. 본인 조회는 my_sanctions 뷰 -------------
create policy sanctions_select_admin on public.sanctions
  for select to authenticated
  using (public.is_admin());

-- moderation_flags: service role 전용 + admin 읽기 ------------------------------------
create policy modflags_select_admin on public.moderation_flags
  for select to authenticated
  using (public.is_admin());

-- appeals: 본인 접수(30일 내·제재당 1회)·본인 조회, admin 읽기. 결정은 service role ----
create policy appeals_select_own on public.appeals
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

create policy appeals_insert_own on public.appeals
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and public.can_appeal(sanction_id)
  );

-- blocked_hashes / audit_logs: 정책 없음 = service role 외 전면 차단 -------------------
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());
-- (blocked_hashes 는 admin 조회도 불필요 — 정책 0개 유지)

-- subscriptions / item_ledger: 본인 읽기만, 쓰기는 전부 service role (A4 §2.2) ---------
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy item_ledger_select_own on public.item_ledger
  for select to authenticated
  using (user_id = auth.uid());

-- game_profiles / game_sessions: 본인 읽기, 쓰기는 service role (Phase 2) --------------
create policy game_profiles_select_own on public.game_profiles
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy game_sessions_select_participant on public.game_sessions
  for select to authenticated
  using (participants ? (public.current_profile_id())::text);

-- quests / quest_progress ----------------------------------------------------------------
create policy quests_select on public.quests
  for select to authenticated
  using (is_active or public.is_admin());

create policy quest_progress_select_own on public.quest_progress
  for select to authenticated
  using (profile_id = public.current_profile_id());

-- events: 열람 = 활성 회원, 호스팅 = Lv3 (A5 §1.2), RSVP = Lv2 --------------------------
create policy events_select on public.events
  for select to authenticated
  using (public.is_active_member() or public.is_admin());

create policy events_insert_host on public.events
  for insert to authenticated
  with check (
    host_id = public.current_profile_id()
    and public.current_verify_level() >= 3
    and public.can_engage()
  );

create policy events_update_host on public.events
  for update to authenticated
  using (host_id = public.current_profile_id())
  with check (host_id = public.current_profile_id());

create policy events_delete_host on public.events
  for delete to authenticated
  using (host_id = public.current_profile_id());

create policy event_rsvps_select on public.event_rsvps
  for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or exists (select 1 from public.events e
               where e.id = event_id and e.host_id = public.current_profile_id())
  );

create policy event_rsvps_insert_own on public.event_rsvps
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and public.current_verify_level() >= 2
    and public.can_engage()
  );

create policy event_rsvps_delete_own on public.event_rsvps
  for delete to authenticated
  using (profile_id = public.current_profile_id());

-- analytics_events: 클라이언트 insert 허용(본인 명의), 읽기는 admin 만 ------------------
create policy analytics_insert_own on public.analytics_events
  for insert to authenticated
  with check (profile_id is null or profile_id = public.current_profile_id());

create policy analytics_select_admin on public.analytics_events
  for select to authenticated
  using (public.is_admin());

-- push_tokens ------------------------------------------------------------------------------
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- contact_messages: 회사 사이트 폼 — 비로그인 접수 허용, 열람은 service role 만 ---------
create policy contact_messages_insert on public.contact_messages
  for insert to anon, authenticated
  with check (true);

-- refund_requests: 본인 접수/조회 (Phase 3), 처리(update)는 service role ------------------
create policy refund_requests_select on public.refund_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy refund_requests_insert_own on public.refund_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. 본인 상태 조회 뷰 (A5: reports/sanctions 는 본인에게 status 만 노출)
--    security definer 뷰(소유자 권한) + auth.uid() 필터.
-- -----------------------------------------------------------------------------
create view public.my_reports
  with (security_invoker = off) as
select id, reason_code, status, created_at, handled_at
from public.reports
where reporter_id = public.current_profile_id();

create view public.my_sanctions
  with (security_invoker = off) as
select id, level, reason, status, appeal_status, starts_at, ends_at, created_at
from public.sanctions
where profile_id = public.current_profile_id();

revoke all on public.my_reports from anon;
revoke all on public.my_sanctions from anon;
grant select on public.my_reports to authenticated;
grant select on public.my_sanctions to authenticated;
