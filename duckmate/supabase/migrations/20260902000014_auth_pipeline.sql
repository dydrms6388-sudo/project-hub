-- =============================================================================
-- 0014 — auth pipeline (D2)
--   · consent_key 에 youth_policy 추가(가입 동의 화면의 청소년보호정책 체크)
--   · photos.auto_flags (Edge Function photo-review 의 자동 검사 결과, 자동 반려 없음)
--   · rate_limits + check_rate_limit()  — 서버리스용 DB 레이트리밋(service role 전용)
--   · get_gate_state()                  — 미들웨어/레이아웃 게이트 판정용 1회 조회
--   · create_profile()                  — OTP 성공 후 생년월일 확정(update). 미성년 → age_blocked(생년월일 미저장)
--   · set_mode() / request_delete() / cancel_delete() / pause_account() / resume_account()
--   · apply_identity_verification()     — 본인인증 결과 반영(service role 전용): blocked_ci → minor → duplicate → success
-- 모든 SECURITY DEFINER 함수는 search_path 를 고정한다. 새 함수는 PUBLIC/anon 실행 권한을 명시적으로 회수한다.
-- =============================================================================

-- ---------- enum / column 추가 ----------
alter type public.consent_key add value if not exists 'youth_policy';

alter table public.photos add column if not exists auto_flags jsonb not null default '{}'::jsonb;
comment on column public.photos.auto_flags is
  'photo-review Edge Function 의 자동 검사 결과(예: {"face":"unknown|none|one|many","detector":"none|external","resized":true}). 참고값. 자동 반려 금지(A5 §8). 임베딩 저장 금지.';

