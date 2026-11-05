-- =============================================================================
-- 0043 — admin server functions (D5 제공, D8 어드민 UI 가 service role 로 호출)
--   모든 함수는 p_actor_id(auth.users.id) 를 받고 admin_users 에서 역할을 서버가 다시 확인한다(JWT/호출자 신뢰 안 함).
--   권한표: moderator = 분류·판정(level ≤3)·사진 검수·검색·상세·해제(level ≤3) / admin = level ≥4·영구·이의신청·legal_hold·해제 전부
--   전부 audit_logs 기록(actor_id·actor_role·before/after). 증거 서명 URL 은 TS 래퍼(lib/moderation/admin.ts)가 발급(SQL 불가).
-- =============================================================================

-- ---------- 역할 확인 ----------
create or replace function public.admin_role_of(p_actor_id uuid)
returns public.admin_role language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = p_actor_id
$$;

create or replace function public.assert_moderator(p_actor_id uuid)
returns public.admin_role language plpgsql stable security definer set search_path = public as $$
declare v_role public.admin_role := public.admin_role_of(p_actor_id);
begin
  if p_actor_id is null or v_role is null then raise exception 'FORBIDDEN: moderator required' using errcode = '42501'; end if;
  return v_role;
end $$;

create or replace function public.assert_admin(p_actor_id uuid)
returns public.admin_role language plpgsql stable security definer set search_path = public as $$
declare v_role public.admin_role := public.admin_role_of(p_actor_id);
begin
  if p_actor_id is null or v_role is distinct from 'admin' then raise exception 'FORBIDDEN: admin required' using errcode = '42501'; end if;
  return v_role;
end $$;

create or replace function public.admin_audit(p_actor_id uuid, p_action text, p_target_type text, p_target_id text, p_before jsonb default null, p_after jsonb default null, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before, after, meta)
  values (p_actor_id, coalesce(public.admin_role_of(p_actor_id)::text, 'service'), p_action, p_target_type, p_target_id, p_before, p_after, coalesce(p_meta, '{}'::jsonb))
$$;

-- ---------- 신고 큐 ----------
-- filter: {status:[...], priority:[...], reason_code, assignee(uuid|'me'|'none'), overdue(bool), target_id}
-- cursor: {priority, due_at, id} (정렬 = priority asc, due_at asc, id asc) — 반환 next_cursor 를 그대로 되돌려 준다
create or replace function public.admin_list_reports(p_actor_id uuid, p_filter jsonb default '{}'::jsonb, p_cursor jsonb default null, p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_statuses public.report_status[];
  v_priorities public.report_priority[];
  v_items jsonb;
  v_count integer;
  v_next jsonb;
  v_assignee uuid;
begin
  perform public.assert_moderator(p_actor_id);
  if p_filter ? 'status' and jsonb_typeof(p_filter -> 'status') = 'array' then
    select array_agg(x::public.report_status) into v_statuses from jsonb_array_elements_text(p_filter -> 'status') x;
  else
    v_statuses := array['queued', 'in_review', 'need_info']::public.report_status[];
  end if;
  if p_filter ? 'priority' and jsonb_typeof(p_filter -> 'priority') = 'array' then
    select array_agg(x::public.report_priority) into v_priorities from jsonb_array_elements_text(p_filter -> 'priority') x;
  end if;
  if (p_filter ->> 'assignee') = 'me' then v_assignee := p_actor_id;
  elsif (p_filter ->> 'assignee') ~ '^[0-9a-f-]{36}$' then v_assignee := (p_filter ->> 'assignee')::uuid; end if;

  with q as (
    select r.id, r.priority, r.due_at, r.reason_code, r.status, r.surface, r.target_id, r.reporter_id is null as is_system,
           r.handled_by, r.detector_hit_count, r.legal_hold, r.created_at, r.handled_at,
           (r.due_at < now() and r.status in ('queued', 'in_review', 'need_info')) as overdue,
           greatest(0, extract(epoch from (r.due_at - now()))::integer) as due_in_sec,
           t.nickname as target_nickname, t.verify_level as target_verify_level, t.status as target_status,
           (select count(*)::integer from public.reports x where x.target_id = r.target_id and x.status <> 'dismissed') as target_report_count,
           public.active_sanction_level(r.target_id) as target_sanction_level
    from public.reports r
    left join public.profiles t on t.id = r.target_id
    where r.status = any(v_statuses)
      and (v_priorities is null or r.priority = any(v_priorities))
      and (not (p_filter ? 'reason_code') or r.reason_code = (p_filter ->> 'reason_code')::public.report_reason)
      and (not (p_filter ? 'target_id') or r.target_id = (p_filter ->> 'target_id')::uuid)
      and (v_assignee is null or r.handled_by = v_assignee)
      and ((p_filter ->> 'assignee') is distinct from 'none' or r.handled_by is null)
      and (coalesce((p_filter ->> 'overdue')::boolean, false) = false or (r.due_at < now() and r.status in ('queued', 'in_review', 'need_info')))
      and (coalesce((p_filter ->> 'legal_hold')::boolean, false) = false or r.legal_hold)
      and (p_cursor is null or (r.priority, r.due_at, r.id) > ((p_cursor ->> 'priority')::public.report_priority, (p_cursor ->> 'due_at')::timestamptz, (p_cursor ->> 'id')::uuid))
    order by r.priority, r.due_at, r.id
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by q.priority, q.due_at, q.id), '[]'::jsonb), count(*)::integer into v_items, v_count from q;

  if v_count > v_limit then
    v_next := jsonb_build_object('priority', v_items -> (v_limit - 1) ->> 'priority', 'due_at', v_items -> (v_limit - 1) ->> 'due_at', 'id', v_items -> (v_limit - 1) ->> 'id');
    v_items := (select jsonb_agg(e) from (select e from jsonb_array_elements(v_items) with ordinality as t(e, i) where i <= v_limit order by i) s);
  end if;
  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb), 'next_cursor', v_next);
