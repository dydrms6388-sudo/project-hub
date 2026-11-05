-- =============================================================================
-- 0040 — moderation core (D5)
--   · moderation_settings      운영 수치 상수(A5 §4.3·§7.3·§7.6, B1 §0-15). service role 전용. 코드 상수(constants.ts)와 1:1
--   · moderation_flags         프로필 위험 플래그(스캠 점수·배너·비노출) — 자동 조치 상태의 단일 소스
--   · moderation_notifications D7 통보 훅 큐(notify_admin / notify_user 가 insert, D7 이 delivered_at 갱신)
--   · moderation_jobs          파일 작업 큐(evidence 복사·파기·탈퇴 사진 삭제) — Edge Function moderation-evidence 가 처리
--   · 뷰: v_my_blocks(차단 목록 닉네임, 14_schema §7), reports_overdue(SLA 초과), v_rule_hit_stats(룰 hit 통계)
--   · 유저 RPC: acknowledge_sanction, submit_appeal, get_my_moderation_state, partner_risk_banner
-- 의존: 0001~0014 만. SECURITY DEFINER 는 search_path 고정, service 전용 함수는 public/anon/authenticated 회수(15_auth §0-28).
-- =============================================================================

-- ---------- moderation_settings ----------
create table public.moderation_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
comment on table public.moderation_settings is
  'D5 자동 제재·탐지 임계값. service role 전용(정책 없음). 값 변경 시 apps/web/lib/moderation/constants.ts 와 08_legal_docs §0-15 문서를 함께 갱신한다.';
alter table public.moderation_settings enable row level security;
create trigger trg_moderation_settings_updated_at before update on public.moderation_settings
  for each row execute function public.set_updated_at();

insert into public.moderation_settings (key, value, description) values
  ('cumulative_reporters_30d',   '3'::jsonb,   '서로 다른 신고자 N명/30일 → 자동 채팅 제한 24h + P1 (A5 §4.3, create_report 내장)'),
  ('cumulative_reporters_90d',   '5'::jsonb,   '서로 다른 신고자 N명/90일 → 판정 전 비노출 (create_report 내장)'),
  ('warnings_to_restrict',       '3'::jsonb,   '경고(level 1) 누적 N회/12개월 → 자동 채팅 제한 24h'),
  ('scam_window_days',           '7'::jsonb,   '로맨스 스캠 점수 롤링 창(일)'),
  ('scam_score_banner',          '5'::jsonb,   '점수 ≥ N → 상대 채팅 배너 + 자동 신고 P0'),
  ('scam_score_restrict',        '8'::jsonb,   '점수 ≥ N → 채팅 제한 24h + 프로필 비노출'),
  ('scam_signal_weights',        '{"SC_MONEY":3,"SC_INVEST":3,"SC_URGENT":2,"SC_OFFAPP":2,"SC_MASS_LIKE":2,"SC_FAST_LOVE":1,"SC_TEMPLATE":3}'::jsonb, 'rule_id → 점수 (A5 §7.3). message_flags.score 가 0 이면 이 표를 쓴다'),
  ('mass_like_24h',              '30'::jsonb,  '가입 24h 내 좋아요 N회 이상 → SC_MASS_LIKE'),
  ('offapp_ct_hits_24h',         '2'::jsonb,   '매칭 24h 내 CT_* hit N회 이상 → SC_OFFAPP'),
  ('contact_hits_auto_report',   '3'::jsonb,   '같은 매칭 CT_* hit N회 → OFF_PLATFORM_LURE 자동 신고 P2 (A5 §7.1)'),
  ('warn_only_rules',            '[]'::jsonb,  '오탐률 20% 초과로 강등된 rule_id 배열 — 점수·자동 조치에서 제외(A5 §7.6)'),
  ('auto_report_dedupe_hours',   '24'::jsonb,  '같은 대상·같은 사유 시스템 자동 신고 중복 방지 창(시간)'),
  ('appeal_window_days',         '7'::jsonb,   '이의신청 가능 기간(제재 시작 후 일)'),
  ('appeal_decision_hours',      '72'::jsonb,  '이의신청 처리 목표(시간)'),
  ('sla_renotify_minutes',       '{"P0":30,"P1":360,"P2":1440,"P3":10080}'::jsonb, 'SLA 초과 재알림 간격(분). A5 §6'),
  ('evidence_retention_days',    '{"dismissed":90,"confirmed":180,"permanent_ban":1825,"legal_hold_release":90}'::jsonb, '증거 보존(일). A5 §5.2'),
  ('delete_grace_days',          '7'::jsonb,   '탈퇴 유예(일). request_delete 이후 purge_deleted_profiles'),
  ('evidence_copy_max_attempts', '5'::jsonb,   'evidence 복사 재시도 상한(moderation_jobs)');

