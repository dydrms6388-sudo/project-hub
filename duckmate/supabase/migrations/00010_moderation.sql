-- =============================================================================
-- 덕메이트(DuckMate) · D5 마이그레이션 00010 — 모더레이션 레이어
--   (자동 제재 + 신고 처리 + 이의제기 · A5 §3/§6, D1 00002~00004 위에 얹는 레이어)
--
-- 전제 (D1 기존 산출물과의 관계 — 중복 구현 금지):
--   · triage_report()            : BEFORE INSERT 트리거 — priority/sla_due_at 세팅 (00004)
--   · create_report_snapshot()   : 증거 스냅샷 — D5 서버가 접수 직후 동기 호출 (00004)
--   · appeals RLS insert 정책    : can_appeal() 30일 검증 (00003) — 본 파일의
--     submit_appeal() 은 그 위의 "정식 접수 경로"(appeal_status 동기화 포함)다.
--
-- 이 파일이 추가하는 것:
--   1) apply_auto_sanctions()  — reports AFTER INSERT 트리거 (triage 다음 순서)
--        AUTO_3REPORTS : 서로 다른 신고자 3인/30일 → sanctions level 2 (72h) + 큐 P1
--        AUTO_P0_FREEZE: P0 신고 1건 → 즉시 임시 기능 제한(발신 정지) + 큐 P0(1h SLA)
--   2) resolve_report()        — 어드민 조치 확정 (4-eyes: level 5 는 2인 승인)
--   3) mark_report_notified()  — 통보 완료 → NOTIFIED 전이 (SLA 마감 기록)
--   4) submit_appeal()         — 이의제기 접수 (30일 내·건당 1회, authenticated RPC)
--   5) resolve_appeal()        — 이의제기 결정 (4-eyes: 원 제재 처리자와 다른 어드민)
--
-- 신고자 비노출 보장 검토 (A5 §6 "신고 사실은 피신고자에게 익명"):
--   · reports 는 클라이언트 접근이 admin SELECT(evidence 제외) + my_reports 뷰
--     (reporter 본인 한정) 뿐 — 피신고자는 자기 대상 신고 행을 어떤 쿼리로도
--     조회할 수 없다 (00003 확인).
--   · 자동 제재의 sanctions.reason 은 my_sanctions 뷰로 피신고자에게 노출되므로
--     신고자·신고 수·reason_code 를 포함하지 않는 "일반화 문구"만 기록한다.
--     룰 ID·집계치는 audit_logs.meta (service role 전용)에만 남긴다.
--   · 잔여 리스크: P0 즉시 조치는 "직전 대화 직후 제재"라는 타이밍으로 신고
--     사실이 유추될 수 있다. 안전>성장 원칙(A5 §0-3)상 즉시성이 우선이며,
--     통보 문구 일반화로 완화한다 — E3/E4 는 제재 안내 화면에서 신고 출처를
--     암시하는 어떤 문구(예: "상대방의 신고로")도 쓰지 말 것.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. apply_auto_sanctions() — 자동 제재 룰 평가 (A5 §3.2)
--    triage_report(BEFORE INSERT)가 priority 를 확정한 뒤 실행되는 AFTER INSERT.
--    원칙: 자동 조치는 level 2 를 넘지 않는다 — level 3+ 는 반드시 사람(resolve_report).
-- -----------------------------------------------------------------------------
create or replace function public.apply_auto_sanctions()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_distinct_reporters integer;
  v_has_active_restriction boolean;
  v_sanction_id uuid;
  v_rule text := null;