end $$;

-- 신고 상세(증거 포함) — 열람 자체를 audit(evidence_viewed). 서명 URL 은 TS 래퍼가 evidence.target_photos[].evidence_path 로 발급
create or replace function public.admin_get_report(p_actor_id uuid, p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.reports%rowtype; v_out jsonb;
begin
  perform public.assert_moderator(p_actor_id);
  select * into v_r from public.reports where id = p_report_id;
  if not found then raise exception 'NOT_FOUND: report' using errcode = 'no_data_found'; end if;
  perform public.admin_audit(p_actor_id, 'evidence_viewed', 'report', p_report_id::text, null, null, jsonb_build_object('reason_code', v_r.reason_code, 'status', v_r.status));

  select jsonb_build_object(
    'report', to_jsonb(v_r),
    'target', (select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'verify_level', p.verify_level, 'status', p.status, 'mode', p.mode,
                                         'hidden_reason', p.hidden_reason, 'created_at', p.created_at, 'sanction_level', public.active_sanction_level(p.id))
               from public.profiles p where p.id = v_r.target_id),
    'reporter', (select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'verify_level', p.verify_level, 'status', p.status,
                                           'report_count_90d', (select count(*) from public.reports x where x.reporter_id = p.id and x.created_at > now() - interval '90 days'),
                                           'dismissed_count_90d', (select count(*) from public.reports x where x.reporter_id = p.id and x.status = 'dismissed' and x.created_at > now() - interval '90 days'))
                 from public.profiles p where p.id = v_r.reporter_id),
    'sanctions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from public.sanctions s where s.profile_id = v_r.target_id),
    'prior_reports', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'reason_code', x.reason_code, 'status', x.status, 'priority', x.priority, 'created_at', x.created_at, 'is_system', x.reporter_id is null) order by x.created_at desc), '[]'::jsonb)
                      from public.reports x where x.target_id = v_r.target_id and x.id <> v_r.id),
    'copy_job', (select jsonb_build_object('status', j.status, 'attempts', j.attempts, 'last_error', j.last_error, 'result', j.result)
                 from public.moderation_jobs j where j.report_id = v_r.id and j.kind = 'evidence_copy' order by j.created_at desc limit 1),
    'risk', (select jsonb_build_object('scam_score', f.scam_score, 'scam_signals', f.scam_signals, 'scam_banner_until', f.scam_banner_until, 'computed_at', f.computed_at)
             from public.moderation_flags f where f.profile_id = v_r.target_id),
    'suggested_level', case v_r.reason_code
      when 'ROMANCE_SCAM' then 6 when 'MINOR_SUSPECT' then 6 when 'INAPPROPRIATE_PHOTO' then 3 when 'THREAT_VIOLENCE' then 5
      when 'STALKING' then 4 when 'SEXUAL_HARASSMENT' then 3 when 'IMPERSONATION' then 3 when 'COMMERCIAL_SPAM' then 3
      when 'HATE_SPEECH' then 2 when 'PII_REQUEST' then 1 when 'OFF_PLATFORM_LURE' then 1 when 'FAKE_PROFILE' then 1 when 'NO_SHOW' then 1 else null end
  ) into v_out;
  return v_out;
