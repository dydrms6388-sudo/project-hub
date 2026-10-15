-- =============================================================================
-- 0042 — retention & purge (D5)
--   · purge_expired_evidence()   신고 증거 만료 파기(dismissed 90일 / confirmed 180일 / 영구정지 5년, legal_hold 제외)
--   · purge_deleted_profiles()   탈퇴 7일 유예 후 삭제(신고/제재/CI 해시/결제·동의 가명화 보존)
--   · moderation_flags 만료 정리, pg_cron 등록(멱등, 확장이 없으면 건너뜀)
-- 파일 삭제(evidence 버킷·photos 버킷)는 SQL 이 못 하므로 moderation_jobs 에 storage 작업을 넣고 Edge Function 이 처리한다.
-- 보존 수치는 moderation_settings.evidence_retention_days / delete_grace_days 와 0009 트리거(trg_reports_before_update)가 원본.
-- =============================================================================

-- ---------- 증거 파기 ----------
-- 행은 남기고(누적 카운트·제재 참조 유지) evidence/detail 을 tombstone 으로 치환. 파일은 evidence_purge 작업 큐.
create or replace function public.purge_expired_evidence(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_n integer := 0;
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from (
    select id from public.reports
    where legal_hold = false and expires_at is not null and expires_at < now()
      and status in ('confirmed', 'dismissed')
      and not (evidence ? 'purged_at')
    order by expires_at
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  ) x;

  if array_length(v_ids, 1) is null then
    return jsonb_build_object('purged', 0, 'checked_at', now());
  end if;

  -- 파일 파기 작업 (evidence/{report_id}/ 프리픽스 전체)
  insert into public.moderation_jobs (kind, report_id, payload)
  select 'evidence_purge', id, jsonb_build_object('prefix', id::text || '/') from unnest(v_ids) id;

  update public.reports
  set evidence = jsonb_build_object('schema', 1, 'purged_at', now(), 'reason', 'retention_expired'),
      detail = null, resolution_note = left(resolution_note, 200)
  where id = any(v_ids);
  get diagnostics v_n = row_count;

  insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
  select 'system', 'evidence_purged', 'report', id::text, jsonb_build_object('retention', 'expired')
  from unnest(v_ids) id;

  return jsonb_build_object('purged', v_n, 'report_ids', to_jsonb(v_ids), 'checked_at', now());
end $$;
comment on function public.purge_expired_evidence is
  '일 1회 배치. legal_hold=true 는 건너뛴다(해제 시 trg_reports_legal_hold_release 가 +90일). 내용은 audit 에 남기지 않는다.';

-- ---------- 탈퇴 유예 후 삭제 ----------
-- 순서: CI 해시 대체키 채움(reports/sanctions/consents) → 사진 파일 작업 큐 → 상대 매칭 status='left' → auth.users 삭제(cascade: profiles·photos·likes·messages 등)
-- 보존: reports(reporter/target null + ci_hash), sanctions(profile null + ci_hash), appeals(profile null), identity_verifications(user null, is_active=false),
--       consents(user null + subject_hash), audit_logs, subscriptions/payments/item_ledger(user FK 는 D6 스키마 규칙), inquiries.
create or replace function public.purge_deleted_profiles(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_grace integer := public.moderation_setting_int('delete_grace_days', 7);
  r record;
  v_ci text;
  v_paths text[];
  v_done uuid[] := '{}';
  v_summary jsonb := '[]'::jsonb;
begin
  for r in
    select p.id, p.user_id, p.delete_requested_at
    from public.profiles p
    where p.status = 'deleting' and p.delete_requested_at is not null
      and p.delete_requested_at + make_interval(days => v_grace) < now()
    order by p.delete_requested_at
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
  loop
    -- CI 해시(활성 성공 행 우선, 없으면 최근 성공 행)
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

    -- 상대 화면: "탈퇴한 사용자" — 매칭은 left 로 90일 보존(D7 가 matches.ended_at+90d 삭제). FK cascade 를 피하려 상대 쪽 참조는 유지 못 하므로
    -- 매칭 행은 profiles cascade 로 함께 사라진다(스키마 제약). 상대 방은 v_my_matches 에서 사라지고, 신고 증거만 남는다(문서화).
    update public.matches set status = 'left', ended_at = coalesce(ended_at, now())
    where status = 'active' and r.id in (a_id, b_id);

    insert into public.audit_logs (actor_role, action, target_type, target_id, meta)
    values ('system', 'profile_purged', 'profile', r.id::text,
            jsonb_build_object('delete_requested_at', r.delete_requested_at, 'grace_days', v_grace, 'ci_hash_kept', v_ci is not null, 'photo_files', coalesce(array_length(v_paths, 1), 0)));

    -- auth.users 삭제 → profiles cascade → photos/likes/matches/messages/... cascade. reports/sanctions/appeals 는 set null.
    delete from auth.users where id = r.user_id;
    delete from public.profiles where id = r.id;   -- auth 스키마 권한이 없는 환경 방어(위가 cascade 했으면 no-op)

    v_done := v_done || r.id;
    v_summary := v_summary || jsonb_build_object('profile_id', r.id, 'photo_files', coalesce(array_length(v_paths, 1), 0));
  end loop;

  return jsonb_build_object('purged', coalesce(array_length(v_done, 1), 0), 'profiles', v_summary, 'checked_at', now());
end $$;
comment on function public.purge_deleted_profiles is
  'request_delete 후 delete_grace_days(7) 경과 계정 삭제. D7 purge_daily 가 호출. 신고/제재/CI 해시/동의(가명화)/결제/감사로그 보존.';

-- moderation_flags 배너·점수 창 만료 정리(플래그 행 유지, 값만 리셋)
create or replace function public.purge_expired_moderation_flags()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.moderation_flags
  set scam_banner_until = null
  where scam_banner_until is not null and scam_banner_until < now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 일일 배치 진입점 (D7 purge_daily 에서 호출하거나 pg_cron 이 직접)
create or replace function public.moderation_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_e jsonb; v_p jsonb; v_f integer;
begin
  v_e := public.purge_expired_evidence();
  v_p := public.purge_deleted_profiles();
  v_f := public.purge_expired_moderation_flags();
  perform public.notify_admin('purge_summary', jsonb_build_object('evidence', v_e -> 'purged', 'profiles', v_p -> 'purged', 'flags', v_f));
  return jsonb_build_object('evidence', v_e, 'profiles', v_p, 'flags_reset', v_f);
end $$;

-- ---------- pg_cron (멱등; 확장 미제공 환경은 건너뜀) ----------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from pg_namespace where nspname = 'cron') then
      -- 기존 등록 제거 후 재등록
      perform cron.unschedule(jobid) from cron.job where jobname in ('dm_moderation_daily', 'dm_moderation_sla');
      perform cron.schedule('dm_moderation_daily', '10 18 * * *', $c$select public.moderation_daily()$c$);   -- 03:10 KST
      perform cron.schedule('dm_moderation_sla',   '*/15 * * * *', $c$select public.sla_check()$c$);         -- Edge Function 이 없을 때의 폴백. 실제 통보는 moderation-sla-check
    end if;
  else
    raise notice 'pg_cron not available: schedule dm_moderation_daily / dm_moderation_sla via Supabase dashboard or Edge Function cron';
  end if;
end $$;

-- ---------- 권한 ----------
revoke execute on function
  public.purge_expired_evidence(integer), public.purge_deleted_profiles(integer),
  public.purge_expired_moderation_flags(), public.moderation_daily()
from public, anon, authenticated;
grant execute on function
  public.purge_expired_evidence(integer), public.purge_deleted_profiles(integer),
  public.purge_expired_moderation_flags(), public.moderation_daily()
to service_role;
