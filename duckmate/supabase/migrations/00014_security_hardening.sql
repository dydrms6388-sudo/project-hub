-- =============================================================================
-- 덕메이트(DuckMate) · 마이그레이션 00014 — 보안 하드닝 (G2 보안 리뷰 Blocker 대응)
--
-- 대응 항목 (docs/agents/29_security_review.md):
--   · G2-02 : likes 컬럼/테이블 권한 부재 → 클라이언트 직접 INSERT 차단
--             + 서버(service role) 경로가 쓸 자격 판정 함수 can_send_like()
--   · G2-03 : appeals 권한 부재 → 클라이언트 INSERT/UPDATE/DELETE 전면 차단,
--             정식 접수는 submit_appeal() RPC(00010) 단일 경로
--   · G2-04 : 신고 남용 → 신고자 단위 상한. apply_auto_sanctions() 에
--             "신고자 신뢰도 게이트"를 추가해 1계정 대량 P0 자동제재를 차단
--   · G2-07 : push_tokens.token.endpoint 무검증(blind SSRF) → 알려진 웹푸시
--             호스트 화이트리스트 CHECK
--
-- ⚠ 이 파일은 00002(테이블)·00003(RLS/컬럼권한)·00010(모더레이션 함수) 위에 얹는
--   레이어다. 기존 정책/함수를 삭제하지 않고, 필요한 것만 replace/추가한다.
--   G2 가 "양호"로 판정한 messages 원문 격리·Realtime 화이트리스트·RLS 전수
--   활성·service role 경계는 건드리지 않는다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. [G2-02] likes — 클라이언트 직접 쓰기 차단
--
--   기존: Supabase 기본 grant 로 authenticated 가 전 컬럼 INSERT 가능했고,
--   정책 likes_insert_own 은 from_id/can_engage/can_view_profile 만 봤다.
--   → type='super' 위조(슈퍼라이크 무한)와 Lv1 일 3회 한도 우회가 가능했다.
--   조치: 쓰기 권한 자체를 회수한다. 발신은 서버(service role)의
--   lib/matching/queries.ts#sendLike 단일 경로만 남는다(한도·잔액 검사 포함).
--   SELECT 는 그대로 둔다(받은 좋아요 카운트 — 페이월 이슈 G2-10 은 Phase 2).
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.likes from anon, authenticated;

-- 이제 클라이언트 INSERT 경로가 없으므로 insert 정책은 사문(死文)이다.
-- 정책을 남겨두면 "권한이 있다"는 오해를 부르므로 제거한다(권한 회수가 실질 방어).
drop policy if exists likes_insert_own on public.likes;

