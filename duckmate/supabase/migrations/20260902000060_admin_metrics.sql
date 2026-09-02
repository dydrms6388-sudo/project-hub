-- =============================================================================
-- 0060 — admin metrics (D8)
--   어드민 지표 화면(/admin/metrics) 전용 읽기 함수. 테이블/컬럼 변경 없음(0001~0014 에만 의존).
--   · 모든 함수는 SECURITY DEFINER + search_path 고정 + admin_metrics_guard()
--     (service_role 또는 is_moderator() 만 통과, 아니면 42501 FORBIDDEN).
--   · 일 경계는 loop_date()(KST 07:00). 리텐션·DAU 이력은 analytics_events(app_opened) 기준,
--     "현재" DAU/WAU/MAU 는 profiles.last_active_at 기준(06_PRD §6 / 03_core_loop §8).
--   · 개인정보 반환 없음(집계만). 닉네임·해시·원문 미포함.
-- =============================================================================

-- ---------- 공통 가드 ----------
create or replace function public.admin_metrics_guard()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return; end if;
  -- is_moderator() 는 role 이 null 이면 null 을 돌려주므로 coalesce 로 fail-closed
  if not coalesce(public.is_moderator(), false) then
    raise exception 'FORBIDDEN: admin metrics require moderator/admin' using errcode = '42501';
  end if;
end $$;
comment on function public.admin_metrics_guard is 'D8 지표 함수 공용 권한 가드. service_role 또는 app_role() ∈ {admin, moderator}.';

-- ---------- 큐 요약 (사이드바 배지 · 상단 배너) ----------
create or replace function public.admin_queue_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.admin_metrics_guard();
  select jsonb_build_object(
    'as_of', now(),
    'reports_open',        (select count(*) from public.reports where status in ('queued','in_review','need_info')),
    'reports_queued',      (select count(*) from public.reports where status = 'queued'),
    'reports_overdue',     (select count(*) from public.reports where status in ('queued','in_review','need_info') and due_at < now()),
    -- A5 §6: 24h 경과 미처리 P0~P2 → 상단 배너
    'reports_overdue_p0_p2', (select count(*) from public.reports
                               where status in ('queued','in_review','need_info') and due_at < now() and priority in ('P0','P1','P2')),
    'reports_p0_open',     (select count(*) from public.reports where status in ('queued','in_review','need_info') and priority = 'P0'),
    'photos_pending',      (select count(*) from public.photos where review_status = 'pending'),
    'photos_held',         (select count(*) from public.photos where review_status = 'held'),
    'photos_oldest_pending_at', (select min(created_at) from public.photos where review_status in ('pending','held')),
    'appeals_pending',     (select count(*) from public.appeals where status = 'pending'),
    'inquiries_open',      (select count(*) from public.inquiries where status = 'open')
  ) into v;
  return v;
end $$;

-- ---------- 활성 사용자 스냅샷 (last_active_at) ----------
create or replace function public.admin_metrics_active_users()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.admin_metrics_guard();
  select jsonb_build_object(
    'as_of', now(),
    'dau', (select count(*) from public.profiles where status = 'active' and last_active_at >= now() - interval '1 day'),
    'wau', (select count(*) from public.profiles where status = 'active' and last_active_at >= now() - interval '7 days'),
    'mau', (select count(*) from public.profiles where status = 'active' and last_active_at >= now() - interval '30 days'),
    'total_active', (select count(*) from public.profiles where status = 'active'),
    'total_l2_plus', (select count(*) from public.profiles where status = 'active' and verify_level >= 2)
  ) into v;
  return v;
end $$;

-- ---------- 일별 시계열 (기간 p_days, loop_date 기준) ----------
-- active_users: analytics_events(app_opened) distinct user_id_hash — E5 track() 이 붙기 전에는 0.
-- signups: profiles.created_at / reco: daily_recommendations / likes·matches·reports·sanctions: created_at.
-- first_messages: 그 날 매칭된 건 중 first_message_at 이 채워진 수(매칭→첫 메시지율 분자).
create or replace function public.admin_metrics_daily(p_days integer default 30)
returns table (
  loop_date date,
  active_users integer,
  signups integer,
  onboarding_completed integer,
  reco_count integer,
  reco_seen integer,
  reco_acted integer,
  likes integer,
  superlikes integer,
  matches integer,
  first_messages integer,
  messages integer,
  reports integer,
  sanctions integer,
  sanctions_auto integer
) language plpgsql stable security definer set search_path = public as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 90);
        v_from date := public.loop_date(now()) - (v_days - 1);