-- ---------- rate_limits (service role 전용, 고정 윈도우) ----------
create table public.rate_limits (
  key           text primary key,                 -- 예: otp_send:phone:<sha256> / otp_send:ip:<sha256>
  window_start  timestamptz not null,
  count         integer not null default 0,
  updated_at    timestamptz not null default now()
);
comment on table public.rate_limits is 'D2 레이트리밋 카운터. 키는 항상 해시(원문 IP/번호 저장 금지). D7 purge_daily 가 updated_at < now()-1day 삭제.';
alter table public.rate_limits enable row level security;   -- 정책 없음 = service role 전용
create index rate_limits_updated_idx on public.rate_limits (updated_at);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window interval)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits%rowtype;
begin
  if p_key is null or p_limit is null or p_limit < 1 or p_window is null then
    raise exception 'INVALID_INPUT: rate limit args' using errcode = 'check_violation';
  end if;
  insert into public.rate_limits as rl (key, window_start, count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set count        = case when rl.window_start + p_window <= v_now then 1 else rl.count + 1 end,
        window_start = case when rl.window_start + p_window <= v_now then v_now else rl.window_start end,
        updated_at   = v_now
  returning * into v_row;
  return jsonb_build_object(
    'allowed', v_row.count <= p_limit,
    'count', v_row.count,
    'limit', p_limit,
    'retry_after_sec', greatest(0, extract(epoch from (v_row.window_start + p_window - v_now))::integer)
  );
end $$;
comment on function public.check_rate_limit is '고정 윈도우 카운터. {allowed, count, limit, retry_after_sec}. 호출 자체가 1회 소비.';

-- ---------- 게이트 상태 1회 조회 (미들웨어 · (app)/(onboarding) layout) ----------
create or replace function public.get_gate_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into v_p from public.profiles where user_id = v_uid;
  if not found then
    return jsonb_build_object('profile_id', null, 'role', public.app_role());
  end if;
  return jsonb_build_object(
    'profile_id',          v_p.id,
    'status',              v_p.status,
    'onboarding_step',     v_p.onboarding_step,
    'verify_level',        v_p.verify_level,
    'mode',                v_p.mode,
    'has_birth_date',      v_p.birth_date is not null,
    'sanction_level',      public.active_sanction_level(v_p.id),
    'delete_requested_at', v_p.delete_requested_at,
    'hidden',              v_p.hidden_at is not null,
    'role',                public.app_role()
  );
end $$;
comment on function public.get_gate_state is '세션 사용자의 게이트 판정에 필요한 필드만 1회 조회. 프로필 없으면 profile_id=null.';

-- ---------- create_profile: OTP 성공 후 생년월일 확정 (insert 가 아니라 update, §0-15) ----------
create or replace function public.create_profile(p_birth_date date, p_phone_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then
    -- handle_new_user 트리거가 만들지 못한 예외 상황 방어
    insert into public.profiles (user_id, verify_level, status, mode, onboarding_step)
    values (v_uid, 0, 'active', 'friend', 'basic')
    returning * into v_p;
  end if;

  if v_p.status = 'age_blocked' then
    return jsonb_build_object('profile_id', v_p.id, 'status', v_p.status, 'age_blocked', true, 'onboarding_step', v_p.onboarding_step);
  end if;
  if v_p.status = 'banned' then
    raise exception 'SANCTIONED: banned' using errcode = '42501';
  end if;

  -- 이미 확정된 생년월일은 바꾸지 않는다(멱등). 재로그인·재시도 안전.
  if v_p.birth_date is not null then
    return jsonb_build_object('profile_id', v_p.id, 'status', v_p.status, 'age_blocked', false,
                              'onboarding_step', v_p.onboarding_step, 'already_set', true);
  end if;

  if p_birth_date is null or p_birth_date > (now() at time zone 'Asia/Seoul')::date or p_birth_date < date '1900-01-01' then
    raise exception 'INVALID_INPUT: birth_date' using errcode = 'check_violation';
  end if;

  -- 만 19세 미만(KST 만 나이): 생년월일·닉네임 미저장, phone_hash + age_blocked_at 만 30일 (B1 §0-14)
  if not public.is_adult(p_birth_date) then
    update public.profiles
    set status = 'age_blocked', age_blocked_at = now(), phone_hash = coalesce(p_phone_hash, phone_hash),
        birth_date = null, nickname = null,
        hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'age_blocked')
    where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
    values (v_uid, 'user', 'age_blocked', 'profile', v_p.id::text, '{}'::jsonb);
    return jsonb_build_object('profile_id', v_p.id, 'status', 'age_blocked', 'age_blocked', true, 'onboarding_step', v_p.onboarding_step);
  end if;

  update public.profiles
  set birth_date = p_birth_date, phone_hash = coalesce(p_phone_hash, phone_hash)
  where id = v_p.id;

  return jsonb_build_object('profile_id', v_p.id, 'status', v_p.status, 'age_blocked', false, 'onboarding_step', v_p.onboarding_step);
end $$;
comment on function public.create_profile is 'OTP 성공 직후 호출. 미성년이면 {age_blocked:true} 반환(서버 액션이 로그아웃 → /blocked/age).';

-- ---------- set_mode: 데이팅 모드는 L3 + seeking_gender 필수 ----------
create or replace function public.set_mode(p_mode public.profile_mode, p_seeking_gender public.seeking_gender default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status <> 'active' then raise exception 'NOT_ENTITLED: status %', v_p.status using errcode = '42501'; end if;
  if public.active_sanction_level(v_p.id) >= 3 then raise exception 'SANCTIONED' using errcode = '42501'; end if;
  if v_p.onboarding_step in ('basic', 'hobbies', 'quiz', 'card', 'photos') then
    raise exception 'ONBOARDING_INCOMPLETE' using errcode = '42501';
  end if;

  if p_mode = 'dating' then
    if v_p.verify_level < 3 then raise exception 'NOT_ENTITLED: dating mode requires verify_level 3' using errcode = '42501'; end if;
    if p_seeking_gender is null then raise exception 'INVALID_INPUT: seeking_gender' using errcode = 'check_violation'; end if;
    update public.profiles set mode = 'dating', seeking_gender = p_seeking_gender where id = v_p.id;
  else
    update public.profiles set mode = 'friend' where id = v_p.id;
  end if;

  if v_p.mode <> p_mode then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before, after)
    values (v_uid, 'user', 'mode_changed', 'profile', v_p.id::text,
            jsonb_build_object('mode', v_p.mode), jsonb_build_object('mode', p_mode));
  end if;
  return jsonb_build_object('mode', p_mode, 'seeking_gender', case when p_mode = 'dating' then p_seeking_gender else v_p.seeking_gender end);
end $$;

-- ---------- 계정 상태 RPC: 탈퇴 요청/취소, 휴면/해제 ----------
create or replace function public.request_delete()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status = 'banned' then raise exception 'SANCTIONED: banned' using errcode = '42501'; end if;
  if v_p.status <> 'deleting' then
    update public.profiles
    set status = 'deleting', delete_requested_at = now(),
        hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'deleting')
    where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
    values (v_uid, 'user', 'account_delete_requested', 'profile', v_p.id::text, jsonb_build_object('grace_days', 7));
  end if;
  return jsonb_build_object('status', 'deleting', 'delete_requested_at', coalesce(v_p.delete_requested_at, now()), 'purge_after', coalesce(v_p.delete_requested_at, now()) + interval '7 days');
