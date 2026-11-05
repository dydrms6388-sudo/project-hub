-- =============================================================================
-- 0041 — auto moderation (D5)
--   · run_report_as_service()  D1 create_report 를 "시스템 신고"로 호출하는 내부 헬퍼(트리거는 사용자 세션 안에서 돌기 때문)
--   · compute_scam_score()     로맨스 스캠 점수 7일 롤링 (A5 §7.3)
--   · apply_auto_moderation()  임계 초과 시 배너·P0 자동 신고·채팅 제한·비노출 (level 2 상한)
--   · message_flags AFTER INSERT 트리거 → SC_*/CT_*/BW_VIOLENCE/BW_ILLEGAL 자동 조치 (D4 는 flag insert 만 하면 된다)
--   · sanctions AFTER INSERT 트리거 → 경고 3회/12개월 → 자동 채팅 제한 (A5 §4.3)
--   · reports AFTER INSERT 트리거 → evidence_copy 작업 큐 / legal_hold 해제 시 만료 +90일
--   · sla_check()              SLA 초과 감시(15분 cron, moderation-sla-check)
-- 누적 신고 3명/30일 자동 채팅 제한은 0009 create_report 에 이미 있으므로 재사용(중복 구현 없음).
-- =============================================================================

-- ---------- 내부 헬퍼: 시스템 자동 신고 ----------
-- create_report 는 auth.role()='service_role' 일 때만 reporter null(surface=system) 을 허용한다.
-- 트리거는 사용자 JWT 안에서 실행되므로, 호출 구간에만 request.jwt.* GUC 를 service_role 로 바꿨다가 복원한다(트랜잭션 로컬).
create or replace function public.run_report_as_service(
  p_target_id uuid, p_reason public.report_reason, p_detail text, p_match_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text := current_setting('request.jwt.claim.role', true);
  v_sub    text := current_setting('request.jwt.claim.sub', true);
  v_res    jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    v_res := public.create_report(p_target_id, p_reason, p_detail, p_match_id, 'system', null);
  exception when others then
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(v_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_res;
end $$;
comment on function public.run_report_as_service is 'D5 내부 전용. 시스템 자동 신고(reporter null, surface=system). 호출 구간만 JWT GUC 를 service_role 로 치환.';

-- 같은 대상·같은 사유의 시스템 신고가 최근 N시간 내 미종결로 있으면 true (자동 신고 중복 방지)
create or replace function public.system_report_exists(p_target_id uuid, p_reason public.report_reason, p_hours integer default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reports r
    where r.target_id = p_target_id and r.reason_code = p_reason and r.surface = 'system'
      and r.created_at > now() - make_interval(hours => coalesce(p_hours, public.moderation_setting_int('auto_report_dedupe_hours', 24)))
      and r.status not in ('confirmed', 'dismissed')
  )
$$;

-- ---------- 로맨스 스캠 점수 ----------
-- 입력: message_flags(SC_*) 가중 합 + 파생 시그널(SC_MASS_LIKE: 가입 24h 내 좋아요 N+, SC_OFFAPP: 매칭 24h 내 CT_* N+) — 7일 롤링
-- warn_only_rules 에 있는 rule_id 는 제외. 반환 {score, window_days, signals:[{rule_id,count,points}]}
create or replace function public.compute_scam_score(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days     integer := public.moderation_setting_int('scam_window_days', 7);
  v_weights  jsonb   := coalesce(public.moderation_setting('scam_signal_weights'), '{}'::jsonb);
  v_warnonly jsonb   := coalesce(public.moderation_setting('warn_only_rules'), '[]'::jsonb);
  v_since    timestamptz := now() - make_interval(days => v_days);
  v_signals  jsonb := '[]'::jsonb;
  v_score    integer := 0;
  v_created  timestamptz;
  v_mass     integer;
  v_offapp   integer;
  r record;
begin
  -- 1) 메시지 플래그 (SC_*): 메시지당 rule 1회, score>0 이면 그 값, 아니면 가중치표
  for r in
    select f.rule_id, count(distinct f.message_id)::integer as cnt,
           sum(case when f.score > 0 then f.score else coalesce((v_weights ->> f.rule_id)::integer, 0) end)::integer as pts
    from public.message_flags f
    join public.messages m on m.id = f.message_id
    where m.sender_id = p_profile_id and f.rule_id like 'SC\_%' escape '\'
      and f.created_at > v_since
      and not (v_warnonly ? f.rule_id)
    group by f.rule_id
  loop
    v_signals := v_signals || jsonb_build_object('rule_id', r.rule_id, 'count', r.cnt, 'points', r.pts);
    v_score := v_score + r.pts;
  end loop;

  -- 2) SC_MASS_LIKE: 가입 24h 내 좋아요 N회 이상 (D4 가 flag 로 넣지 않았을 때 파생)
  if not (v_warnonly ? 'SC_MASS_LIKE') and not exists (select 1 from jsonb_array_elements(v_signals) e where e ->> 'rule_id' = 'SC_MASS_LIKE') then
    select created_at into v_created from public.profiles where id = p_profile_id;
    if v_created is not null and v_created > v_since then
      select count(*)::integer into v_mass from public.likes
      where from_id = p_profile_id and created_at < v_created + interval '24 hours';
      if v_mass >= public.moderation_setting_int('mass_like_24h', 30) then
        v_signals := v_signals || jsonb_build_object('rule_id', 'SC_MASS_LIKE', 'count', v_mass, 'points', coalesce((v_weights ->> 'SC_MASS_LIKE')::integer, 2));
        v_score := v_score + coalesce((v_weights ->> 'SC_MASS_LIKE')::integer, 2);
      end if;
    end if;
  end if;

  -- 3) SC_OFFAPP: 매칭 24h 내 CT_* hit N회 이상인 매칭 수(매칭당 1회)
  if not (v_warnonly ? 'SC_OFFAPP') and not exists (select 1 from jsonb_array_elements(v_signals) e where e ->> 'rule_id' = 'SC_OFFAPP') then
    select count(*)::integer into v_offapp from (
      select m.match_id
      from public.message_flags f
      join public.messages m on m.id = f.message_id
      join public.matches mt on mt.id = m.match_id
      where m.sender_id = p_profile_id and f.rule_id like 'CT\_%' escape '\'
        and f.created_at > v_since and m.created_at < mt.matched_at + interval '24 hours'
      group by m.match_id
      having count(distinct f.message_id) >= public.moderation_setting_int('offapp_ct_hits_24h', 2)
    ) x;
    if v_offapp > 0 then
      v_signals := v_signals || jsonb_build_object('rule_id', 'SC_OFFAPP', 'count', v_offapp, 'points', coalesce((v_weights ->> 'SC_OFFAPP')::integer, 2) * v_offapp);
      v_score := v_score + coalesce((v_weights ->> 'SC_OFFAPP')::integer, 2) * v_offapp;
    end if;
  end if;

  return jsonb_build_object('profile_id', p_profile_id, 'score', v_score, 'window_days', v_days, 'signals', v_signals, 'computed_at', now());