begin
  perform public.admin_metrics_guard();
  return query
  with days as (
    select d::date as ld from generate_series(v_from, public.loop_date(now()), interval '1 day') d
  ),
  ev as (
    select e.loop_date as ld, count(distinct e.user_id_hash)::integer as n
    from public.analytics_events e
    where e.name = 'app_opened' and e.loop_date >= v_from and e.user_id_hash is not null
    group by e.loop_date
  ),
  su as (
    select public.loop_date(p.created_at) as ld, count(*)::integer as n
    from public.profiles p where p.created_at >= v_from - 1 group by 1
  ),
  oc as (
    select public.loop_date(p.onboarding_completed_at) as ld, count(*)::integer as n
    from public.profiles p where p.onboarding_completed_at >= v_from - 1 group by 1
  ),
  rc as (
    select r.loop_date as ld,
           count(*)::integer as n,
           count(*) filter (where r.seen_at is not null)::integer as seen,
           count(*) filter (where r.acted_at is not null)::integer as acted
    from public.daily_recommendations r where r.loop_date >= v_from group by r.loop_date
  ),
  lk as (
    select public.loop_date(l.created_at) as ld,
           count(*)::integer as n,
           count(*) filter (where l.type = 'super')::integer as super
    from public.likes l where l.created_at >= v_from - 1 group by 1
  ),
  mt as (
    select public.loop_date(m.matched_at) as ld,
           count(*)::integer as n,
           count(*) filter (where m.first_message_at is not null)::integer as first_msg
    from public.matches m where m.matched_at >= v_from - 1 group by 1
  ),
  ms as (
    select public.loop_date(x.created_at) as ld, count(*)::integer as n
    from public.messages x where x.created_at >= v_from - 1 group by 1
  ),
  rp as (
    select public.loop_date(r.created_at) as ld, count(*)::integer as n
    from public.reports r where r.created_at >= v_from - 1 group by 1
  ),
  sc as (
    select public.loop_date(s.created_at) as ld,
           count(*)::integer as n,
           count(*) filter (where s.reason like 'AUTO:%')::integer as auto_n
    from public.sanctions s where s.created_at >= v_from - 1 group by 1
  )
  select days.ld,
         coalesce(ev.n, 0), coalesce(su.n, 0), coalesce(oc.n, 0),
         coalesce(rc.n, 0), coalesce(rc.seen, 0), coalesce(rc.acted, 0),
         coalesce(lk.n, 0), coalesce(lk.super, 0),
         coalesce(mt.n, 0), coalesce(mt.first_msg, 0), coalesce(ms.n, 0),
         coalesce(rp.n, 0), coalesce(sc.n, 0), coalesce(sc.auto_n, 0)
  from days
  left join ev on ev.ld = days.ld
  left join su on su.ld = days.ld
  left join oc on oc.ld = days.ld
  left join rc on rc.ld = days.ld
  left join lk on lk.ld = days.ld
  left join mt on mt.ld = days.ld
  left join ms on ms.ld = days.ld
  left join rp on rp.ld = days.ld
  left join sc on sc.ld = days.ld
  order by days.ld;
end $$;

-- ---------- 온보딩 퍼널 (기간 내 가입자 코호트) ----------
-- onboarding_step 은 "다음에 보여줄 화면"(D2 §0-9) → step >= 'hobbies' 이면 basic 완료.
create or replace function public.admin_metrics_funnel(p_days integer default 30)
returns table (ord integer, step text, label text, cnt integer)
language plpgsql stable security definer set search_path = public as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
        v_from timestamptz := (public.loop_date(now()) - (v_days - 1))::timestamptz - interval '9 hours' + interval '7 hours';
begin
  perform public.admin_metrics_guard();
  return query
  with c as (
    select p.* from public.profiles p where p.created_at >= v_from and p.status <> 'age_blocked'
  )
  select * from (values
    (1, 'signup',    '가입(OTP)',            (select count(*)::integer from c)),
    (2, 'basic',     '기본정보 완료',        (select count(*)::integer from c where c.onboarding_step >= 'hobbies')),
    (3, 'hobbies',   '취미 완료',            (select count(*)::integer from c where c.onboarding_step >= 'quiz')),
    (4, 'quiz',      '퀴즈 완료',            (select count(*)::integer from c where c.onboarding_step >= 'card')),
    (5, 'card',      '덕질 카드 완료',       (select count(*)::integer from c where c.onboarding_step >= 'photos')),
    (6, 'photos',    '사진 완료(온보딩 완료)', (select count(*)::integer from c where c.onboarding_step >= 'verify')),
    (7, 'verified',  '본인인증(L2)',         (select count(*)::integer from c where c.verify_level >= 2)),
    (8, 'photo_l3',  '사진인증(L3)',         (select count(*)::integer from c where c.verify_level >= 3))
  ) as t(ord, step, label, cnt)
  order by 1;
end $$;