begin
  -- 대상 없는 신고(피신고자 이미 탈퇴 등)는 자동 제재 불가 — 사람 큐로만
  if new.target_id is null then
    return new;
  end if;

  -- CONTENT_SELF_HARM 은 제재가 아닌 보호 프로토콜 (A5 §2) — 자동 제재 제외
  if new.reason_code = 'CONTENT_SELF_HARM' then
    return new;
  end if;

  -- 중복 방지: 이미 활성 기능제한(level 2+)이 있으면 새 자동 제재를 쌓지 않는다
  --   (자동이든 사람이든 — 발신 정지 효과는 이미 걸려 있다)
  select exists (
    select 1 from public.sanctions s
    where s.profile_id = new.target_id
      and s.status = 'ACTIVE'
      and s.level >= 2
      and (s.ends_at is null or s.ends_at > now())
  ) into v_has_active_restriction;

  -- --- AUTO_P0_FREEZE: P0 신고 1건 → 즉시 임시조치 (사람 확인 SLA = sla_due_at +1h)
  if new.priority = 'P0' and not v_has_active_restriction then
    v_rule := 'AUTO_P0_FREEZE';

  -- --- AUTO_3REPORTS: 서로 다른 신고자 3인 / 30일 (기각(DISMISSED)된 신고 제외)
  elsif not v_has_active_restriction then
    select count(distinct r.reporter_id) into v_distinct_reporters
    from public.reports r
    where r.target_id = new.target_id
      and r.reporter_id is not null
      and r.created_at >= now() - interval '30 days'
      and r.status <> 'DISMISSED';
    if v_distinct_reporters >= 3 then
      v_rule := 'AUTO_3REPORTS';
    end if;
  end if;

  if v_rule is null then
    return new;
  end if;

  -- level 2 (기능 제한 72h) — created_by null = 시스템 자동 조치.
  -- reason 은 피신고자에게 my_sanctions 뷰로 노출되므로 일반화 문구만 (신고자 비노출).
  insert into public.sanctions (profile_id, level, reason, report_id, ends_at, created_by)
  values (
    new.target_id,
    2,
    '커뮤니티 가이드라인 위반 검토를 위한 임시 이용 제한이에요. 24시간 내 확인 후 안내드릴게요.',
    new.id,
    now() + interval '72 hours',
    null
  )
  returning id into v_sanction_id;

  -- 큐 반영: AUTO_TRIAGED 전이 + P2 였다면 P1 으로 승급 (AUTO_3REPORTS → 큐 P1)
  update public.reports
  set status   = 'AUTO_TRIAGED',
      priority = case when priority = 'P2' then 'P1'::public.report_priority else priority end
  where id = new.id;

  -- 감사로그 — 룰 ID·집계치는 여기(service role 전용)에만 (신고자 비노출 원칙)
  insert into public.audit_logs (actor_id, action, target, meta)
  values (
    null,
    'moderation.auto_sanction',
    'sanctions:' || v_sanction_id::text,
    jsonb_build_object(
      'rule', v_rule,
      'report_id', new.id,
      'target_id', new.target_id,
      'reason_code', new.reason_code,
      'priority', new.priority,
      'distinct_reporters_30d', coalesce(v_distinct_reporters, 1)
    )
  );

  return new;
end;
$$;

-- AFTER INSERT — BEFORE 인 trg_reports_triage 다음에 실행되는 것이 보장된다
create trigger trg_reports_auto_sanctions
  after insert on public.reports
  for each row execute function public.apply_auto_sanctions();