end $$;
comment on function public.compute_scam_score is '로맨스 스캠 점수(7일 롤링). TS 미러 apps/web/lib/moderation/scam-score.ts 와 가중치·규칙 동일.';

-- ---------- 자동 조치 (level 2 상한) ----------
-- ≥ banner(5): moderation_flags.scam_banner_until = now()+window, ROMANCE_SCAM 시스템 신고 P0(24h 중복 방지)
--              → create_report(ROMANCE_SCAM) 의 내장 규칙이 채팅 제한 24h 도 적용한다(A5 §3 표: ROMANCE_SCAM 즉시 채팅 제한)
-- ≥ restrict(8): 추가로 profiles.hidden_at(hidden_reason='SCAM_SCORE') + (없으면) level 2 'AUTO:SCAM_SCORE'
-- 사람 판정에서 dismissed 되면 admin_resolve_report 가 hidden/AUTO 제재를 해제한다.
create or replace function public.apply_auto_moderation(p_profile_id uuid, p_match_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_calc     jsonb;
  v_score    integer;
  v_banner   integer := public.moderation_setting_int('scam_score_banner', 5);
  v_restrict integer := public.moderation_setting_int('scam_score_restrict', 8);
  v_days     integer := public.moderation_setting_int('scam_window_days', 7);
  v_actions  jsonb := '[]'::jsonb;
  v_report   jsonb;
  v_flag     public.moderation_flags%rowtype;
  v_status   public.profile_status;
begin
  if p_profile_id is null then return null; end if;
  select status into v_status from public.profiles where id = p_profile_id;
  if v_status is null then return null; end if;

  v_calc := public.compute_scam_score(p_profile_id);
  v_score := (v_calc ->> 'score')::integer;

  insert into public.moderation_flags as mf (profile_id, scam_score, scam_signals, computed_at)
  values (p_profile_id, v_score, v_calc -> 'signals', now())
  on conflict (profile_id) do update set scam_score = excluded.scam_score, scam_signals = excluded.scam_signals, computed_at = now()
  returning * into v_flag;

  if v_score >= v_banner then
    update public.moderation_flags set scam_banner_until = now() + make_interval(days => v_days) where profile_id = p_profile_id;
    v_actions := v_actions || to_jsonb('scam_banner'::text);

    if not public.system_report_exists(p_profile_id, 'ROMANCE_SCAM') then
      v_report := public.run_report_as_service(
        p_profile_id, 'ROMANCE_SCAM',
        'AUTO:SCAM_SCORE score=' || v_score || ' signals=' || (v_calc -> 'signals')::text,
        p_match_id);
      update public.moderation_flags set last_auto_report_at = now() where profile_id = p_profile_id;
      v_actions := v_actions || to_jsonb('auto_report_p0'::text);
    end if;
  end if;

  if v_score >= v_restrict then
    if public.active_sanction_level(p_profile_id) < 2 then
      perform public.issue_sanction(p_profile_id, 2, 'AUTO:SCAM_SCORE', interval '24 hours', (v_report ->> 'report_id')::uuid, 'ROMANCE_SCAM', null);
      v_actions := v_actions || to_jsonb('chat_restricted_24h'::text);
    end if;
    update public.profiles set hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'SCAM_SCORE')
    where id = p_profile_id and hidden_at is null;
    update public.moderation_flags set scam_restricted_at = coalesce(scam_restricted_at, now()) where profile_id = p_profile_id;
    v_actions := v_actions || to_jsonb('profile_hidden'::text);
  end if;

  if jsonb_array_length(v_actions) > 0 then
    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('system', 'auto_moderation_applied', 'profile', p_profile_id::text,
            jsonb_build_object('score', v_score, 'actions', v_actions, 'report_id', v_report ->> 'report_id'));
  end if;

  return jsonb_build_object('profile_id', p_profile_id, 'score', v_score, 'signals', v_calc -> 'signals', 'actions', v_actions, 'report', v_report);