-- can_send_like(from, to) — RLS 정책 likes_insert_own 이 하던 자격 판정을
--   auth.uid() 에 의존하지 않는 형태로 재구현한 것. service role 서버 경로가
--   insert 직전에 호출한다. 판정 내용은 can_engage() + can_view_profile() 과 동형:
--     · 발신자: active + Lv1+ + 만 19세 이상 + 활성 제재 level 2+ 없음
--     · 수신자: active + Lv1+ + 활성 제재 level 3+ 없음
--     · 양방향 차단 관계 없음
create or replace function public.can_send_like(p_from uuid, p_to uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_from is not null
     and p_to is not null
     and p_from <> p_to
     and exists (
       select 1 from public.profiles f
       where f.id = p_from
         and f.status = 'active'
         and f.verify_level >= 1
         and f.birth_date <= (current_date - interval '19 years')
         and not exists (
           select 1 from public.sanctions s
           where s.profile_id = f.id
             and s.status = 'ACTIVE'
             and s.level >= 2
             and (s.ends_at is null or s.ends_at > now())
         )
     )
     and exists (
       select 1 from public.profiles t
       where t.id = p_to
         and t.status = 'active'
         and t.verify_level >= 1
         and not exists (
           select 1 from public.sanctions s
           where s.profile_id = t.id
             and s.status = 'ACTIVE'
             and s.level >= 3
             and (s.ends_at is null or s.ends_at > now())
         )
     )
     and not public.is_blocked(p_from, p_to);
$$;

-- 임의 프로필 쌍의 상태를 탐지하는 오라클이 되지 않도록 클라이언트 실행은 회수.
-- (00004 의 try_create_match / create_report_snapshot 과 동일한 "쓰기·판정 함수는
--  service role 전용" 원칙. service_role 은 Supabase 기본 권한을 그대로 유지하되,
--  기본 권한 설정이 없는 환경에서도 동작하도록 명시적으로 한 번 더 grant 한다.)
revoke execute on function public.can_send_like(uuid, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.can_send_like(uuid, uuid) to service_role;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. [G2-03] appeals — 클라이언트 쓰기 차단 (status/decided_by 위조 방지)
--
--   기존: 컬럼 권한 제한이 없어 유저가 status='ACCEPTED', decided_by=<어드민>
--   으로 직접 INSERT 할 수 있었다(증적 위조 + sanction_id unique 로 본인
--   이의제기권 소멸). 정식 접수 경로 submit_appeal()(00010)은 security definer 라
--   테이블 권한 회수의 영향을 받지 않는다 — 그 경로만 남긴다.
--
--   ※ "본인 제출 body 만 grant" 대신 전면 회수를 택한 근거: appeals 는 신규 행이
--     반드시 sanction_id·profile_id·appeal_status 동기화(sanctions 갱신)와
--     함께 만들어져야 하는데, 컬럼 grant 로는 그 원자성을 강제할 수 없다.
--     submit_appeal() 이 이미 body 검증(10~2000자)·30일 창·건당 1회를 모두 한다.
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.appeals from anon, authenticated;
drop policy if exists appeals_insert_own on public.appeals;
-- appeals_select_own(본인/어드민 조회)은 유지한다.

-- -----------------------------------------------------------------------------
-- 3. [G2-11 예방] refund_requests — Phase 3 결제 개시 전 컬럼 권한 확정
--   금전 경로이므로 같은 하드닝에 포함한다. 유저는 신청 사실만 만들 수 있고
--   status·amount·handled_by 는 서버(service role)만 쓴다.
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.refund_requests from anon, authenticated;
grant insert (user_id, payment_ref, reason) on public.refund_requests to authenticated;

-- -----------------------------------------------------------------------------
-- 4. [G2-04] 신고 남용 — 자동 제재의 "신고자 신뢰도 게이트"
--
--   문제: (신고자, 대상) 24h 1회 제한뿐이라, 계정 1개로 임의 다수를 각각 P0 로
--   신고해 대상마다 AUTO_P0_FREEZE(전역 level 2, 72h 발신정지)를 유발할 수 있었다.
--
--   조치(정책 정합성): A5 §3.2 의 룰 자체(P0 1건 → 임시조치)는 바꾸지 않는다.
--   대신 **한 신고자가 24시간 안에 자동 제재를 유발할 수 있는 서로 다른 대상 수**를
--   REPORTER_AUTO_SANCTION_TARGETS_24H(=3) 로 제한한다. 초과분은 자동 제재를
--   부과하지 않고 **큐로만 강등**한다 — 신고 자체는 정상 접수되고 P0 우선순위와
--   1시간 SLA 도 그대로 유지되므로, A5 §0-3 "안전 > 성장" 을 훼손하지 않으면서
--   자동화된 대량 침묵 공격만 차단된다. (사람 확인 후의 제재는 영향 없음)
--
--   앱 레벨 상한(24h 총 10건, 30일 기각 5건 → 30일 신고 제한)은
--   apps/web/lib/moderation/service.ts 가 함께 집행한다(A5 §2 명문 규정).
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
  v_reporter_targets_24h integer := 0;
  -- 한 신고자가 24h 내에 자동 제재를 유발할 수 있는 서로 다른 대상 수 (G2-04)
  c_reporter_target_cap constant integer := 3;
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

  -- [G2-04] 신고자 신뢰도 게이트 — 24h 내 이미 c_reporter_target_cap 명 이상의
  --   서로 다른 대상을 신고한 계정의 신고는 자동 제재를 유발하지 못한다.
  --   AUTO_3REPORTS(서로 다른 신고자 3인 합의)는 단독 계정 공격이 아니므로 면제.
  if v_rule = 'AUTO_P0_FREEZE' and new.reporter_id is not null then
    select count(distinct r.target_id) into v_reporter_targets_24h
    from public.reports r
    where r.reporter_id = new.reporter_id
      and r.target_id is not null
      and r.target_id <> new.target_id
      and r.created_at >= now() - interval '24 hours';

    if v_reporter_targets_24h >= c_reporter_target_cap then
      -- 자동 제재는 생략하되 신고는 살린다: 우선순위(P0)·SLA 는 그대로 두고
      -- 어드민 큐에서 사람이 판단한다. 남용 판정 근거는 감사로그에만 남긴다.
      insert into public.audit_logs (actor_id, action, target, meta)
      values (
        null,
        'moderation.auto_sanction_suppressed',
        'reports:' || new.id::text,
        jsonb_build_object(
          'rule', v_rule,
          'reason', 'reporter_target_cap_24h',
          'reporter_id', new.reporter_id,
          'reporter_targets_24h', v_reporter_targets_24h,
          'cap', c_reporter_target_cap
        )
      );
      return new;
    end if;
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
      'distinct_reporters_30d', coalesce(v_distinct_reporters, 1),
      'reporter_targets_24h', v_reporter_targets_24h
    )
  );

  return new;