end $$;

-- 분류: 담당자 배정(in_review) + 우선순위 상향(하향 불가)
create or replace function public.admin_triage_report(p_actor_id uuid, p_report_id uuid, p_priority public.report_priority default null, p_assignee_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.reports%rowtype; v_assignee uuid := coalesce(p_assignee_id, p_actor_id); v_priority public.report_priority;
begin
  perform public.assert_moderator(p_actor_id);
  select * into v_r from public.reports where id = p_report_id for update;
  if not found then raise exception 'NOT_FOUND: report' using errcode = 'no_data_found'; end if;
  if v_r.status in ('confirmed', 'dismissed') then raise exception 'ALREADY_ACTED: report closed' using errcode = '42501'; end if;
  if public.admin_role_of(v_assignee) is null then raise exception 'INVALID_INPUT: assignee is not a moderator' using errcode = 'check_violation'; end if;
  v_priority := v_r.priority;
  if p_priority is not null and p_priority < v_r.priority then v_priority := p_priority; end if;   -- enum 순서 P0 < P1 < P2 < P3 → 작을수록 높음
  update public.reports
  set status = case when v_r.status = 'queued' then 'in_review' else v_r.status end,
      handled_by = v_assignee,
      priority = v_priority,
      due_at = case when v_priority <> v_r.priority then least(v_r.due_at, v_r.created_at + public.report_sla_interval(v_priority)) else v_r.due_at end
  where id = p_report_id;
  perform public.admin_audit(p_actor_id, 'report_triaged', 'report', p_report_id::text,
    jsonb_build_object('status', v_r.status, 'priority', v_r.priority, 'handled_by', v_r.handled_by),
    jsonb_build_object('status', case when v_r.status = 'queued' then 'in_review' else v_r.status end, 'priority', v_priority, 'handled_by', v_assignee));
  return jsonb_build_object('report_id', p_report_id, 'status', case when v_r.status = 'queued' then 'in_review' else v_r.status end, 'priority', v_priority, 'handled_by', v_assignee);
end $$;

-- 자동 조치 해제(dismissed 시): AUTO: 제재 revoke, held 사진 복구, 비노출 해제(해당 사유만). 자동 차단(STALKING)은 신고자 보호를 위해 유지.
create or replace function public.revert_auto_actions(p_actor_id uuid, p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.reports%rowtype; v_sanc integer := 0; v_photos integer := 0; v_hidden boolean := false;
begin
  select * into v_r from public.reports where id = p_report_id;
  if not found then return '{}'::jsonb; end if;

  update public.sanctions set revoked_at = now(), revoked_by = p_actor_id
  where report_id = p_report_id and reason like 'AUTO:%' and revoked_at is null;
  get diagnostics v_sanc = row_count;

  if v_r.auto_actions ? 'photos_held' then
    update public.photos set review_status = 'pending', held_reason = null
    where profile_id = v_r.target_id and review_status = 'held' and held_reason = 'AUTO:' || v_r.reason_code::text;
    get diagnostics v_photos = row_count;
  end if;

  if (v_r.auto_actions ? 'profile_hidden_reverify' and v_r.reason_code = 'MINOR_SUSPECT')
     or (v_r.reason_code = 'ROMANCE_SCAM' and v_r.surface = 'system') then
    update public.profiles set hidden_at = null, hidden_reason = null
    where id = v_r.target_id and hidden_reason in ('MINOR_SUSPECT', 'SCAM_SCORE');
    get diagnostics v_hidden = row_count;
    if v_r.reason_code = 'ROMANCE_SCAM' then
      update public.moderation_flags set scam_banner_until = null, scam_restricted_at = null where profile_id = v_r.target_id;
    end if;
  end if;

  -- 누적 5명/90일 비노출은 다른 신고들에 의한 것일 수 있으므로 해당 신고가 마지막 미종결이었을 때만 해제
  if v_r.auto_actions ? 'profile_hidden_cumulative' and not exists (
    select 1 from public.reports x where x.target_id = v_r.target_id and x.id <> p_report_id and x.status not in ('dismissed') and x.created_at > now() - interval '90 days'
  ) then
    update public.profiles set hidden_at = null, hidden_reason = null where id = v_r.target_id and hidden_reason = 'CUMULATIVE_5_90D';
  end if;

  return jsonb_build_object('sanctions_revoked', v_sanc, 'photos_restored', v_photos, 'unhidden', v_hidden);
end $$;

-- 판정: confirmed(제재 발급) | dismissed(자동 조치 해제) | need_info
-- moderator 는 level ≤3, admin 은 전부. level 6 은 admin 만. 통보: 신고자("조치가 완료되었어요"), 피신고자(사유 카테고리·기간·이의신청 방법)
create or replace function public.admin_resolve_report(
  p_actor_id uuid, p_report_id uuid, p_outcome public.report_status,
  p_sanction_level integer default null, p_note text default null, p_duration interval default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role public.admin_role := public.assert_moderator(p_actor_id);
  v_r public.reports%rowtype;
  v_sanction_id uuid;
  v_reverted jsonb := '{}'::jsonb;
  v_ends timestamptz;
  v_window integer := public.moderation_setting_int('appeal_window_days', 7);
begin
  select * into v_r from public.reports where id = p_report_id for update;
  if not found then raise exception 'NOT_FOUND: report' using errcode = 'no_data_found'; end if;
  if v_r.status in ('confirmed', 'dismissed') then raise exception 'ALREADY_ACTED: report closed' using errcode = '42501'; end if;
  if p_outcome not in ('confirmed', 'dismissed', 'need_info') then raise exception 'INVALID_INPUT: outcome' using errcode = 'check_violation'; end if;

  if p_outcome = 'confirmed' then
    if p_sanction_level is not null then
      if p_sanction_level < 1 or p_sanction_level > 6 then raise exception 'INVALID_INPUT: sanction_level' using errcode = 'check_violation'; end if;
      if p_sanction_level > 3 and v_role <> 'admin' then
        raise exception 'FORBIDDEN: level>=4 requires admin' using errcode = '42501';
      end if;
      if v_r.target_id is null then raise exception 'INVALID_INPUT: target deleted' using errcode = 'check_violation'; end if;
      v_sanction_id := public.issue_sanction(v_r.target_id, p_sanction_level,
        'MANUAL:' || v_r.reason_code::text || case when p_note is null then '' else ' ' || left(p_note, 200) end,
        p_duration, p_report_id, v_r.reason_code, p_actor_id);
      -- 사람이 확정 제재를 내렸으면 같은 신고의 AUTO: 제재는 종료(중복 방지)
      update public.sanctions set revoked_at = now(), revoked_by = p_actor_id
      where report_id = p_report_id and reason like 'AUTO:%' and revoked_at is null and id <> v_sanction_id;
    end if;
    update public.reports set status = 'confirmed', handled_by = p_actor_id, resolution_note = p_note where id = p_report_id;
    if v_sanction_id is not null then
      select ends_at into v_ends from public.sanctions where id = v_sanction_id;
      perform public.notify_user(v_r.target_id, 'sanction_issued',
        jsonb_build_object('sanction_id', v_sanction_id, 'level', p_sanction_level, 'reason_code', v_r.reason_code, 'ends_at', v_ends,
                           'appeal_deadline', now() + make_interval(days => v_window), 'appeal_route', '/appeal', 'can_appeal', p_sanction_level >= 3),
        p_report_id, v_sanction_id);
    end if;
  elsif p_outcome = 'dismissed' then
    v_reverted := public.revert_auto_actions(p_actor_id, p_report_id);
    update public.reports set status = 'dismissed', handled_by = p_actor_id, resolution_note = p_note where id = p_report_id;
  else
    update public.reports set status = 'need_info', handled_by = p_actor_id, resolution_note = p_note where id = p_report_id;
    perform public.notify_user(v_r.reporter_id, 'report_need_info', jsonb_build_object('report_id', p_report_id), p_report_id);
  end if;

  if p_outcome in ('confirmed', 'dismissed') then
    perform public.notify_user(v_r.reporter_id, 'report_resolved',
      jsonb_build_object('report_id', p_report_id, 'outcome', p_outcome, 'message_key', 'report_resolved_generic'), p_report_id);   -- "조치가 완료되었어요" 수준만
  end if;

  perform public.admin_audit(p_actor_id, 'report_resolved', 'report', p_report_id::text,
    jsonb_build_object('status', v_r.status, 'priority', v_r.priority),
    jsonb_build_object('status', p_outcome, 'sanction_id', v_sanction_id, 'sanction_level', p_sanction_level),
    jsonb_build_object('reverted', v_reverted, 'note_len', char_length(coalesce(p_note, ''))));

  return jsonb_build_object('report_id', p_report_id, 'status', p_outcome, 'sanction_id', v_sanction_id, 'reverted', v_reverted,
                            'expires_at', (select expires_at from public.reports where id = p_report_id));
end $$;

-- ---------- 사진 검수 (A5 §8) ----------
-- approved | rejected(reject_code 필수). 트리거 → recompute_verify_level(0009). 부수효과: reject_not_self 2회 → IMPERSONATION 자동 신고,
-- reject_nudity → 경고(level 1), reject_minor → MINOR_SUSPECT P0(비노출), reject_text_contact → OFF_PLATFORM_LURE 카운트(audit)
create or replace function public.admin_review_photo(
  p_actor_id uuid, p_photo_id uuid, p_decision public.review_status,
  p_reject_code public.photo_reject_code default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.photos%rowtype; v_side jsonb := '[]'::jsonb; v_n integer; v_level smallint;
begin
  perform public.assert_moderator(p_actor_id);
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_INPUT: decision' using errcode = 'check_violation'; end if;
  if p_decision = 'rejected' and p_reject_code is null then raise exception 'INVALID_INPUT: reject_code required' using errcode = 'check_violation'; end if;
  select * into v_p from public.photos where id = p_photo_id for update;
  if not found then raise exception 'NOT_FOUND: photo' using errcode = 'no_data_found'; end if;

  update public.photos
  set review_status = p_decision, reject_code = case when p_decision = 'rejected' then p_reject_code else null end,
      reviewed_by = p_actor_id, reviewed_at = now(), held_reason = null
  where id = p_photo_id;   -- 트리거 trg_photos_recompute_level → verify_level

  if p_decision = 'rejected' then
    if p_reject_code = 'reject_not_self' then
      select count(*)::integer into v_n from public.photos where profile_id = v_p.profile_id and reject_code = 'reject_not_self';
      if v_n >= 2 and not public.system_report_exists(v_p.profile_id, 'IMPERSONATION') then
        perform public.run_report_as_service(v_p.profile_id, 'IMPERSONATION', 'AUTO:PHOTO_NOT_SELF_x' || v_n || ' 타인 사진 반려 ' || v_n || '회', null);
        v_side := v_side || to_jsonb('impersonation_report'::text);
      end if;
    elsif p_reject_code = 'reject_nudity' then
      perform public.issue_sanction(v_p.profile_id, 1, 'AUTO:PHOTO_NUDITY', null, null, 'INAPPROPRIATE_PHOTO', null);
      v_side := v_side || to_jsonb('warning'::text);
    elsif p_reject_code = 'reject_minor' then
      if not public.system_report_exists(v_p.profile_id, 'MINOR_SUSPECT') then
        perform public.run_report_as_service(v_p.profile_id, 'MINOR_SUSPECT', 'AUTO:PHOTO_MINOR 사진 검수자 미성년 의심(MN_PROFILE_MISMATCH)', null);
        v_side := v_side || to_jsonb('minor_report'::text);
      end if;
    elsif p_reject_code = 'reject_text_contact' then
      v_side := v_side || to_jsonb('off_platform_count'::text);
    end if;
  end if;

  select verify_level into v_level from public.profiles where id = v_p.profile_id;
  perform public.notify_user(v_p.profile_id, 'photo_reviewed', jsonb_build_object('photo_id', p_photo_id, 'decision', p_decision, 'reject_code', p_reject_code));
  perform public.admin_audit(p_actor_id, 'photo_reviewed', 'photo', p_photo_id::text,
    jsonb_build_object('review_status', v_p.review_status, 'reject_code', v_p.reject_code, 'held_reason', v_p.held_reason),
    jsonb_build_object('review_status', p_decision, 'reject_code', p_reject_code),
    jsonb_build_object('profile_id', v_p.profile_id, 'side_effects', v_side, 'verify_level_after', v_level, 'face', v_p.face_count, 'note_len', char_length(coalesce(p_note, ''))));
  return jsonb_build_object('photo_id', p_photo_id, 'review_status', p_decision, 'reject_code', p_reject_code, 'profile_id', v_p.profile_id, 'verify_level', v_level, 'side_effects', v_side);
end $$;

-- ---------- 프로필 검색/상세 ----------
create or replace function public.admin_search_profiles(p_actor_id uuid, p_q text, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := btrim(coalesce(p_q, '')); v_items jsonb;
begin
  perform public.assert_moderator(p_actor_id);
  if char_length(v_q) < 1 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'nickname', p.nickname, 'verify_level', p.verify_level, 'status', p.status, 'mode', p.mode, 'region_code', p.region_code,
    'hidden_reason', p.hidden_reason, 'created_at', p.created_at, 'last_active_at', p.last_active_at,
    'sanction_level', public.active_sanction_level(p.id),
    'report_count', (select count(*) from public.reports r where r.target_id = p.id and r.status <> 'dismissed')
  ) order by p.last_active_at desc), '[]'::jsonb) into v_items
  from (
    select * from public.profiles p
    where (v_q ~ '^[0-9a-f-]{36}$' and (p.id = v_q::uuid or p.user_id = v_q::uuid))
       or (p.nickname ilike '%' || v_q || '%')
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) p;
  perform public.admin_audit(p_actor_id, 'profile_searched', 'profile', null, null, null, jsonb_build_object('q_len', char_length(v_q), 'hits', jsonb_array_length(v_items)));
  return v_items;
end $$;

create or replace function public.admin_profile_detail(p_actor_id uuid, p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.profiles%rowtype; v_out jsonb;
begin
  perform public.assert_moderator(p_actor_id);
  select * into v_p from public.profiles where id = p_profile_id;
  if not found then raise exception 'NOT_FOUND: profile' using errcode = 'no_data_found'; end if;
  select jsonb_build_object(
    'profile', jsonb_build_object('id', v_p.id, 'nickname', v_p.nickname, 'birth_year', v_p.birth_year, 'gender', v_p.gender, 'region_code', v_p.region_code,
      'bio', v_p.bio, 'now_into', v_p.now_into, 'verify_level', v_p.verify_level, 'status', v_p.status, 'mode', v_p.mode, 'onboarding_step', v_p.onboarding_step,
      'hidden_at', v_p.hidden_at, 'hidden_reason', v_p.hidden_reason, 'banned_at', v_p.banned_at, 'delete_requested_at', v_p.delete_requested_at,
      'created_at', v_p.created_at, 'last_active_at', v_p.last_active_at, 'sanction_level', public.active_sanction_level(v_p.id)),
    'identity', (select jsonb_build_object('result', iv.result, 'provider', iv.provider, 'verified_at', iv.verified_at, 'birth_date_verified', iv.birth_date_verified, 'is_active', iv.is_active)
                 from public.identity_verifications iv where iv.user_id = v_p.user_id order by iv.created_at desc limit 1),   -- 해시 미노출
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'is_primary', ph.is_primary, 'review_status', ph.review_status, 'reject_code', ph.reject_code,
                 'held_reason', ph.held_reason, 'face_count', ph.face_count, 'face_confidence', ph.face_confidence, 'auto_flags', ph.auto_flags, 'created_at', ph.created_at) order by ph.sort_order), '[]'::jsonb)
               from public.photos ph where ph.profile_id = v_p.id),
    'sanctions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb) from public.sanctions s where s.profile_id = v_p.id),
    'appeals', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) from public.appeals a where a.profile_id = v_p.id),
    'reports_against', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'reason_code', r.reason_code, 'status', r.status, 'priority', r.priority, 'created_at', r.created_at, 'is_system', r.reporter_id is null) order by r.created_at desc), '[]'::jsonb)
                        from public.reports r where r.target_id = v_p.id),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'reason_code', r.reason_code, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
                      from public.reports r where r.reporter_id = v_p.id),
    'blocks', jsonb_build_object('blocked', (select count(*) from public.blocks b where b.blocker_id = v_p.id), 'blocked_by', (select count(*) from public.blocks b where b.blocked_id = v_p.id)),
    'risk', (select jsonb_build_object('scam_score', f.scam_score, 'scam_signals', f.scam_signals, 'scam_banner_until', f.scam_banner_until, 'scam_restricted_at', f.scam_restricted_at, 'computed_at', f.computed_at)
             from public.moderation_flags f where f.profile_id = v_p.id),
    'matches_active', (select count(*) from public.matches m where m.status = 'active' and v_p.id in (m.a_id, m.b_id))
  ) into v_out;
  perform public.admin_audit(p_actor_id, 'profile_viewed', 'profile', p_profile_id::text);
  return v_out;