end $$;
comment on function public.apply_auto_moderation is
  'service 전용 + message_flags 트리거가 호출. 점수 ≥5 배너+P0 신고, ≥8 채팅 제한 24h+비노출. level 2 상한(A5 §4.4). 반환 {score, signals, actions, report}.';

-- ---------- message_flags AFTER INSERT → 자동 조치 ----------
-- 예외는 삼킨다(메시지 insert 가 모더레이션 오류로 실패하면 안 됨) + audit_logs 기록.
create or replace function public.trg_message_flags_auto_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_msg     public.messages%rowtype;
  v_hits    integer;
  v_thresh  integer;
  v_flag    public.moderation_flags%rowtype;
  v_reason  public.report_reason;
  v_warnonly jsonb := coalesce(public.moderation_setting('warn_only_rules'), '[]'::jsonb);
begin
  if v_warnonly ? new.rule_id then return null; end if;
  select * into v_msg from public.messages where id = new.message_id;
  if not found then return null; end if;

  begin
    if new.rule_id like 'SC\_%' escape '\' then
      perform public.apply_auto_moderation(v_msg.sender_id, v_msg.match_id);

    elsif new.rule_id like 'CT\_%' escape '\' then
      -- 같은 매칭 CT_* N회 → OFF_PLATFORM_LURE 자동 신고 P2 (한 매칭당 1회), 그리고 스캠 점수 재계산(SC_OFFAPP 파생)
      v_thresh := public.moderation_setting_int('contact_hits_auto_report', 3);
      select count(distinct f.message_id)::integer into v_hits
      from public.message_flags f join public.messages m on m.id = f.message_id
      where m.match_id = v_msg.match_id and m.sender_id = v_msg.sender_id and f.rule_id like 'CT\_%' escape '\';
      if v_hits >= v_thresh then
        insert into public.moderation_flags (profile_id) values (v_msg.sender_id) on conflict do nothing;
        select * into v_flag from public.moderation_flags where profile_id = v_msg.sender_id for update;
        if not (v_flag.contact_hits_reported ? v_msg.match_id::text) then
          perform public.run_report_as_service(v_msg.sender_id, 'OFF_PLATFORM_LURE',
            'AUTO:CT_HITS_' || v_hits || ' 같은 매칭에서 연락처 우회 시도 ' || v_hits || '회', v_msg.match_id);
          update public.moderation_flags
          set contact_hits_reported = contact_hits_reported || jsonb_build_object(v_msg.match_id::text, v_hits)
          where profile_id = v_msg.sender_id;
        end if;
      end if;
      perform public.apply_auto_moderation(v_msg.sender_id, v_msg.match_id);

    elsif new.rule_id in ('BW_VIOLENCE', 'BW_ILLEGAL') then
      -- 즉시 자동 신고 P0 (A5 §7.2). THREAT_VIOLENCE 는 create_report 가 채팅 제한 24h 까지 적용
      v_reason := case when new.rule_id = 'BW_VIOLENCE' then 'THREAT_VIOLENCE' else 'OTHER' end;
      if not public.system_report_exists(v_msg.sender_id, v_reason) then
        perform public.run_report_as_service(v_msg.sender_id, v_reason,
          'AUTO:' || new.rule_id || ' 금칙어(' || new.rule_id || ') 즉시 신고', v_msg.match_id);
      end if;

    elsif new.rule_id like 'MN\_%' escape '\' then
      -- 미성년 시그널: MN_AGE 단독 또는 같은 매칭 2개 룰 이상 → MINOR_SUSPECT P0 (create_report 가 비노출 처리)
      select count(distinct f.rule_id)::integer into v_hits
      from public.message_flags f join public.messages m on m.id = f.message_id
      where m.sender_id = v_msg.sender_id and f.rule_id like 'MN\_%' escape '\' and f.created_at > now() - interval '7 days';
      if (new.rule_id = 'MN_AGE' or v_hits >= 2) and not public.system_report_exists(v_msg.sender_id, 'MINOR_SUSPECT') then
        perform public.run_report_as_service(v_msg.sender_id, 'MINOR_SUSPECT',
          'AUTO:' || new.rule_id || ' 미성년 시그널 ' || v_hits || '종', v_msg.match_id);
      end if;
    end if;
  exception when others then
    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('system', 'auto_moderation_error', 'message', new.message_id::text,
            jsonb_build_object('rule_id', new.rule_id, 'sqlstate', sqlstate, 'error', left(sqlerrm, 300)));
  end;
  return null;