-- -----------------------------------------------------------------------------
-- 2. resolve_report(report_id, action, admin_id, ...) — 조치 확정 (A5 §6-④)
--    service role 전용 (D8 어드민 서버 라우트가 호출).
--    p_action: 'DISMISS' | 'LEVEL_1' .. 'LEVEL_5'
--    4-eyes: LEVEL_5(영구정지)는 p_second_admin_id (다른 어드민) 필수.
--    부수효과: LEVEL_5 → profiles.status=banned + identity_hashes 의 CI 해시를
--      blocked_hashes 에 등록 (phone 해시는 저장처가 없어 D8 서버 몫 — 규약).
--    같은 report 의 자동 임시 제재는 확정 제재로 대체(REVOKED) 된다.
--    반환: { report_id, status, sanction_id, sla_met, handled_at }
-- -----------------------------------------------------------------------------
create or replace function public.resolve_report(
  p_report_id uuid,
  p_action text,
  p_admin_id uuid,
  p_reason text default null,
  p_second_admin_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_report      public.reports%rowtype;
  v_level       smallint;
  v_ends_at     timestamptz;
  v_sanction_id uuid := null;
  v_handled_at  timestamptz := now();
  v_new_status  public.report_status;
begin
  if p_action not in ('DISMISS', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5') then
    raise exception 'DUCKMATE_RESOLVE_INVALID_ACTION: %', p_action;
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'DUCKMATE_REPORT_NOT_FOUND: %', p_report_id;
  end if;
  if v_report.status not in ('RECEIVED', 'AUTO_TRIAGED', 'IN_REVIEW') then
    raise exception 'DUCKMATE_REPORT_ALREADY_RESOLVED: % (status=%)', p_report_id, v_report.status;
  end if;

  -- 처리자 자격: 활성 admin
  if not exists (select 1 from public.profiles
                 where id = p_admin_id and role = 'admin' and status = 'active') then
    raise exception 'DUCKMATE_RESOLVE_NOT_ADMIN: %', p_admin_id;
  end if;

  -- 4-eyes: 영구정지(level 5)는 서로 다른 활성 어드민 2인 승인 (A5 §6-④)
  if p_action = 'LEVEL_5' then
    if p_second_admin_id is null or p_second_admin_id = p_admin_id then
      raise exception 'DUCKMATE_RESOLVE_4EYES_REQUIRED: level 5 는 다른 어드민 1인의 추가 승인이 필요하다';
    end if;
    if not exists (select 1 from public.profiles
                   where id = p_second_admin_id and role = 'admin' and status = 'active') then
      raise exception 'DUCKMATE_RESOLVE_4EYES_NOT_ADMIN: %', p_second_admin_id;
    end if;
  end if;

  -- 이 신고가 만든 자동 임시 제재는 사람 결정으로 대체/해제된다 (A5 §3.2 "확정/해제")
  --   DISMISS → 해제, 제재 확정 → 아래에서 새 sanctions 행이 대체.
  update public.sanctions
  set status = 'REVOKED'
  where report_id = p_report_id
    and created_by is null
    and status = 'ACTIVE';

  if p_action = 'DISMISS' then
    v_new_status := 'DISMISSED';
  else
    v_new_status := 'ACTIONED';
    v_level := substring(p_action from 7)::smallint;

    if v_report.target_id is null then
      raise exception 'DUCKMATE_RESOLVE_TARGET_GONE: 피신고자 프로필이 없어 제재를 부과할 수 없다';
    end if;

    -- 제재 기간 (A5 §3.1): 1=기록 1년, 2=72h, 3=7일, 4=30일, 5=영구(null)
    v_ends_at := case v_level
      when 1 then now() + interval '1 year'
      when 2 then now() + interval '72 hours'
      when 3 then now() + interval '7 days'
      when 4 then now() + interval '30 days'
      else null
    end;

    insert into public.sanctions (profile_id, level, reason, report_id, ends_at, created_by)
    values (
      v_report.target_id,
      v_level,
      coalesce(p_reason, '커뮤니티 가이드라인 위반'),
      p_report_id,
      v_ends_at,
      p_admin_id
    )
    returning id into v_sanction_id;

    -- level 5: 계정 영구정지 + CI 해시 블랙리스트 (재가입 차단, A5 §3.1)
    if v_level = 5 then
      update public.profiles set status = 'banned' where id = v_report.target_id;
      insert into public.blocked_hashes (hash_type, hash, reason, sanction_id)
      select 'ci', ih.ci_hash, 'sanction level 5', v_sanction_id
      from public.identity_hashes ih
      where ih.profile_id = v_report.target_id
      on conflict (hash_type, hash) do nothing;
      -- phone 해시는 DB 에 저장처가 없다 — D8 서버 라우트가 보유 시 등록(규약)
    end if;
  end if;

  update public.reports
  set status = v_new_status, handled_by = p_admin_id, handled_at = v_handled_at
  where id = p_report_id;

  insert into public.audit_logs (actor_id, action, target, meta)
  values (
    p_admin_id,
    'moderation.resolve_report',
    'reports:' || p_report_id::text,
    jsonb_build_object(
      'action', p_action,
      'sanction_id', v_sanction_id,
      'second_admin_id', p_second_admin_id,
      'sla_due_at', v_report.sla_due_at,
      'sla_met', (v_report.sla_due_at is null or v_handled_at <= v_report.sla_due_at)
    )
  );

  return jsonb_build_object(
    'report_id', p_report_id,
    'status', v_new_status,
    'sanction_id', v_sanction_id,
    'handled_at', v_handled_at,
    'sla_met', (v_report.sla_due_at is null or v_handled_at <= v_report.sla_due_at)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. mark_report_notified(report_id) — 통보 완료 전이 (A5 §6-⑤)
--    service role 전용. D7(알림)/D8 이 신고자·피신고자 통보 발송 후 호출한다.
-- -----------------------------------------------------------------------------
create or replace function public.mark_report_notified(p_report_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.report_status;
begin
  select status into v_status from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'DUCKMATE_REPORT_NOT_FOUND: %', p_report_id;
  end if;
  if v_status not in ('ACTIONED', 'DISMISSED') then
    raise exception 'DUCKMATE_NOTIFY_INVALID_STATE: % (status=%)', p_report_id, v_status;
  end if;

  update public.reports set status = 'NOTIFIED' where id = p_report_id;

  insert into public.audit_logs (actor_id, action, target, meta)
  values (null, 'moderation.report_notified', 'reports:' || p_report_id::text, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. submit_appeal(sanction_id, body) — 이의제기 접수 (A5 §3.3)
--    authenticated RPC (본인 세션으로 호출 — D5 Server Action submitAppeal).
--    검증: 내 제재 + 통보(제재 생성) 후 30일 내 + 건당 1회(appeals.sanction_id unique)
--    부수효과: sanctions.appeal_status = 'PENDING' 동기화. 처리 기한 7일은
--    resolve_appeal / D8 큐(idx_appeals_queue, created_at 순)가 집행한다.
-- -----------------------------------------------------------------------------
create or replace function public.submit_appeal(p_sanction_id uuid, p_body text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_sanction   public.sanctions%rowtype;
  v_appeal_id  uuid;
begin
  if v_profile_id is null then
    raise exception 'DUCKMATE_APPEAL_AUTH_REQUIRED';
  end if;
  if p_body is null or char_length(trim(p_body)) < 10 or char_length(p_body) > 2000 then
    raise exception 'DUCKMATE_APPEAL_BODY_INVALID: 10~2000자';
  end if;

  select * into v_sanction from public.sanctions where id = p_sanction_id for update;
  if not found or v_sanction.profile_id is distinct from v_profile_id then
    -- 존재 여부를 구분해 알려주지 않는다 (타인 제재 탐색 방지)
    raise exception 'DUCKMATE_APPEAL_NOT_ALLOWED';
  end if;
  if now() > v_sanction.created_at + interval '30 days' then
    raise exception 'DUCKMATE_APPEAL_WINDOW_EXPIRED: 통보 후 30일 이내에만 가능하다';
  end if;
  if v_sanction.appeal_status <> 'NONE'
     or exists (select 1 from public.appeals a where a.sanction_id = p_sanction_id) then
    raise exception 'DUCKMATE_APPEAL_DUPLICATE: 제재 건당 1회만 가능하다';
  end if;

  insert into public.appeals (sanction_id, profile_id, body)
  values (p_sanction_id, v_profile_id, p_body)
  returning id into v_appeal_id;

  update public.sanctions set appeal_status = 'PENDING' where id = p_sanction_id;

  insert into public.audit_logs (actor_id, action, target, meta)
  values (
    v_profile_id,
    'moderation.appeal_submitted',
    'appeals:' || v_appeal_id::text,
    jsonb_build_object('sanction_id', p_sanction_id,
                       'due_at', now() + interval '7 days')
  );

  return v_appeal_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. resolve_appeal(appeal_id, decision, admin_id, reason) — 이의제기 결정
--    service role 전용 (D8). 4-eyes: 원 제재 처리자(sanctions.created_by)와
--    다른 어드민만 결정 가능 (A5 §3.3-4).
--    ACCEPTED → 제재 REVOKED (+ level 5 면 계정 복구·블랙리스트 해제).
--    처리 중 제재 유지(집행정지 없음) — 결정 전까지 아무 것도 바꾸지 않는다.
--    반환: { appeal_id, decision, sanction_id, deadline_met }
-- -----------------------------------------------------------------------------
create or replace function public.resolve_appeal(
  p_appeal_id uuid,
  p_decision text,
  p_admin_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_appeal   public.appeals%rowtype;
  v_sanction public.sanctions%rowtype;
  v_decided_at timestamptz := now();
begin
  if p_decision not in ('ACCEPTED', 'REJECTED') then
    raise exception 'DUCKMATE_APPEAL_INVALID_DECISION: %', p_decision;
  end if;

  select * into v_appeal from public.appeals where id = p_appeal_id for update;
  if not found then
    raise exception 'DUCKMATE_APPEAL_NOT_FOUND: %', p_appeal_id;
  end if;
  if v_appeal.status <> 'PENDING' then
    raise exception 'DUCKMATE_APPEAL_ALREADY_DECIDED: % (status=%)', p_appeal_id, v_appeal.status;
  end if;

  select * into v_sanction from public.sanctions where id = v_appeal.sanction_id for update;
  if not found then
    raise exception 'DUCKMATE_APPEAL_SANCTION_GONE: %', v_appeal.sanction_id;
  end if;

  if not exists (select 1 from public.profiles
                 where id = p_admin_id and role = 'admin' and status = 'active') then
    raise exception 'DUCKMATE_APPEAL_NOT_ADMIN: %', p_admin_id;
  end if;

  -- 4-eyes: 원 제재 처리자와 다른 어드민 (자동 제재 created_by null 은 제약 없음)
  if v_sanction.created_by is not null and v_sanction.created_by = p_admin_id then
    raise exception 'DUCKMATE_APPEAL_4EYES_VIOLATION: 원 제재 처리자는 이의제기를 결정할 수 없다';
  end if;

  update public.appeals
  set status = p_decision::public.appeal_status,
      decided_by = p_admin_id,
      decided_at = v_decided_at,
      decided_reason = p_reason
  where id = p_appeal_id;

  update public.sanctions
  set appeal_status = p_decision::public.appeal_status
  where id = v_sanction.id;

  if p_decision = 'ACCEPTED' then
    -- 인용: 제재 REVOKED (이력은 남되 효력 소멸 — A5 §3.3)
    update public.sanctions set status = 'REVOKED' where id = v_sanction.id;

    if v_sanction.level = 5 and v_sanction.profile_id is not null then
      -- 영구정지 인용 → 계정 복구 + 재가입 차단 해제
      update public.profiles set status = 'active'
      where id = v_sanction.profile_id and status = 'banned';
      delete from public.blocked_hashes where sanction_id = v_sanction.id;
    end if;
    -- 정지 기간만큼 구독 보상은 결제 원장(D6/D8) 소관 — audit meta 로 신호만 남긴다
  end if;

  insert into public.audit_logs (actor_id, action, target, meta)
  values (
    p_admin_id,
    'moderation.resolve_appeal',
    'appeals:' || p_appeal_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'sanction_id', v_sanction.id,
      'sanction_level', v_sanction.level,
      'original_sanction_admin', v_sanction.created_by,
      'deadline_met', v_decided_at <= v_appeal.created_at + interval '7 days',
      'subscription_compensation_needed',
        (p_decision = 'ACCEPTED' and v_sanction.level >= 3)
    )
  );

  return jsonb_build_object(
    'appeal_id', p_appeal_id,
    'decision', p_decision,
    'sanction_id', v_sanction.id,
    'deadline_met', v_decided_at <= v_appeal.created_at + interval '7 days'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. 실행 권한 — 00004 원칙과 동일: 쓰기 definer 함수는 service role 전용.
--    submit_appeal 만 본인 세션(authenticated) 호출 허용.
-- -----------------------------------------------------------------------------
revoke execute on function public.resolve_report(uuid, text, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.mark_report_notified(uuid) from public, anon, authenticated;
revoke execute on function public.resolve_appeal(uuid, text, uuid, text) from public, anon, authenticated;

revoke execute on function public.submit_appeal(uuid, text) from public, anon;
grant execute on function public.submit_appeal(uuid, text) to authenticated;

-- sanctions(report_id) 역조회 (자동 제재 대체·어드민 상세) — 00002 에 없던 인덱스
create index idx_sanctions_report on public.sanctions (report_id) where report_id is not null;