end $$;

-- ---------- 제재 해제 / 이의신청 판정 / legal hold ----------
create or replace function public.admin_lift_sanction(p_actor_id uuid, p_sanction_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.admin_role := public.assert_moderator(p_actor_id); v_s public.sanctions%rowtype; v_restored boolean := false;
begin
  select * into v_s from public.sanctions where id = p_sanction_id for update;
  if not found then raise exception 'NOT_FOUND: sanction' using errcode = 'no_data_found'; end if;
  if v_s.revoked_at is not null then raise exception 'ALREADY_ACTED: revoked' using errcode = '42501'; end if;
  if v_s.level > 3 and v_role <> 'admin' then raise exception 'FORBIDDEN: level>=4 requires admin' using errcode = '42501'; end if;

  update public.sanctions set revoked_at = now(), revoked_by = p_actor_id where id = p_sanction_id;

  -- 영구정지 해제: 다른 활성 level 6 이 없으면 계정 복구 + 이 제재로 등록된 CI 블록 제거
  if v_s.level = 6 and v_s.profile_id is not null and not exists (
    select 1 from public.sanctions x where x.profile_id = v_s.profile_id and x.level = 6 and x.revoked_at is null and x.id <> p_sanction_id
  ) then
    update public.profiles set status = 'active', banned_at = null,
      hidden_at = case when hidden_reason = 'banned' then null else hidden_at end,
      hidden_reason = case when hidden_reason = 'banned' then null else hidden_reason end
    where id = v_s.profile_id and status = 'banned';
    delete from public.blocked_ci_hashes where source_profile_id = v_s.profile_id and reason = v_s.reason;
    v_restored := true;
  end if;
  -- level 5 로 paused 된 매칭은 복구하지 않는다(상대 의사 불명, 문서화)

  perform public.notify_user(v_s.profile_id, 'sanction_lifted', jsonb_build_object('sanction_id', p_sanction_id, 'level', v_s.level), v_s.report_id, p_sanction_id);
  perform public.admin_audit(p_actor_id, 'sanction_lifted', 'sanction', p_sanction_id::text,
    jsonb_build_object('level', v_s.level, 'reason', v_s.reason, 'ends_at', v_s.ends_at), jsonb_build_object('revoked_at', now(), 'account_restored', v_restored),
    jsonb_build_object('profile_id', v_s.profile_id, 'note_len', char_length(coalesce(p_note, ''))));
  return jsonb_build_object('sanction_id', p_sanction_id, 'revoked_at', now(), 'account_restored', v_restored);
end $$;

create or replace function public.admin_decide_appeal(p_actor_id uuid, p_appeal_id uuid, p_decision public.appeal_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a public.appeals%rowtype; v_lift jsonb;
begin
  perform public.assert_admin(p_actor_id);
  if p_decision not in ('accepted', 'rejected') then raise exception 'INVALID_INPUT: decision' using errcode = 'check_violation'; end if;
  select * into v_a from public.appeals where id = p_appeal_id for update;
  if not found then raise exception 'NOT_FOUND: appeal' using errcode = 'no_data_found'; end if;
  if v_a.status <> 'pending' then raise exception 'ALREADY_ACTED: appeal decided' using errcode = '42501'; end if;

  update public.appeals set status = p_decision, decision_note = p_note, decided_by = p_actor_id, decided_at = now() where id = p_appeal_id;
  if p_decision = 'accepted' then
    if exists (select 1 from public.sanctions s where s.id = v_a.sanction_id and s.revoked_at is null) then
      v_lift := public.admin_lift_sanction(p_actor_id, v_a.sanction_id, 'appeal accepted');
    end if;
  end if;
  -- 통보: 기각 시 사유 한 줄 포함(A5 §4.5), 재신청 불가
  perform public.notify_user(v_a.profile_id, 'appeal_decided',
    jsonb_build_object('appeal_id', p_appeal_id, 'decision', p_decision, 'note', left(coalesce(p_note, ''), 200)), null, v_a.sanction_id);
  perform public.admin_audit(p_actor_id, 'appeal_decided', 'appeal', p_appeal_id::text,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision, 'lift', v_lift),
    jsonb_build_object('sanction_id', v_a.sanction_id, 'profile_id', v_a.profile_id));
  return jsonb_build_object('appeal_id', p_appeal_id, 'status', p_decision, 'lift', v_lift);
end $$;

create or replace function public.admin_set_legal_hold(p_actor_id uuid, p_report_id uuid, p_hold boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.reports%rowtype;
begin
  perform public.assert_admin(p_actor_id);
  select * into v_r from public.reports where id = p_report_id for update;
  if not found then raise exception 'NOT_FOUND: report' using errcode = 'no_data_found'; end if;
  if v_r.evidence ? 'purged_at' and p_hold then raise exception 'ALREADY_ACTED: evidence purged' using errcode = '42501'; end if;
  update public.reports set legal_hold = p_hold where id = p_report_id;   -- 해제 시 트리거가 expires_at +90d
  perform public.admin_audit(p_actor_id, 'legal_hold_changed', 'report', p_report_id::text,
    jsonb_build_object('legal_hold', v_r.legal_hold, 'expires_at', v_r.expires_at),
    jsonb_build_object('legal_hold', p_hold, 'expires_at', (select expires_at from public.reports where id = p_report_id)),
    jsonb_build_object('note', left(coalesce(p_note, ''), 300)));
  return jsonb_build_object('report_id', p_report_id, 'legal_hold', p_hold, 'expires_at', (select expires_at from public.reports where id = p_report_id));
end $$;

-- 큐 대시보드 수치(배너·SLA)
create or replace function public.admin_moderation_stats(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_moderator(p_actor_id);
  return jsonb_build_object(
    'queue', (select coalesce(jsonb_object_agg(priority, n), '{}'::jsonb) from (select priority::text, count(*)::integer n from public.reports where status in ('queued','in_review','need_info') group by priority) x),
    'overdue', (select coalesce(jsonb_object_agg(priority, n), '{}'::jsonb) from (select priority::text, count(*)::integer n from public.reports where status in ('queued','in_review','need_info') and due_at < now() group by priority) x),
    'unassigned', (select count(*) from public.reports where status = 'queued'),
    'photos_pending', (select count(*) from public.photos where review_status in ('pending', 'held')),
    'appeals_pending', (select count(*) from public.appeals where status = 'pending'),
    'appeals_overdue', (select count(*) from public.appeals where status = 'pending' and created_at + make_interval(hours => public.moderation_setting_int('appeal_decision_hours', 72)) < now()),
    'jobs_failed', (select count(*) from public.moderation_jobs where status = 'failed'),
    'notifications_pending', (select count(*) from public.moderation_notifications where audience = 'admin' and delivered_at is null),
    'checked_at', now()
  );
end $$;

-- ---------- 권한: 전부 service role 전용 (D8 서버가 requireAdmin 후 호출, actor 는 인자로) ----------
revoke execute on function
  public.admin_role_of(uuid), public.assert_moderator(uuid), public.assert_admin(uuid),
  public.admin_audit(uuid, text, text, text, jsonb, jsonb, jsonb),
  public.admin_list_reports(uuid, jsonb, jsonb, integer), public.admin_get_report(uuid, uuid),
  public.admin_triage_report(uuid, uuid, public.report_priority, uuid),
  public.revert_auto_actions(uuid, uuid),
  public.admin_resolve_report(uuid, uuid, public.report_status, integer, text, interval),
  public.admin_review_photo(uuid, uuid, public.review_status, public.photo_reject_code, text),
  public.admin_search_profiles(uuid, text, integer), public.admin_profile_detail(uuid, uuid),
  public.admin_lift_sanction(uuid, uuid, text), public.admin_decide_appeal(uuid, uuid, public.appeal_status, text),
  public.admin_set_legal_hold(uuid, uuid, boolean, text), public.admin_moderation_stats(uuid)
from public, anon, authenticated;

grant execute on function
  public.admin_list_reports(uuid, jsonb, jsonb, integer), public.admin_get_report(uuid, uuid),
  public.admin_triage_report(uuid, uuid, public.report_priority, uuid),
  public.admin_resolve_report(uuid, uuid, public.report_status, integer, text, interval),
  public.admin_review_photo(uuid, uuid, public.review_status, public.photo_reject_code, text),
  public.admin_search_profiles(uuid, text, integer), public.admin_profile_detail(uuid, uuid),
  public.admin_lift_sanction(uuid, uuid, text), public.admin_decide_appeal(uuid, uuid, public.appeal_status, text),
  public.admin_set_legal_hold(uuid, uuid, boolean, text), public.admin_moderation_stats(uuid)
to service_role;