create or replace function public.moderation_setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.moderation_settings where key = p_key
$$;
create or replace function public.moderation_setting_int(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from public.moderation_settings where key = p_key)::integer, p_default)
$$;

-- ---------- moderation_flags (프로필 위험 상태) ----------
create table public.moderation_flags (
  profile_id            uuid primary key references public.profiles(id) on delete cascade,
  scam_score            integer not null default 0,
  scam_signals          jsonb not null default '[]'::jsonb,        -- [{rule_id, count, points}]
  scam_banner_until     timestamptz,                               -- 상대 채팅 상단 배너 노출 기한(점수 ≥ banner)
  scam_restricted_at    timestamptz,                               -- 점수 ≥ restrict 로 채팅 제한+비노출 적용 시각
  last_auto_report_at   timestamptz,
  contact_hits_reported jsonb not null default '{}'::jsonb,        -- {match_id: hit_count_at_report}
  computed_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.moderation_flags is 'apply_auto_moderation() 이 갱신하는 프로필 위험 상태. service role 전용. 클라이언트는 partner_risk_banner(match_id) 로만 읽는다.';
alter table public.moderation_flags enable row level security;
create trigger trg_moderation_flags_updated_at before update on public.moderation_flags
  for each row execute function public.set_updated_at();
create index moderation_flags_banner_idx on public.moderation_flags (scam_banner_until) where scam_banner_until is not null;

-- ---------- moderation_notifications (D7 통보 훅 큐) ----------
create table public.moderation_notifications (
  id            bigint generated always as identity primary key,
  audience      text not null check (audience in ('admin', 'user')),
  kind          text not null,                                     -- sla_overdue / report_resolved / sanction_issued / sanction_lifted / appeal_decided / evidence_copy_failed / purge_summary
  profile_id    uuid references public.profiles(id) on delete set null,   -- audience=user
  report_id     uuid references public.reports(id) on delete set null,
  sanction_id   uuid references public.sanctions(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,                -- 개인정보·신고자 정보 금지. 문구 키·기간·이의신청 경로만
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  delivery      jsonb                                              -- D7 이 채움 {channel, ok, error}
);
comment on table public.moderation_notifications is 'D5 → D7 통보 인터페이스. D7 배치가 delivered_at is null 행을 읽어 푸시/이메일/Slack 으로 전달 후 delivered_at·delivery 갱신. payload 에 신고자 신원·원문 금지.';
alter table public.moderation_notifications enable row level security;
create index moderation_notifications_pending_idx on public.moderation_notifications (audience, created_at) where delivered_at is null;

create or replace function public.notify_admin(p_kind text, p_payload jsonb default '{}'::jsonb, p_report_id uuid default null, p_sanction_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.moderation_notifications (audience, kind, report_id, sanction_id, payload)
  values ('admin', p_kind, p_report_id, p_sanction_id, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
comment on function public.notify_admin is 'D7 훅 stub(D5 소유). Slack/이메일 전달은 D7. 큐 행 id 반환.';

create or replace function public.notify_user(p_profile_id uuid, p_kind text, p_payload jsonb default '{}'::jsonb, p_report_id uuid default null, p_sanction_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_profile_id is null then return null; end if;
  insert into public.moderation_notifications (audience, kind, profile_id, report_id, sanction_id, payload)
  values ('user', p_kind, p_profile_id, p_report_id, p_sanction_id, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
comment on function public.notify_user is 'D7 훅 stub. 신고자 통보("조치가 완료되었어요")·피신고자 제재 통보(사유 카테고리·기간·이의신청 방법). 신고자 신원 금지.';

-- ---------- moderation_jobs (파일 작업 큐: SQL 이 못 하는 storage 작업) ----------
create table public.moderation_jobs (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('evidence_copy', 'evidence_purge', 'storage_delete')),
  report_id       uuid references public.reports(id) on delete cascade,
  payload         jsonb not null default '{}'::jsonb,              -- evidence_copy: {photos:[{photo_id,path,evidence_path}]} / evidence_purge: {prefix} / storage_delete: {bucket, paths}
  status          text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  result          jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.moderation_jobs is 'Edge Function moderation-evidence 가 처리(service role). 실패 시 지수 백오프 재시도, 상한 초과 시 failed + notify_admin.';
alter table public.moderation_jobs enable row level security;
create trigger trg_moderation_jobs_updated_at before update on public.moderation_jobs
  for each row execute function public.set_updated_at();
create index moderation_jobs_pending_idx on public.moderation_jobs (next_attempt_at) where status = 'pending';
create unique index moderation_jobs_one_copy_per_report on public.moderation_jobs (report_id) where kind = 'evidence_copy' and status = 'pending';

-- 작업 큐 API (Edge Function 이 service role 로 호출)
create or replace function public.claim_moderation_jobs(p_limit integer default 20)
returns setof public.moderation_jobs language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.moderation_jobs j
    set attempts = j.attempts + 1, next_attempt_at = now() + interval '10 minutes'   -- 처리 중 재클레임 방지(10분 리스)
    where j.id in (
      select id from public.moderation_jobs
      where status = 'pending' and next_attempt_at <= now()
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
    )
    returning j.*;
end $$;

create or replace function public.finish_moderation_job(p_job_id bigint, p_ok boolean, p_result jsonb default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.moderation_jobs%rowtype; v_max integer := public.moderation_setting_int('evidence_copy_max_attempts', 5);
begin
  select * into v_job from public.moderation_jobs where id = p_job_id for update;
  if not found then return; end if;
  if p_ok then
    update public.moderation_jobs set status = 'done', result = p_result, last_error = null where id = p_job_id;
    if v_job.kind = 'evidence_copy' then
      insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
      values ('service', 'evidence_copied', 'report', v_job.report_id::text, coalesce(p_result, '{}'::jsonb));
    elsif v_job.kind = 'evidence_purge' then
      insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
      values ('service', 'evidence_files_purged', 'report', v_job.report_id::text, coalesce(p_result, '{}'::jsonb));
    end if;
  elsif v_job.attempts >= v_max then
    update public.moderation_jobs set status = 'failed', last_error = left(p_error, 500) where id = p_job_id;
    perform public.notify_admin('moderation_job_failed', jsonb_build_object('job_id', p_job_id, 'kind', v_job.kind, 'error', left(p_error, 200)), v_job.report_id);
    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('service', 'moderation_job_failed', 'moderation_job', p_job_id::text, jsonb_build_object('kind', v_job.kind, 'report_id', v_job.report_id, 'error', left(p_error, 200)));
  else
    -- 지수 백오프: 1·2·4·8·16 분
    update public.moderation_jobs
    set last_error = left(p_error, 500), next_attempt_at = now() + (interval '1 minute' * power(2, v_job.attempts - 1))
    where id = p_job_id;
  end if;
end $$;

-- ---------- 뷰 ----------
-- 차단 목록(설정 > 차단 관리): v_profile_public 은 차단 관계를 숨기므로 닉네임만 노출하는 별도 뷰(14_schema §7)
create view public.v_my_blocks with (security_barrier = true) as
select b.blocked_id, p.nickname as blocked_nickname, p.verify_level as blocked_verify_level, b.created_at as blocked_at
from public.blocks b
join public.profiles p on p.id = b.blocked_id
where b.blocker_id = public.current_profile_id();
grant select on public.v_my_blocks to authenticated;
comment on view public.v_my_blocks is '내가 차단한 사람 목록(닉네임·차단일). TanStack 키 [''blocks''].';

-- SLA 초과 큐(어드민 배너·moderation-sla-check). 모더레이터 JWT 도 읽을 수 있게 reports 정책과 동일 컬럼만
create view public.reports_overdue with (security_barrier = true) as
select r.id, r.priority, r.reason_code, r.status, r.target_id, r.handled_by, r.created_at, r.due_at,
       extract(epoch from (now() - r.due_at))::integer as overdue_sec
from public.reports r
where r.due_at < now() and r.status in ('queued', 'in_review', 'need_info')
  and (auth.role() = 'service_role' or public.is_moderator());
grant select on public.reports_overdue to authenticated;

-- 룰 hit 통계(일별 rule_id 카운트, A5 §7.6 오탐 강등 판단용). moderator 이상
create view public.v_rule_hit_stats with (security_barrier = true) as
select public.loop_date(f.created_at) as loop_date, f.rule_id, count(*)::integer as hits,
       count(distinct m.sender_id)::integer as senders
from public.message_flags f
join public.messages m on m.id = f.message_id
where public.is_moderator() or auth.role() = 'service_role'
group by 1, 2;
grant select on public.v_rule_hit_stats to authenticated;

-- ---------- 유저 RPC ----------
-- 경고(level 1) 모달 확인 → acknowledged_at (E 화면: 다음 진입 1회)
create or replace function public.acknowledge_sanction(p_sanction_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id(); v_s public.sanctions%rowtype;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_s from public.sanctions where id = p_sanction_id and profile_id = v_me for update;
  if not found then raise exception 'NOT_FOUND: sanction' using errcode = 'no_data_found'; end if;
  if v_s.acknowledged_at is null then
    update public.sanctions set acknowledged_at = now() where id = p_sanction_id;
  end if;
  return jsonb_build_object('sanction_id', p_sanction_id, 'acknowledged_at', coalesce(v_s.acknowledged_at, now()));
end $$;

-- 이의신청: level ≥3 · 제재 시작 후 7일 이내 · 제재당 1회 · 미성년 확정 제외 (RLS 정책과 같은 규칙, 에러 코드가 명확)
create or replace function public.submit_appeal(p_sanction_id uuid, p_body text, p_attachment_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_profile_id();
  v_s public.sanctions%rowtype;
  v_id uuid;
  v_window integer := public.moderation_setting_int('appeal_window_days', 7);
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_body is null then raise exception 'INVALID_INPUT: body' using errcode = 'check_violation'; end if;
  if char_length(v_body) > 1000 then raise exception 'INVALID_INPUT: body_too_long' using errcode = 'check_violation'; end if;
  select * into v_s from public.sanctions where id = p_sanction_id and profile_id = v_me;
  if not found then raise exception 'NOT_FOUND: sanction' using errcode = 'no_data_found'; end if;
  if v_s.level < 3 then raise exception 'NOT_ENTITLED: appeal_only_for_suspension' using errcode = '42501'; end if;
  if v_s.revoked_at is not null then raise exception 'ALREADY_ACTED: sanction_revoked' using errcode = '42501'; end if;
  if v_s.reason like 'AUTO:MINOR_CONFIRMED%' then raise exception 'NOT_ENTITLED: minor_confirmed' using errcode = '42501'; end if;
  if v_s.starts_at <= now() - make_interval(days => v_window) then
    raise exception 'NOT_ENTITLED: appeal_window_closed' using errcode = '42501';
  end if;
  if exists (select 1 from public.appeals where sanction_id = p_sanction_id) then
    raise exception 'ALREADY_ACTED: appeal_exists' using errcode = '42501';
  end if;
  insert into public.appeals (sanction_id, profile_id, body, attachment_path)
  values (p_sanction_id, v_me, v_body, p_attachment_path)
  returning id into v_id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
  values (auth.uid(), 'user', 'appeal_submitted', 'sanction', p_sanction_id::text, jsonb_build_object('appeal_id', v_id));
  perform public.notify_admin('appeal_submitted', jsonb_build_object('appeal_id', v_id, 'level', v_s.level, 'due_hours', public.moderation_setting_int('appeal_decision_hours', 72)), v_s.report_id, p_sanction_id);
  return jsonb_build_object('appeal_id', v_id, 'status', 'pending', 'decision_due_at', now() + make_interval(hours => public.moderation_setting_int('appeal_decision_hours', 72)));
end $$;

-- 제재 화면 4종·이의신청 버튼 판정에 필요한 값 1회 조회
create or replace function public.get_my_moderation_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.current_profile_id();
  v_window integer := public.moderation_setting_int('appeal_window_days', 7);
  v_active jsonb; v_top public.sanctions%rowtype; v_appeal jsonb; v_pending_warning jsonb;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'level', s.level, 'reason_code', s.reason_code, 'is_auto', s.reason like 'AUTO:%',
           'starts_at', s.starts_at, 'ends_at', s.ends_at, 'acknowledged_at', s.acknowledged_at,
           'appeal_deadline', s.starts_at + make_interval(days => v_window),
           'can_appeal', s.level >= 3 and s.reason not like 'AUTO:MINOR_CONFIRMED%'
                         and s.starts_at > now() - make_interval(days => v_window)
                         and not exists (select 1 from public.appeals a where a.sanction_id = s.id)
         ) order by s.level desc, s.starts_at desc), '[]'::jsonb)
  into v_active
  from public.sanctions s
  where s.profile_id = v_me and s.revoked_at is null and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now());

  select * into v_top from public.sanctions s
  where s.profile_id = v_me and s.revoked_at is null and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
  order by s.level desc, s.starts_at desc limit 1;

  -- 경고(level 1)는 ends_at = starts_at 이라 "활성" 조건에 안 걸린다 → 미확인 경고는 별도로
  select jsonb_build_object('id', s.id, 'reason_code', s.reason_code, 'starts_at', s.starts_at)
  into v_pending_warning
  from public.sanctions s
  where s.profile_id = v_me and s.level = 1 and s.revoked_at is null and s.acknowledged_at is null
  order by s.starts_at desc limit 1;

  select jsonb_build_object('id', a.id, 'sanction_id', a.sanction_id, 'status', a.status, 'created_at', a.created_at,
                            'decided_at', a.decided_at, 'decision_note', a.decision_note,
                            'decision_due_at', a.created_at + make_interval(hours => public.moderation_setting_int('appeal_decision_hours', 72)))
  into v_appeal
  from public.appeals a
  where a.profile_id = v_me
  order by a.created_at desc limit 1;

  return jsonb_build_object(
    'profile_id', v_me,
    'active_level', coalesce(v_top.level, 0),
    'active', v_active,
    'top', case when v_top.id is null then null else jsonb_build_object(
      'id', v_top.id, 'level', v_top.level, 'reason_code', v_top.reason_code, 'starts_at', v_top.starts_at, 'ends_at', v_top.ends_at,
      'is_auto', v_top.reason like 'AUTO:%') end,
    'pending_warning', v_pending_warning,
    'appeal', v_appeal,
    'status', (select status from public.profiles where id = v_me),
    'appeal_window_days', v_window
  );
end $$;

-- 채팅방 상대의 스캠 배너 여부 (E3: 대화방 상단 배너, A5 §10.3). 점수·시그널은 노출하지 않는다.
create or replace function public.partner_risk_banner(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.moderation_flags f on f.profile_id = case when m.a_id = public.current_profile_id() then m.b_id else m.a_id end
    where m.id = p_match_id and public.current_profile_id() in (m.a_id, m.b_id)
      and f.scam_banner_until is not null and f.scam_banner_until > now()
  )
$$;

-- ---------- 권한 ----------
-- 새 테이블은 Supabase default privileges 로 anon/authenticated 에 자동 grant 되므로 명시 회수(0010 과 동일 원칙). RLS 정책 없음 = service role 전용.
revoke all on table public.moderation_settings, public.moderation_flags, public.moderation_notifications, public.moderation_jobs from public, anon, authenticated;
revoke all on sequence public.moderation_notifications_id_seq, public.moderation_jobs_id_seq from public, anon, authenticated;

revoke execute on function
  public.moderation_setting(text), public.moderation_setting_int(text, integer),
  public.notify_admin(text, jsonb, uuid, uuid), public.notify_user(uuid, text, jsonb, uuid, uuid),
  public.claim_moderation_jobs(integer), public.finish_moderation_job(bigint, boolean, jsonb, text),
  public.acknowledge_sanction(uuid), public.submit_appeal(uuid, text, text),
  public.get_my_moderation_state(), public.partner_risk_banner(uuid)
from public, anon, authenticated;

grant execute on function
  public.acknowledge_sanction(uuid), public.submit_appeal(uuid, text, text),
  public.get_my_moderation_state(), public.partner_risk_banner(uuid)
to authenticated, service_role;

grant execute on function
  public.moderation_setting(text), public.moderation_setting_int(text, integer),
  public.notify_admin(text, jsonb, uuid, uuid), public.notify_user(uuid, text, jsonb, uuid, uuid),
  public.claim_moderation_jobs(integer), public.finish_moderation_job(bigint, boolean, jsonb, text)
to service_role;