-- ---------- 인증 레벨 분포 (전체, age_blocked 제외) ----------
create or replace function public.admin_metrics_verify_levels()
returns table (verify_level smallint, cnt integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_metrics_guard();
  return query
  select lv::smallint, coalesce(x.n, 0)::integer
  from generate_series(0, 3) lv
  left join (
    select p.verify_level as l, count(*) as n from public.profiles p
    where p.status <> 'age_blocked' group by p.verify_level
  ) x on x.l = lv
  order by lv;
end $$;

-- ---------- 성비 (모드별, active·L2+) — KPI: 데이팅 모드 여성 ≥ 35% ----------
create or replace function public.admin_metrics_gender()
returns table (mode public.profile_mode, gender text, cnt integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_metrics_guard();
  return query
  select p.mode, coalesce(p.gender::text, 'unspecified'), count(*)::integer
  from public.profiles p
  where p.status = 'active' and p.verify_level >= 2
  group by p.mode, coalesce(p.gender::text, 'unspecified')
  order by 1, 2;
end $$;

-- ---------- 신고 SLA (기간 내 접수 건) ----------
-- within_sla: handled_at <= due_at (종결 기준). 미종결·초과 = overdue_open. 준수율 = within_sla / (handled + overdue_open).
create or replace function public.admin_metrics_sla(p_days integer default 30)
returns table (
  priority public.report_priority,
  total integer,
  handled integer,
  within_sla integer,
  overdue_open integer,
  open_in_sla integer,
  avg_handle_minutes numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
        v_from timestamptz := now() - make_interval(days => v_days);
begin
  perform public.admin_metrics_guard();
  return query
  select pr.p,
         count(r.id)::integer,
         count(r.id) filter (where r.handled_at is not null)::integer,
         count(r.id) filter (where r.handled_at is not null and r.handled_at <= r.due_at)::integer,
         count(r.id) filter (where r.handled_at is null and r.due_at < now())::integer,
         count(r.id) filter (where r.handled_at is null and r.due_at >= now())::integer,
         round(avg(extract(epoch from (r.handled_at - r.created_at)) / 60.0) filter (where r.handled_at is not null), 1)
  from unnest(enum_range(null::public.report_priority)) as pr(p)
  left join public.reports r on r.priority = pr.p and r.created_at >= v_from
  group by pr.p
  order by pr.p;
end $$;

-- ---------- 제재 건수 (기간, 레벨별 자동/수동) ----------
create or replace function public.admin_metrics_sanctions(p_days integer default 30)
returns table (level smallint, total integer, auto_cnt integer, manual_cnt integer, revoked_cnt integer)
language plpgsql stable security definer set search_path = public as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
        v_from timestamptz := now() - make_interval(days => v_days);
begin
  perform public.admin_metrics_guard();
  return query
  select lv::smallint,
         count(s.id)::integer,
         count(s.id) filter (where s.reason like 'AUTO:%')::integer,
         count(s.id) filter (where s.reason not like 'AUTO:%')::integer,
         count(s.id) filter (where s.revoked_at is not null)::integer
  from generate_series(1, 6) lv
  left join public.sanctions s on s.level = lv and s.created_at >= v_from
  group by lv
  order by lv;
end $$;

-- ---------- 사진 검수 (기간) — KPI: 24h 내 처리율 ≥ 95% ----------
create or replace function public.admin_metrics_photos(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
        v_from timestamptz := now() - make_interval(days => v_days);
        v jsonb;
begin
  perform public.admin_metrics_guard();
  select jsonb_build_object(
    'pending',      (select count(*) from public.photos where review_status = 'pending'),
    'held',         (select count(*) from public.photos where review_status = 'held'),
    'uploaded',     (select count(*) from public.photos where created_at >= v_from),
    'reviewed',     (select count(*) from public.photos where reviewed_at is not null and reviewed_at >= v_from),
    'approved',     (select count(*) from public.photos where reviewed_at >= v_from and review_status = 'approved'),
    'rejected',     (select count(*) from public.photos where reviewed_at >= v_from and review_status = 'rejected'),
    'within_24h',   (select count(*) from public.photos where reviewed_at is not null and reviewed_at >= v_from and reviewed_at - created_at <= interval '24 hours'),
    'pending_over_24h', (select count(*) from public.photos where review_status in ('pending','held') and created_at < now() - interval '24 hours'),
    'reject_codes', (select coalesce(jsonb_object_agg(rc, n), '{}'::jsonb) from (
                       select reject_code::text as rc, count(*) as n from public.photos
                       where reviewed_at >= v_from and review_status = 'rejected' group by reject_code) x)
  ) into v;
  return v;
end $$;

-- ---------- 권한 ----------
-- Supabase default privileges 가 authenticated 에 execute 를 주므로 명시 회수 후 필요한 롤에만 부여(D2 §0-28).
revoke execute on function
  public.admin_metrics_guard(),
  public.admin_queue_summary(),
  public.admin_metrics_active_users(),
  public.admin_metrics_daily(integer),
  public.admin_metrics_funnel(integer),
  public.admin_metrics_verify_levels(),
  public.admin_metrics_gender(),
  public.admin_metrics_sla(integer),
  public.admin_metrics_sanctions(integer),
  public.admin_metrics_photos(integer)
from public, anon;

-- authenticated 는 함수 내부 가드(is_moderator)로 2차 차단. 실제 호출 경로는 service role(apps/web/lib/admin).
grant execute on function
  public.admin_metrics_guard(),
  public.admin_queue_summary(),
  public.admin_metrics_active_users(),
  public.admin_metrics_daily(integer),
  public.admin_metrics_funnel(integer),
  public.admin_metrics_verify_levels(),
  public.admin_metrics_gender(),
  public.admin_metrics_sla(integer),
  public.admin_metrics_sanctions(integer),
  public.admin_metrics_photos(integer)
to authenticated, service_role;