end $$;
create trigger trg_message_flags_auto_moderation
  after insert on public.message_flags
  for each row execute function public.trg_message_flags_auto_moderation();
comment on trigger trg_message_flags_auto_moderation on public.message_flags is
  'D4 send_message 가 message_flags 를 insert 하면 자동 조치(스캠 점수·연락처 우회·폭력/불법·미성년)가 여기서 실행된다. D4 는 별도 호출 불필요.';

-- ---------- sanctions AFTER INSERT → 경고 3회/12개월 자동 채팅 제한 ----------
create or replace function public.trg_sanctions_warning_accumulation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_n integer; v_thresh integer := public.moderation_setting_int('warnings_to_restrict', 3);
begin
  if new.level <> 1 or new.profile_id is null then return null; end if;
  select count(*)::integer into v_n from public.sanctions
  where profile_id = new.profile_id and level = 1 and revoked_at is null and starts_at > now() - interval '12 months';
  if v_n >= v_thresh and (v_n % v_thresh) = 0 and public.active_sanction_level(new.profile_id) < 2 then
    perform public.issue_sanction(new.profile_id, 2, 'AUTO:WARNINGS_' || v_n, interval '24 hours', new.report_id, new.reason_code, null);
  end if;
  return null;
end $$;
create trigger trg_sanctions_warning_accumulation
  after insert on public.sanctions
  for each row execute function public.trg_sanctions_warning_accumulation();