end $$;

create or replace function public.cancel_delete()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status = 'deleting' then
    update public.profiles
    set status = 'active', delete_requested_at = null,
        hidden_at = case when hidden_reason = 'deleting' then null else hidden_at end,
        hidden_reason = case when hidden_reason = 'deleting' then null else hidden_reason end
    where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id)
    values (v_uid, 'user', 'account_delete_canceled', 'profile', v_p.id::text);
  end if;
  return jsonb_build_object('status', 'active');
end $$;

create or replace function public.pause_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status <> 'active' then raise exception 'NOT_ENTITLED: status %', v_p.status using errcode = '42501'; end if;
  update public.profiles set status = 'paused', paused_at = now() where id = v_p.id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  values (v_uid, 'user', 'account_paused', 'profile', v_p.id::text);
  return jsonb_build_object('status', 'paused');
end $$;

create or replace function public.resume_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status = 'paused' then
    update public.profiles set status = 'active', paused_at = null where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id)
    values (v_uid, 'user', 'account_resumed', 'profile', v_p.id::text);
  end if;
  return jsonb_build_object('status', (select status from public.profiles where id = v_p.id));
end $$;

-- ---------- apply_identity_verification (service role 전용) ----------
-- 순서: failed → blocked_ci → minor(즉시 영구정지+CI 블록) → duplicate_ci → success(생년 재검증 → 불일치면 인증값 우선 + MINOR_SUSPECT 신고 큐)
-- 이름·원문 CI/DI 는 절대 받지 않는다(해시만). 레벨 갱신은 identity_verifications 트리거 → recompute_verify_level.
create or replace function public.apply_identity_verification(
  p_user_id        uuid,
  p_provider       public.identity_provider,
  p_result         public.identity_result,      -- 호출자는 'success' | 'failed' 만 전달. 나머지는 이 함수가 판정
  p_ci_hash        text default null,
  p_di_hash        text default null,
  p_birth_date     date default null,
  p_gender         public.gender default null,
  p_provider_tx_id text default null,
  p_meta           jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p            public.profiles%rowtype;
  v_id           uuid;
  v_mismatch     boolean := false;
  v_report       jsonb;
  v_level        smallint;
begin
  if p_user_id is null then raise exception 'INVALID_INPUT: user_id' using errcode = 'check_violation'; end if;
  select * into v_p from public.profiles where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND: profile' using errcode = 'no_data_found'; end if;
  if v_p.status in ('banned', 'age_blocked') then
    raise exception 'SANCTIONED: %', v_p.status using errcode = '42501';
  end if;

  -- 1) 프로바이더 실패 / CI 없음
  if p_result <> 'success' or p_ci_hash is null then
    insert into public.identity_verifications (user_id, profile_id, provider, result, is_active, provider_tx_id, meta)
    values (p_user_id, v_p.id, p_provider, 'failed', false, p_provider_tx_id, coalesce(p_meta, '{}'::jsonb))
    returning id into v_id;
    return jsonb_build_object('ok', false, 'code', 'FAILED', 'verification_id', v_id);
  end if;

  -- 2) 블록리스트 CI (영구정지·미성년 확정 재가입 차단)
  if exists (select 1 from public.blocked_ci_hashes b where b.ci_hash = p_ci_hash and (b.expires_at is null or b.expires_at > now())) then
    insert into public.identity_verifications (user_id, profile_id, provider, result, ci_hash, di_hash, is_active, provider_tx_id, meta)
    values (p_user_id, v_p.id, p_provider, 'blocked_ci', p_ci_hash, p_di_hash, false, p_provider_tx_id, coalesce(p_meta, '{}'::jsonb))
    returning id into v_id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
    values (null, 'service', 'identity_blocked_ci', 'profile', v_p.id::text, jsonb_build_object('verification_id', v_id));
    return jsonb_build_object('ok', false, 'code', 'BLOCKED_CI', 'verification_id', v_id);
  end if;

  -- 3) 인증 생년월일이 미성년 → 즉시 영구정지 + CI 블록 + 사진 삭제 (A5 §2.1-2, 자동 6 유일 예외)
  if p_birth_date is not null and not public.is_adult(p_birth_date) then
    insert into public.identity_verifications (user_id, profile_id, provider, result, ci_hash, di_hash, birth_date, gender, birth_date_verified, is_active, provider_tx_id, meta)
    values (p_user_id, v_p.id, p_provider, 'minor', p_ci_hash, p_di_hash, p_birth_date, p_gender, false, false, p_provider_tx_id, coalesce(p_meta, '{}'::jsonb))
    returning id into v_id;
    insert into public.blocked_ci_hashes (ci_hash, reason, source_profile_id, expires_at)
    values (p_ci_hash, 'MINOR_CONFIRMED', v_p.id, null)
    on conflict (ci_hash) do nothing;
    delete from public.photos where profile_id = v_p.id;          -- 파일 삭제는 서버 액션(admin storage)이 이어서 수행
    perform public.issue_sanction(v_p.id, 6, 'AUTO:MINOR_CONFIRMED', null, null, 'MINOR_SUSPECT', null);  -- 트리거: banned + 매칭 paused
    update public.profiles set birth_date = null where id = v_p.id;  -- 미성년 생년월일 미보관(인증 행에는 남김: 5년 후 purge)
    return jsonb_build_object('ok', false, 'code', 'MINOR', 'verification_id', v_id);
  end if;

  -- 4) 다른 활성 계정이 같은 CI 를 쓰는 중 (중복 가입)
  if exists (
    select 1 from public.identity_verifications iv
    where iv.ci_hash = p_ci_hash and iv.result = 'success' and iv.is_active and iv.user_id is distinct from p_user_id
  ) then
    insert into public.identity_verifications (user_id, profile_id, provider, result, ci_hash, di_hash, is_active, provider_tx_id, meta)
    values (p_user_id, v_p.id, p_provider, 'duplicate_ci', p_ci_hash, p_di_hash, false, p_provider_tx_id, coalesce(p_meta, '{}'::jsonb))
    returning id into v_id;
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_CI', 'verification_id', v_id);
  end if;

  -- 5) 성공: 같은 사용자의 이전 활성 성공 행은 비활성(재인증)
  update public.identity_verifications set is_active = false
  where user_id = p_user_id and result = 'success' and is_active;

  -- 생년 재검증: 입력값과 불일치(둘 다 성인)면 인증값 우선 + audit + MINOR_SUSPECT 신고 큐(사람 확인)
  v_mismatch := v_p.birth_date is not null and p_birth_date is not null and v_p.birth_date <> p_birth_date;
  if p_birth_date is not null and (v_p.birth_date is null or v_mismatch) then
    update public.profiles set birth_date = p_birth_date where id = v_p.id;
  end if;
  if v_mismatch then
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before, after, meta)
    values (null, 'service', 'birth_date_overridden_by_identity', 'profile', v_p.id::text,
            jsonb_build_object('birth_year', extract(year from v_p.birth_date)::int),
            jsonb_build_object('birth_year', extract(year from p_birth_date)::int),
            jsonb_build_object('provider', p_provider));
    v_report := public.create_report(
      v_p.id, 'MINOR_SUSPECT',
      'AUTO:BIRTH_DATE_MISMATCH 입력 생년월일과 본인인증 생년월일이 다릅니다(둘 다 성인). 인증값으로 덮어썼습니다. 사람 확인 요망.',
      null, 'system', null);
  end if;

  insert into public.identity_verifications (user_id, profile_id, provider, result, ci_hash, di_hash, birth_date, gender, birth_date_verified, verified_at, is_active, provider_tx_id, meta)
  values (p_user_id, v_p.id, p_provider, 'success', p_ci_hash, p_di_hash, p_birth_date, p_gender, not v_mismatch, now(), true, p_provider_tx_id, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;   -- 트리거 → recompute_verify_level

  -- 인증 결과 성인 확인 → MINOR_SUSPECT 로 인한 비노출은 자동 복구(A5 §7.5). 다른 사유의 비노출은 유지.
  update public.profiles set hidden_at = null, hidden_reason = null
  where id = v_p.id and hidden_reason = 'MINOR_SUSPECT';

  -- 온보딩 6화면을 마친 상태(verify)였다면 done 으로
  update public.profiles set onboarding_step = 'done' where id = v_p.id and onboarding_step = 'verify';

  select verify_level into v_level from public.profiles where id = v_p.id;
  return jsonb_build_object('ok', true, 'code', 'OK', 'verification_id', v_id, 'verify_level', v_level,
                            'birth_date_verified', not v_mismatch, 'report', v_report);
end $$;
comment on function public.apply_identity_verification is
  'service role 전용. IdentityVerifier.verify() 결과(해시만)를 반영. 반환 code: OK | FAILED | BLOCKED_CI | MINOR | DUPLICATE_CI.';

-- ---------- 권한 ----------
-- Supabase 기본 default privileges 는 새 함수 execute 를 anon/authenticated/service_role 에 자동 부여한다.
-- 따라서 service role 전용 함수는 authenticated 에서도 명시적으로 회수해야 한다(0009 의 service 전용 3종 포함, 방어적 재적용).
revoke execute on function
  public.check_rate_limit(text, integer, interval),
  public.apply_identity_verification(uuid, public.identity_provider, public.identity_result, text, text, date, public.gender, text, jsonb),
  public.recompute_verify_level(uuid),
  public.issue_sanction(uuid, integer, text, interval, uuid, public.report_reason, uuid),
  public.apply_block_internal(uuid, uuid)
from public, anon, authenticated;

revoke execute on function
  public.check_rate_limit(text, integer, interval),
  public.get_gate_state(),
  public.create_profile(date, text),
  public.set_mode(public.profile_mode, public.seeking_gender),
  public.request_delete(), public.cancel_delete(), public.pause_account(), public.resume_account(),
  public.apply_identity_verification(uuid, public.identity_provider, public.identity_result, text, text, date, public.gender, text, jsonb)
from public, anon;

grant execute on function
  public.get_gate_state(),
  public.create_profile(date, text),
  public.set_mode(public.profile_mode, public.seeking_gender),
  public.request_delete(), public.cancel_delete(), public.pause_account(), public.resume_account()
to authenticated, service_role;

grant execute on function
  public.check_rate_limit(text, integer, interval),
  public.apply_identity_verification(uuid, public.identity_provider, public.identity_result, text, text, date, public.gender, text, jsonb)
to service_role;
