-- =============================================================================
-- 0071 — Phase 1 hardening (H1)
--   D·G 그룹이 남긴 병합 요청·미결을 백엔드에서 처리한다. 기존 함수 시그니처는 유지(request_delete 만 인자 추가 — 아래 §E 참고),
--   전부 멱등(create or replace / if not exists / drop policy if exists).
--   A. notify_admin → notify_admin_push 즉시 위임 (20_notifications §0-13)
--   B. messages.suggestion_template_id / send_message 8번째 인자 — 0004·0030 에 이미 존재함을 확인(멱등 add column)
--   C. daily_recommendations 60일 삭제 (16_matching §7-5) — purge_old_recommendations()
--   D. 탈퇴 purge 판정: profiles 행을 tombstone(가명화) 으로 남기고 매칭·메시지를 90일 보존 → purge_tombstones() 가 최종 삭제
--      (18_moderation §7 "탈퇴 시 매칭 보존" / 0042 주석의 설계 의도 복원). profiles.user_id nullable + purged_at·purge_after 컬럼.
--   E. request_delete(p_immediate boolean default false) — 즉시 삭제 옵션 (25_fe_profile §4 / 07_legal 결정 21)
--   F. active_sanction_level(uuid) 타인 조회 가드 (G2-12): 본인 또는 trusted caller(service/정의자 함수 내부/모더레이터)
--   G. admin_review_photo 가 held 를 받는다 (21_admin §0-10) — audit photo_held, 사용자 통보 없음
--   H. issue_sanction 의 audit actor_role: app_role() 이 null(service role 호출)이면 admin_users 에서 채움 (21_admin §0-5)
--   I. moderation_notifications / moderation_jobs 30일 정리 — purge_moderation_queues() (18_moderation §8 D7 행)
--   J. v_my_matches / get_chat_list 에 partner_deleted 추가 (탈퇴한 사용자 방 표시용, 컬럼은 끝에 추가)
--   K. moderation_daily() 가 C·D·I 를 함께 실행
-- =============================================================================