-- ---------- reports: evidence 복사 작업 큐 / legal_hold 해제 시 만료 연장 ----------
create or replace function public.trg_reports_enqueue_evidence_copy()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_photos jsonb := coalesce(new.evidence -> 'target_photos', '[]'::jsonb);
begin
  if jsonb_typeof(v_photos) = 'array' and jsonb_array_length(v_photos) > 0 then
    insert into public.moderation_jobs (kind, report_id, payload)
    values ('evidence_copy', new.id, jsonb_build_object('photos', v_photos))
    on conflict do nothing;
  end if;
  return null;
end $$;
create trigger trg_reports_enqueue_evidence_copy
  after insert on public.reports
  for each row execute function public.trg_reports_enqueue_evidence_copy();

create or replace function public.trg_reports_legal_hold_release()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_days integer := coalesce((public.moderation_setting('evidence_retention_days') ->> 'legal_hold_release')::integer, 90);
begin
  if old.legal_hold and not new.legal_hold then
    -- 해제 후 90일 보존(A5 §5.2)
    new.expires_at := greatest(coalesce(new.expires_at, now()), now() + make_interval(days => v_days));
  end if;
  return new;
end $$;
create trigger trg_reports_legal_hold_release
  before update of legal_hold on public.reports
  for each row execute function public.trg_reports_legal_hold_release();

-- ---------- SLA 감시 ----------
-- 초과 건마다 audit_logs(sla_overdue) + notify_admin. 재알림 간격은 우선순위별(sla_renotify_minutes). 반환 {overdue, notified, by_priority}
create or replace function public.sla_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_intervals jsonb := coalesce(public.moderation_setting('sla_renotify_minutes'), '{"P0":30,"P1":360,"P2":1440,"P3":10080}'::jsonb);
  v_notified integer := 0;
  v_total integer := 0;
  v_by jsonb;
  r record;
  v_last timestamptz;
  v_gap integer;
begin
  for r in
    select rp.id, rp.priority, rp.reason_code, rp.status, rp.handled_by, rp.due_at, rp.created_at
    from public.reports rp
    where rp.due_at < now() and rp.status in ('queued', 'in_review', 'need_info')
    order by rp.priority, rp.due_at
  loop
    v_total := v_total + 1;
    v_gap := coalesce((v_intervals ->> r.priority::text)::integer, 1440);
    select max(created_at) into v_last from public.audit_logs
    where action = 'sla_overdue' and target_type = 'report' and target_id = r.id::text;
    if v_last is null or v_last < now() - make_interval(mins => v_gap) then
      insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
      values ('system', 'sla_overdue', 'report', r.id::text,
              jsonb_build_object('priority', r.priority, 'status', r.status, 'due_at', r.due_at,
                                 'overdue_min', extract(epoch from (now() - r.due_at))::integer / 60, 'assigned', r.handled_by is not null));
      perform public.notify_admin('sla_overdue',
        jsonb_build_object('report_id', r.id, 'priority', r.priority, 'reason_code', r.reason_code, 'status', r.status,
                           'due_at', r.due_at, 'overdue_min', extract(epoch from (now() - r.due_at))::integer / 60), r.id);
      v_notified := v_notified + 1;
    end if;
  end loop;

  select coalesce(jsonb_object_agg(priority, n), '{}'::jsonb) into v_by
  from (select priority::text, count(*)::integer as n from public.reports
        where due_at < now() and status in ('queued', 'in_review', 'need_info') group by priority) x;

  return jsonb_build_object('overdue', v_total, 'notified', v_notified, 'by_priority', v_by, 'checked_at', now());
end $$;
comment on function public.sla_check is 'moderation-sla-check Edge Function(15분 cron) 이 호출. 초과 건 audit_logs(sla_overdue) + notify_admin(D7 훅).';

-- ---------- 권한 ----------
revoke execute on function
  public.run_report_as_service(uuid, public.report_reason, text, uuid),
  public.system_report_exists(uuid, public.report_reason, integer),
  public.compute_scam_score(uuid),
  public.apply_auto_moderation(uuid, uuid),
  public.sla_check()
from public, anon, authenticated;

grant execute on function
  public.system_report_exists(uuid, public.report_reason, integer),
  public.compute_scam_score(uuid),
  public.apply_auto_moderation(uuid, uuid),
  public.sla_check()
to service_role;
-- run_report_as_service 는 트리거·내부 함수 전용(service_role 에도 미부여). 시스템 신고가 필요하면 create_report(service) 를 직접 호출한다.