end;
$$;

-- 신고자 단위 집계(24h 서로 다른 대상 수 / 30일 기각 건수)를 위한 인덱스
create index if not exists idx_reports_reporter_time
  on public.reports (reporter_id, created_at desc)
  where reporter_id is not null;

-- -----------------------------------------------------------------------------
-- 5. [G2-07] push_tokens.endpoint 화이트리스트 (blind SSRF 차단)
--
--   push_tokens.token 은 Web Push 구독 JSON 문자열이고, push-dispatch Edge
--   Function 이 그 안의 endpoint 로 그대로 fetch 한다. 등록 시 스킴/호스트 검증이
--   없어 인증 유저가 내부 주소(169.254.169.254 등)를 등록할 수 있었다.
--   앱 레벨 검증(lib/notifications/schemas.ts)과 **이중으로** DB CHECK 를 건다.
--
--   허용 호스트(웹푸시 서비스만 — 각 도메인과 그 하위 도메인):
--     fcm.googleapis.com · android.googleapis.com        — Chrome/FCM
--     push.services.mozilla.com                          — Firefox
--     push.apple.com (web.push.apple.com)                — Safari
--     notify.windows.com                                 — Edge/WNS
--   platform='web' 이 아닌 토큰(ios/android FCM 토큰 문자열)은 JSON 이 아니므로
--   검사 대상에서 제외한다.
-- -----------------------------------------------------------------------------
create or replace function public.push_endpoint_host_allowed(p_endpoint text)
returns boolean
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  -- https 강제 + 호스트가 화이트리스트 도메인(또는 그 하위 도메인)으로 끝나고
  -- 바로 '/' 가 오는 형태만 허용한다. 사용자정보(@)·포트·IP 리터럴은 전부 불허.
  select p_endpoint is not null
     and length(p_endpoint) <= 2048
     and p_endpoint ~* ('^https://([a-z0-9-]+\.)*('
         || 'fcm\.googleapis\.com'
         || '|android\.googleapis\.com'
         || '|push\.services\.mozilla\.com'
         || '|push\.apple\.com'
         || '|notify\.windows\.com'
         || ')/');
$$;

/*
  token(구독 JSON)에서 endpoint 를 안전하게 뽑는다. JSON 이 아니면 null 반환
  (예외를 삼켜야 CHECK 가 오류로 터지지 않는다).
*/
create or replace function public.push_token_endpoint(p_token text)
returns text
language plpgsql immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v jsonb;
begin
  begin
    v := p_token::jsonb;
  exception when others then
    return null;
  end;
  if jsonb_typeof(v) <> 'object' then
    return null;
  end if;
  return v ->> 'endpoint';
end;
$$;

-- 기존에 저장된 비허용 endpoint 는 SSRF 벡터이므로 제거한 뒤 제약을 건다.
delete from public.push_tokens
where platform = 'web'
  and public.push_token_endpoint(token) is not null
  and not public.push_endpoint_host_allowed(public.push_token_endpoint(token));

alter table public.push_tokens
  drop constraint if exists push_tokens_endpoint_allowed;
alter table public.push_tokens
  add constraint push_tokens_endpoint_allowed check (
    platform <> 'web'
    or public.push_token_endpoint(token) is null            -- 웹푸시 JSON 이 아님(레거시/FCM 문자열)
    or public.push_endpoint_host_allowed(public.push_token_endpoint(token))
  );

-- 유저당 활성 웹푸시 토큰 수를 제한하는 것은 G2-12(Medium, Phase 2) — 여기서는
-- endpoint 목적지만 고정한다.
