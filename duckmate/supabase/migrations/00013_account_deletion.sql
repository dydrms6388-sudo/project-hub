-- ============================================================================
-- 00013: 계정 파기 RPC (E4 에스컬레이션 → 오케스트레이터 확정)
--
-- 배경: /settings/delete 화면은 `delete_my_account()` 를 먼저 호출하고, 없으면
--       운영 큐로 폴백하도록 구현돼 있다. 이 마이그레이션이 그 정식 경로를 제공한다.
--
-- 파기 정책 (A5 §4.3 · 08_legal_docs privacy.md 보유기간표 · 00002 FK 원칙):
--   · profiles 는 auth.users 에 cascade — auth.users 1행 삭제로 프로필·취미·퀴즈·
--     사진·추천·좋아요가 연쇄 파기된다.
--   · reports/sanctions/audit_logs 는 on delete set null — **탈퇴 후에도 보존**
--     (신고 증거·제재 이력은 분쟁 대응 목적, privacy.md 명시).
--   · matches/messages 는 set null — 상대 화면의 대화방은 유지된다(12_flows §8.10).
--     단 본인 발신 메시지의 **원문(body)** 은 여기서 즉시 파기하고, 상대가 이미 본
--     마스킹본(masked_body)만 남긴다. 신고로 스냅샷된 증거는 reports.evidence 에
--     별도 보존되므로 조사 능력은 유지된다.
--   · 영구정지(level 5) 회원의 blocked_hashes 는 별도 테이블이라 탈퇴해도 남는다
--     — 재가입 차단 목적(A5 §3.1). identity_hashes 는 cascade 로 함께 파기된다.
-- ============================================================================

create or replace function public.delete_my_account(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile_id uuid;
  v_user_id    uuid;
  v_messages   integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  end if;

  select id into v_profile_id
  from public.profiles
  where user_id = v_user_id;

  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  -- 1) 본인 발신 메시지 원문 파기 (마스킹본은 상대 화면 유지를 위해 존치)
  update public.messages
  set body = '',
      mask_rules = '[]'::jsonb
  where sender_id = v_profile_id;
  get diagnostics v_messages = row_count;

  -- 2) 감사 로그 — actor_id 는 프로필 파기와 함께 null 이 되므로 target 에 파기 대상
  --    프로필 id 를 남긴다. 이름·이메일 등 식별 정보는 저장하지 않는다 (A5 §4).
  insert into public.audit_logs (actor_id, action, target, meta)
  values (
    v_profile_id,
    'account.delete',
    'profiles:' || v_profile_id::text,
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 200),
      'messages_redacted', v_messages
    )
  );

  -- 3) auth.users 삭제 → profiles cascade → 나머지 연쇄 파기/보존은 FK 정책이 결정
  delete from auth.users where id = v_user_id;

  return jsonb_build_object('ok', true, 'messages_redacted', v_messages);
end;
$$;

revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

comment on function public.delete_my_account(text) is
  '본인 계정 파기. 본인 발신 메시지 원문을 지우고 auth.users 를 삭제한다. 신고·제재·감사로그는 FK set null 로 보존.';