-- ---------- A. notify_admin → notify_admin_push 즉시 위임 ----------
-- moderation_notifications 행은 감사 추적용으로 남기되(delivered_at 즉시 채움) 실제 큐잉은 admin_notifications + admin_alert 푸시.
-- notify_admin_push 가 실패하면 행을 미전달로 남겨 drain_moderation_notifications(5분) 이 재시도한다.
create or replace function public.notify_admin(p_kind text, p_payload jsonb default '{}'::jsonb, p_report_id uuid default null, p_sanction_id uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_admin_id bigint;
begin
  insert into public.moderation_notifications (audience, kind, report_id, sanction_id, payload)
  values ('admin', p_kind, p_report_id, p_sanction_id, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  begin
    v_admin_id := public.notify_admin_push(p_kind,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('report_id', p_report_id, 'sanction_id', p_sanction_id), v_id);
    update public.moderation_notifications
    set delivered_at = now(),
        delivery = jsonb_build_object('channel', 'admin_notifications', 'ok', true, 'admin_notification_id', v_admin_id, 'immediate', true)
    where id = v_id;
  exception when others then
    raise notice 'notify_admin: notify_admin_push failed (% ) — left for drain', sqlerrm;
  end;
  return v_id;
end $$;
comment on function public.notify_admin is
  'H1(0071): moderation_notifications 행 insert + notify_admin_push 즉시 위임(admin_notifications + admin_alert 푸시). 큐 행 id 반환. 위임 실패 시 drain 이 재시도.';

-- ---------- B. suggestion_template_id (D4 요청) — 0004 컬럼·0030 send_message 8번째 인자에 이미 존재. 멱등 확인만 ----------
alter table public.messages add column if not exists suggestion_template_id text;
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'send_message' and p.pronargs = 8
  ) then
    raise exception '0071: send_message(…, p_suggestion_template_id) expected from 0030';
  end if;
end $$;

-- ---------- C. daily_recommendations 60일 삭제 ----------
create or replace function public.purge_old_recommendations(p_days integer default 60)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from public.daily_recommendations
  where loop_date < public.loop_date(now()) - greatest(coalesce(p_days, 60), 7);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
comment on function public.purge_old_recommendations is 'loop_date < 오늘-60 인 추천 행 삭제(16_matching §0-19). moderation_daily 가 호출.';

-- ---------- D. 탈퇴 purge: tombstone ----------
-- 판정: FK 를 restrict 로 바꾸거나 matches.a_id/b_id 를 nullable 로 만드는 대신, profiles 행을 남기고 개인정보만 지운다(가명화).
--   · 상대 화면: 매칭 행·메시지가 남아 "탈퇴한 사용자" 방(90일)이 유지된다(FE 는 partner_nickname null 을 이미 "탈퇴한 사용자"로 표시).
--   · 개인정보: nickname·birth_date·gender·seeking_gender·region·bio·now_into·phone_hash 는 null, verify_level 0, 사진/취미/퀴즈/가용시간/
--     좋아요/추천/차단/플래그/게임 행 삭제, auth.users 삭제(user_id null → cascade 차단). 신고·제재·동의는 0042 와 동일하게 CI 해시 대체키로 보존.
--   · 90일 뒤 purge_tombstones() 가 종료 매칭(→ 메시지 cascade) 과 매칭이 남지 않은 tombstone 행을 삭제한다.
alter table public.profiles alter column user_id drop not null;
alter table public.profiles add column if not exists purged_at timestamptz;
alter table public.profiles add column if not exists purge_after timestamptz;
comment on column public.profiles.user_id is 'auth.users.id. 탈퇴 purge 후 tombstone(purged_at not null) 행은 null.';
comment on column public.profiles.purged_at is 'H1: 탈퇴 purge 완료 시각(tombstone). 매칭 90일 보존 후 purge_tombstones 가 행 삭제.';
comment on column public.profiles.purge_after is 'H1: 즉시 삭제(request_delete(true)) 시 now(). null 이면 delete_requested_at + delete_grace_days.';
create index if not exists profiles_purge_due_idx on public.profiles (coalesce(purge_after, delete_requested_at))
  where status = 'deleting' and purged_at is null;

create or replace function public.purge_deleted_profiles(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_grace integer := public.moderation_setting_int('delete_grace_days', 7);
  r record;
  v_ci text;
  v_paths text[];
  v_matches integer;
  v_done uuid[] := '{}';
  v_summary jsonb := '[]'::jsonb;
begin
  for r in
    select p.id, p.user_id, p.delete_requested_at, p.purge_after
    from public.profiles p
    where p.status = 'deleting' and p.purged_at is null and p.delete_requested_at is not null
      and coalesce(p.purge_after, p.delete_requested_at + make_interval(days => v_grace)) < now()
    order by coalesce(p.purge_after, p.delete_requested_at)
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    -- CI 해시(활성 성공 행 우선, 없으면 최근 성공 행)
    v_ci := null;
    select iv.ci_hash into v_ci from public.identity_verifications iv
    where iv.user_id = r.user_id and iv.result = 'success' and iv.ci_hash is not null
    order by iv.is_active desc, iv.created_at desc limit 1;

    update public.reports set reporter_ci_hash = coalesce(reporter_ci_hash, v_ci) where reporter_id = r.id;
    update public.reports set target_ci_hash   = coalesce(target_ci_hash, v_ci)   where target_id = r.id;
    update public.sanctions set profile_ci_hash = coalesce(profile_ci_hash, v_ci) where profile_id = r.id;
    update public.consents set subject_hash = coalesce(subject_hash, v_ci, encode(extensions.gen_random_bytes(16), 'hex')), user_id = null
    where user_id = r.user_id;
    update public.identity_verifications set is_active = false, user_id = null, profile_id = null where user_id = r.user_id;

    -- 사진 파일 삭제 작업 (photos 버킷). 증거 버킷 사본은 보존(A5 §5.2 탈퇴 영향 없음)
    select coalesce(array_agg(path), '{}') into v_paths from public.photos where profile_id = r.id;
    if array_length(v_paths, 1) is not null then
      insert into public.moderation_jobs (kind, payload)
      values ('storage_delete', jsonb_build_object('bucket', 'photos', 'paths', to_jsonb(v_paths), 'profile_id', r.id));
    end if;

    -- 개인정보·행동 데이터 행 삭제 (profiles 행은 남기므로 cascade 가 돌지 않는다 → 명시 삭제)
    delete from public.photos where profile_id = r.id;
    delete from public.profile_hobbies where profile_id = r.id;
    delete from public.quiz_answers where profile_id = r.id;
    delete from public.availability where profile_id = r.id;
    delete from public.likes where from_id = r.id or to_id = r.id;
    delete from public.daily_recommendations where profile_id = r.id or target_id = r.id;
    delete from public.blocks where blocker_id = r.id or blocked_id = r.id;
    delete from public.moderation_flags where profile_id = r.id;
    delete from public.push_queue where profile_id = r.id;
    delete from public.game_profiles where profile_id = r.id;
    delete from public.quest_progress where profile_id = r.id;
    delete from public.event_rsvps where profile_id = r.id;

    -- 매칭: 진행 중이면 left 로 종료(상대에게 match_status 브로드캐스트). 행은 90일 보존 → purge_tombstones
    update public.matches set status = 'left', ended_at = coalesce(ended_at, now())
    where status in ('active', 'paused') and r.id in (a_id, b_id);
    select count(*)::integer into v_matches from public.matches where r.id in (a_id, b_id);

    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('system', 'profile_purged', 'profile', r.id::text,
            jsonb_build_object('delete_requested_at', r.delete_requested_at, 'grace_days', v_grace, 'immediate', r.purge_after is not null,
                               'ci_hash_kept', v_ci is not null, 'photo_files', coalesce(array_length(v_paths, 1), 0),
                               'matches_kept', v_matches, 'tombstone', v_matches > 0));

    -- auth.users 삭제 전에 user_id 를 끊어 profiles cascade 를 막는다(consents·identity_verifications 는 위에서 set null 완료)
    update public.profiles set user_id = null where id = r.id;
    if r.user_id is not null then delete from auth.users where id = r.user_id; end if;

    if v_matches = 0 then
      delete from public.profiles where id = r.id;      -- 남길 매칭이 없으면 즉시 완전 삭제
    else
      update public.profiles
      set nickname = null, nickname_changed_at = null, birth_date = null, gender = null, seeking_gender = null,
          region_code = null, bio = null, now_into = null, phone_hash = null,
          verify_level = 0, mode = 'friend',
          hidden_at = coalesce(hidden_at, now()), hidden_reason = 'purged',
          purged_at = now()
      where id = r.id;
    end if;

    v_done := v_done || r.id;
    v_summary := v_summary || jsonb_build_object('profile_id', r.id, 'photo_files', coalesce(array_length(v_paths, 1), 0), 'matches_kept', v_matches);
  end loop;

  return jsonb_build_object('purged', coalesce(array_length(v_done, 1), 0), 'profiles', v_summary, 'checked_at', now());
end $$;
comment on function public.purge_deleted_profiles is
  'H1(0071): request_delete 후 delete_grace_days(7) 경과(또는 purge_after 경과) 계정 삭제. 매칭이 있으면 profiles 행을 tombstone(가명화)으로 남겨 상대 방을 90일 보존. 신고/제재/CI 해시/동의(가명화)/감사로그 보존.';

create or replace function public.purge_tombstones(p_retention_days integer default 90)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_matches integer; v_profiles integer; v_days integer := greatest(coalesce(p_retention_days, 90), 1);
begin
  -- 탈퇴 회원이 낀 종료 매칭 90일 경과 → 매칭 삭제(messages cascade, reports.match_id set null)
  delete from public.matches m
  where exists (select 1 from public.profiles p where p.id in (m.a_id, m.b_id) and p.purged_at is not null)
    and coalesce(m.ended_at, m.updated_at) < now() - make_interval(days => v_days);
  get diagnostics v_matches = row_count;
  -- 매칭이 더 없는 tombstone 행 삭제
  delete from public.profiles p
  where p.purged_at is not null
    and not exists (select 1 from public.matches m where p.id in (m.a_id, m.b_id));
  get diagnostics v_profiles = row_count;
  if v_matches > 0 or v_profiles > 0 then
    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('system', 'tombstones_purged', 'profile', null, jsonb_build_object('matches', v_matches, 'profiles', v_profiles, 'retention_days', v_days));
  end if;
  return jsonb_build_object('matches', v_matches, 'profiles', v_profiles, 'checked_at', now());
end $$;
comment on function public.purge_tombstones is 'H1: 탈퇴 tombstone 의 종료 매칭 90일 경과분과 매칭 없는 tombstone 행을 삭제. moderation_daily 가 호출.';

-- ---------- E. request_delete(p_immediate) / cancel_delete ----------
-- 기존 request_delete() 는 제거하고 default 인자 하나로 대체한다(PostgREST 오버로드 모호성 회피). rpc('request_delete') 호출은 그대로 동작.
drop function if exists public.request_delete();
create or replace function public.request_delete(p_immediate boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_grace integer := public.moderation_setting_int('delete_grace_days', 7);
  v_requested timestamptz;
  v_purge_after timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status = 'banned' then raise exception 'SANCTIONED: banned' using errcode = '42501'; end if;

  if v_p.status <> 'deleting' then
    v_requested := now();
    v_purge_after := case when coalesce(p_immediate, false) then now() else null end;
    update public.profiles
    set status = 'deleting', delete_requested_at = v_requested, purge_after = v_purge_after,
        hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'deleting')
    where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
    values (v_uid, 'user', 'account_delete_requested', 'profile', v_p.id::text,
            jsonb_build_object('grace_days', case when coalesce(p_immediate, false) then 0 else v_grace end, 'immediate', coalesce(p_immediate, false)));
  else
    v_requested := v_p.delete_requested_at;
    v_purge_after := v_p.purge_after;
    -- 유예 중 "지금 바로 삭제" 로 격상만 허용(되돌리기는 cancel_delete)
    if coalesce(p_immediate, false) and v_p.purge_after is null then
      v_purge_after := now();
      update public.profiles set purge_after = v_purge_after where id = v_p.id;
      insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
      values (v_uid, 'user', 'account_delete_requested', 'profile', v_p.id::text, jsonb_build_object('grace_days', 0, 'immediate', true, 'upgraded', true));
    end if;
  end if;

  return jsonb_build_object(
    'status', 'deleting',
    'delete_requested_at', v_requested,
    'immediate', v_purge_after is not null,
    'purge_after', coalesce(v_purge_after, v_requested + make_interval(days => v_grace)));
end $$;
comment on function public.request_delete is
  'H1(0071): 탈퇴 요청. p_immediate=true 면 7일 유예 없이 purge 대상(purge_after=now(); 실제 삭제는 purge_deleted_profiles — 서버 액션이 service role 로 즉시 호출 가능). 법적 보존은 동일.';

create or replace function public.cancel_delete()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_p from public.profiles where user_id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if v_p.status = 'deleting' then
    update public.profiles
    set status = 'active', delete_requested_at = null, purge_after = null,
        hidden_at = case when hidden_reason = 'deleting' then null else hidden_at end,
        hidden_reason = case when hidden_reason = 'deleting' then null else hidden_reason end
    where id = v_p.id;
    insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id)
    values (v_uid, 'user', 'account_delete_canceled', 'profile', v_p.id::text);
  end if;
  return jsonb_build_object('status', 'active');
end $$;

revoke execute on function public.request_delete(boolean) from public, anon;
grant execute on function public.request_delete(boolean) to authenticated, service_role;

-- ---------- F. active_sanction_level 타인 조회 가드 (G2-12) ----------
-- security INVOKER 로 바꾼다: 정의자 함수(can_like·create_report·트리거·어드민 함수·뷰) 안에서는 current_user 가 함수 소유자(postgres)라
-- 가드를 통과하고 RLS 를 우회한다. 클라이언트 직접 호출(current_user = authenticated/anon)은 본인 id 만 허용(본인 행은 sanctions_self_read),
-- service_role(bypassrls)·모더레이터 JWT(sanctions_mod_read) 는 g2_trusted_caller() 로 통과. 그 외 → 42501.
create or replace function public.active_sanction_level(p_profile_id uuid)
returns smallint language plpgsql stable security invoker set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated')
     and p_profile_id is distinct from public.current_profile_id()
     and not coalesce(public.g2_trusted_caller(), false) then
    raise exception 'FORBIDDEN: active_sanction_level is self-only' using errcode = '42501';
  end if;
  return (
    select coalesce(max(level), 0)::smallint
    from public.sanctions
    where profile_id = p_profile_id
      and revoked_at is null
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
end $$;
comment on function public.active_sanction_level is
  'H1(0071, G2-12): 현재 유효 제재 최고 레벨. 클라이언트 직접 호출은 본인 id 만(타인 → 42501). 정의자 함수 내부·service role·모더레이터는 제한 없음.';

-- ---------- G. admin_review_photo: held 허용 ----------
create or replace function public.admin_review_photo(
  p_actor_id uuid, p_photo_id uuid, p_decision public.review_status,
  p_reject_code public.photo_reject_code default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.photos%rowtype; v_side jsonb := '[]'::jsonb; v_n integer; v_level smallint; v_held_reason text;
begin
  perform public.assert_moderator(p_actor_id);
  if p_decision not in ('approved', 'rejected', 'held') then raise exception 'INVALID_INPUT: decision' using errcode = 'check_violation'; end if;
  if p_decision = 'rejected' and p_reject_code is null then raise exception 'INVALID_INPUT: reject_code required' using errcode = 'check_violation'; end if;
  select * into v_p from public.photos where id = p_photo_id for update;
  if not found then raise exception 'NOT_FOUND: photo' using errcode = 'no_data_found'; end if;

  -- held: 판정 대기(비노출). D8 직접 갱신 경로와 같은 표기(held_reason 'MANUAL: …'), 사용자 통보 없음, 부수효과 없음
  if p_decision = 'held' then
    v_held_reason := btrim('MANUAL: ' || coalesce(p_note, ''));
    update public.photos
    set review_status = 'held', reject_code = null, reviewed_by = p_actor_id, reviewed_at = now(), held_reason = v_held_reason
    where id = p_photo_id;   -- 트리거 trg_photos_recompute_level → verify_level(대표 사진이면 L3 강등)
    select verify_level into v_level from public.profiles where id = v_p.profile_id;
    perform public.admin_audit(p_actor_id, 'photo_held', 'photo', p_photo_id::text,
      jsonb_build_object('review_status', v_p.review_status, 'reject_code', v_p.reject_code, 'held_reason', v_p.held_reason),
      jsonb_build_object('review_status', 'held', 'reject_code', null, 'held_reason', v_held_reason),
      jsonb_build_object('profile_id', v_p.profile_id, 'is_primary', v_p.is_primary, 'verify_level_after', v_level, 'note_len', char_length(coalesce(p_note, ''))));
    return jsonb_build_object('photo_id', p_photo_id, 'review_status', 'held', 'reject_code', null, 'profile_id', v_p.profile_id, 'verify_level', v_level, 'side_effects', v_side);
  end if;

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
comment on function public.admin_review_photo is
  'H1(0071): approved | rejected(reject_code 필수) | held(p_note → held_reason ''MANUAL: …'', audit photo_held, 통보 없음). 트리거 → recompute_verify_level.';

-- ---------- H. issue_sanction: service role 호출 시 actor_role 채움 ----------
create or replace function public.issue_sanction(
  p_profile_id uuid, p_level integer, p_reason text,
  p_duration interval default null, p_report_id uuid default null,
  p_reason_code public.report_reason default null, p_issued_by uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ends timestamptz; v_role text;
begin
  if p_level between 1 and 5 then
    v_ends := now() + coalesce(p_duration, case p_level
      when 1 then interval '0' when 2 then interval '24 hours' when 3 then interval '3 days'
      when 4 then interval '7 days' else interval '30 days' end);
  else
    v_ends := null;
  end if;
  -- 자동 조치는 level 1·2 까지만. 3 이상은 사람(issued_by)이 있어야 한다. 예외: 미성년 확정(reason 'AUTO:MINOR_CONFIRMED').
  if p_level >= 3 and p_issued_by is null and p_reason not like 'AUTO:MINOR_CONFIRMED%' then
    raise exception 'MANUAL_APPROVAL_REQUIRED: level>=3 제재는 사람이 승인해야 합니다' using errcode = 'check_violation';
  end if;
  insert into public.sanctions (profile_id, level, reason, reason_code, report_id, starts_at, ends_at, issued_by)
  values (p_profile_id, p_level::smallint, p_reason, p_reason_code, p_report_id, now(), v_ends, p_issued_by)
  returning id into v_id;
  -- actor_role: JWT(app_role) → admin_users(p_issued_by) → 'service' (service role 호출 시 JWT 가 없어 null 이던 문제, 21_admin §0-5)
  v_role := case when p_issued_by is null then 'system'
                 else coalesce(public.app_role(), (select a.role::text from public.admin_users a where a.user_id = p_issued_by), 'service') end;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, after)
  values (p_issued_by, v_role, 'sanction_issued', 'profile', p_profile_id::text,
          jsonb_build_object('sanction_id', v_id, 'level', p_level, 'reason', p_reason, 'report_id', p_report_id));
  return v_id;
end $$;

-- ---------- I. moderation_notifications / moderation_jobs 30일 정리 ----------
create or replace function public.purge_moderation_queues(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n integer; v_j integer; v_cut timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
begin
  delete from public.moderation_notifications where delivered_at is not null and delivered_at < v_cut;
  get diagnostics v_n = row_count;
  delete from public.moderation_jobs where status in ('done', 'failed') and updated_at < v_cut;
  get diagnostics v_j = row_count;
  return jsonb_build_object('notifications', v_n, 'jobs', v_j, 'checked_at', now());
end $$;
comment on function public.purge_moderation_queues is 'H1: 전달 완료 통보 30일·완료/실패 작업 30일 삭제. moderation_daily(pg_cron dm_moderation_daily 03:10 KST) 가 호출.';

-- ---------- J. 탈퇴한 사용자 표시: v_my_matches / get_chat_list 에 partner_deleted ----------
create or replace view public.v_my_matches with (security_barrier = true) as
select
  mt.id as match_id,
  mt.status,
  mt.mode,
  mt.matched_at,
  mt.first_message_at,
  mt.last_message_at,
  mt.ended_at,
  case when mt.a_id = public.current_profile_id() then mt.b_id else mt.a_id end as partner_id,
  op.nickname as partner_nickname,
  op.verify_level as partner_verify_level,
  op.status as partner_status,
  (select count(*)::integer from public.messages x
     where x.match_id = mt.id and x.sender_id <> public.current_profile_id() and x.read_at is null and not x.is_held) as unread_count,
  (select x.masked_body from public.messages x where x.match_id = mt.id and not x.is_held order by x.created_at desc limit 1) as last_masked_body,
  (mt.matched_at + interval '72 hours' <= now() and me.verify_level >= 3 and op.verify_level >= 3) as contact_unmasked,
  (op.purged_at is not null) as partner_deleted
from public.matches mt
join public.profiles me on me.id = public.current_profile_id()
join public.profiles op on op.id = case when mt.a_id = me.id then mt.b_id else mt.a_id end
where me.id in (mt.a_id, mt.b_id)
  and not exists (select 1 from public.blocks bl where bl.blocker_id = me.id and bl.blocked_id = op.id);

create or replace function public.get_chat_list(p_match_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select public.current_profile_id() as id),
  rows as (
    select
      mt.id as match_id, mt.status, mt.mode, mt.matched_at, mt.first_message_at, mt.last_message_at, mt.ended_at,
      op.id as partner_id, op.nickname as partner_nickname, op.verify_level as partner_verify_level, op.status as partner_status,
      case
        when op.birth_date is null then null
        when public.age_years_kst(op.birth_date) < 24 then '20_early'
        when public.age_years_kst(op.birth_date) < 27 then '20_mid'
        when public.age_years_kst(op.birth_date) < 30 then '20_late'
        when public.age_years_kst(op.birth_date) < 34 then '30_early'
        when public.age_years_kst(op.birth_date) < 37 then '30_mid'
        when public.age_years_kst(op.birth_date) < 40 then '30_late'
        else '40_plus' end as partner_age_band,
      r.sigungu as partner_sigungu,
      (select ph.path from public.photos ph where ph.profile_id = op.id and ph.is_primary and ph.review_status = 'approved' limit 1) as partner_photo_path,
      (select count(*)::integer from public.messages x
         where x.match_id = mt.id and x.sender_id <> me.id and x.read_at is null and not x.is_held) as unread_count,
      (select case when x.image_path is not null then '[사진]' else left(x.masked_body, 80) end
         from public.messages x where x.match_id = mt.id and (not x.is_held or x.sender_id = me.id)
         order by x.created_at desc limit 1) as last_preview,
      (mt.matched_at + interval '72 hours' <= now() and mp.verify_level >= 3 and op.verify_level >= 3) as contact_unmasked,
      mt.matched_at + interval '72 hours' as unmask_at,
      (mp.verify_level >= 3 and op.verify_level >= 3) as both_l3,
      public.can_send_chat_image(mt.id, me.id) as image_allowed,
      mt.matched_at + interval '24 hours' as image_allowed_at,
      public.can_send_message(mt.id, me.id) as can_send,
      public.active_sanction_level(me.id) as my_sanction_level,
      (select count(distinct m2.id)::integer from public.messages m2 join public.message_flags f on f.message_id = m2.id
         where m2.match_id = mt.id and m2.sender_id = me.id and f.rule_id like 'CT\_%' and f.rule_id <> 'CT_LURE'
           and m2.body is distinct from m2.masked_body) as my_contact_hits,
      exists (select 1 from public.messages m3 join public.message_flags f on f.message_id = m3.id
         where m3.match_id = mt.id and m3.sender_id = op.id and f.rule_id in ('SC_MONEY', 'SC_INVEST')
           and f.created_at > now() - interval '7 days') as partner_scam_banner,
      case when p_match_id is not null then mt.first_suggestion else null end as first_suggestion,
      (op.purged_at is not null) as partner_deleted
    from public.matches mt
    join me on true
    join public.profiles mp on mp.id = me.id
    join public.profiles op on op.id = case when mt.a_id = me.id then mt.b_id else mt.a_id end
    left join public.regions r on r.code = op.region_code
    where me.id in (mt.a_id, mt.b_id)
      and (p_match_id is null or mt.id = p_match_id)
      and not exists (select 1 from public.blocks bl where bl.blocker_id = me.id and bl.blocked_id = op.id)
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by coalesce(rows.last_message_at, rows.matched_at) desc), '[]'::jsonb) from rows
$$;
comment on function public.get_chat_list is
  '채팅 목록(인자 없음) / 방 헤더(p_match_id). 차단자 화면에서는 방 제거, 피차단자·left·paused 는 status 로 남는다. H1: partner_deleted(탈퇴 tombstone) 추가.';

-- ---------- K. moderation_daily: C·D·I 통합 ----------
create or replace function public.moderation_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e jsonb; v_p jsonb; v_t jsonb; v_q jsonb; v_f integer; v_r integer;
begin
  v_e := public.purge_expired_evidence();
  v_p := public.purge_deleted_profiles();
  v_t := public.purge_tombstones();
  v_f := public.purge_expired_moderation_flags();
  v_r := public.purge_old_recommendations();
  v_q := public.purge_moderation_queues();
  perform public.notify_admin('purge_summary', jsonb_build_object(
    'evidence', v_e -> 'purged', 'profiles', v_p -> 'purged', 'tombstones', v_t, 'flags', v_f, 'recommendations', v_r, 'queues', v_q));
  return jsonb_build_object('evidence', v_e, 'profiles', v_p, 'tombstones', v_t, 'flags_reset', v_f, 'recommendations_purged', v_r, 'queues', v_q);
end $$;
comment on function public.moderation_daily is
  'H1(0071): 일일 배치 — 증거 파기·탈퇴 purge(tombstone)·tombstone 90일 정리·플래그 만료·추천 60일·통보/작업 큐 30일. pg_cron dm_moderation_daily(03:10 KST).';

-- ---------- 권한 ----------
revoke execute on function
  public.purge_old_recommendations(integer), public.purge_tombstones(integer), public.purge_moderation_queues(integer)
from public, anon, authenticated;
grant execute on function
  public.purge_old_recommendations(integer), public.purge_tombstones(integer), public.purge_moderation_queues(integer)
to service_role;
-- active_sanction_level 은 authenticated 유지(본인 조회·photos_self_insert·storage 정책이 본인 id 로 호출), anon 회수
revoke execute on function public.active_sanction_level(uuid) from public, anon;
grant execute on function public.active_sanction_level(uuid) to authenticated, service_role;
