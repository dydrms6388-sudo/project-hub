-- =============================================================================
-- 덕메이트(DuckMate) · D4 마이그레이션 00009 — 채팅/Realtime
-- 근거: ORCHESTRATOR_SPEC §3 D4 + A5(05_trust_safety) §5.2·§5.3 + 14_schema(D1 규약)
--       + 12_flows §4.1/§4.2/§8.10 + 15_auth(D2 규약 §5 chat-images)
--
-- 이 파일이 만드는 것:
--   1) Realtime 보안 결정 — messages 를 postgres_changes 퍼블리케이션에 넣지 않고
--      "DB 트리거 → realtime.send() broadcast" 로 마스킹된 페이로드만 내보낸다.
--   2) broadcast 트리거 2개 (new_message · message_read)
--   3) private 채널 인가 정책 (realtime.messages RLS, topic = 'match:{uuid}')
--   4) mark_read(match_id) — 읽음 일괄 처리 (참여자 검증 포함)
--   5) chat_rooms 뷰 — 대화방 목록(마지막 메시지·안읽음 수·상대 프로필)
--
-- ---------------------------------------------------------------------------
-- ★ Realtime 보안 결정 (14_schema 미결 3 "Realtime 컬럼 권한" 에 대한 D4 확정)
-- ---------------------------------------------------------------------------
-- 문제: messages 는 00003 에서 컬럼 권한으로 원문 body·mask_rules 의 SELECT 를
--   authenticated 로부터 revoke 했다. 그러나 postgres_changes(WALRUS) 는 WAL 을
--   읽어 페이로드를 만드는 별도 경로이며, 컬럼 권한 반영 여부가 Realtime 서버
--   버전/설정에 종속된다(정책 변경 이력 있음). 즉 "컬럼 grant 가 Realtime 에도
--   그대로 적용된다"는 가정에 안전을 걸 수 없다 — 한 번의 회귀로 대화 원문 전체가
--   상대 클라이언트에 흘러간다(A5 §5.3 위반, 마스킹 파이프라인 전체 무력화).
--
-- 확정: **messages 는 supabase_realtime 퍼블리케이션에 등록하지 않는다.**
--   대신 AFTER INSERT 트리거가 `realtime.send()` 로 **화이트리스트 페이로드**만
--   broadcast 한다. 즉 "무엇이 나가는지"를 WAL/Realtime 구현이 아니라 이 파일의
--   jsonb_build_object 가 결정한다(거부 기본값 · 명시적 허용).
--   · 페이로드 컬럼 = 00003 의 authenticated SELECT 화이트리스트와 1:1 동일
--     (id, match_id, sender_id, masked_body, image_path, read_at, created_at)
--   · body·mask_rules 는 어떤 경로로도 페이로드에 포함되지 않는다.
--   · 아래 방어 블록이 (대시보드 등에서) messages 가 퍼블리케이션에 추가돼 있으면
--     마이그레이션 시점에 제거한다.
--
-- 채널: topic = 'match:{match_id}', private = true.
--   private 채널은 realtime.messages 에 대한 RLS 로 인가된다 → 참여자만 SELECT(구독)
--   허용, **INSERT 정책은 만들지 않는다** = 클라이언트는 broadcast 를 보낼 수 없다.
--   (참여자가 new_message/safety_card 이벤트를 위조해 상대에게 쏘는 것을 원천 차단.
--    Phase 1 은 타이핑 인디케이터 미제공 — 필요해지면 별도 event 화이트리스트
--    정책으로 열어야 한다.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 방어: messages / matches 가 postgres_changes 퍼블리케이션에 있으면 제거
--    (원문 유출 경로를 코드로 막는다 — 대시보드 토글 실수 대비)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime drop table public.messages;
      raise warning 'DUCKMATE: public.messages 를 supabase_realtime 에서 제거했습니다 (원문 body 유출 방지 — 00009 결정).';
    end if;
  end if;
exception
  when insufficient_privilege then
    raise warning 'DUCKMATE: supabase_realtime 퍼블리케이션 수정 권한이 없습니다. messages 가 등록돼 있지 않은지 수동 확인 필요.';
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. broadcast 헬퍼 — realtime.send() 가 없는 환경(로컬 psql 등)에서도 실패하지 않게
--    감싼다. broadcast 실패가 메시지 저장을 롤백시켜서는 안 된다(best-effort).
-- -----------------------------------------------------------------------------
create or replace function public.chat_broadcast(
  p_match_id uuid,
  p_event    text,
  p_payload  jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform realtime.send(p_payload, p_event, 'match:' || p_match_id::text, true);
exception
  when others then
    -- undefined_function(realtime.send 부재) / 네트워크성 오류 모두 여기로.
    raise warning 'DUCKMATE chat_broadcast(%, %) 실패: %', p_match_id, p_event, sqlerrm;
end;
$$;

revoke execute on function public.chat_broadcast(uuid, text, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. new_message broadcast (AFTER INSERT, 행 단위)
--    페이로드 = 00003 의 authenticated SELECT 화이트리스트와 동일한 7개 컬럼.
--    ※ send-message Edge Function 은 별도 broadcast 를 하지 않는다(safety_card 제외).
-- -----------------------------------------------------------------------------
create or replace function public.broadcast_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.chat_broadcast(
    new.match_id,
    'new_message',
    jsonb_build_object(
      'id',          new.id,
      'match_id',    new.match_id,
      'sender_id',   new.sender_id,
      'masked_body', new.masked_body,   -- 원문 body 는 절대 포함하지 않는다
      'image_path',  new.image_path,
      'read_at',     new.read_at,
      'created_at',  new.created_at
    )
  );
  return null;
end;
$$;

drop trigger if exists trg_messages_broadcast_insert on public.messages;
create trigger trg_messages_broadcast_insert
  after insert on public.messages
  for each row execute function public.broadcast_new_message();

-- -----------------------------------------------------------------------------
-- 3. message_read broadcast (AFTER UPDATE, 문장 단위 + transition table)
--    mark_read() 의 일괄 update 든 클라이언트의 개별 read_at update 든
--    (00003: grant update (read_at)) 한 문장당 매칭별 1회만 broadcast 한다.
-- -----------------------------------------------------------------------------
create or replace function public.broadcast_message_read()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
begin
  for rec in
    select n.match_id,
           max(n.id)                as up_to_id,
           max(n.read_at)           as read_at,
           count(*)::int            as read_count
    from newtab n
    join oldtab o on o.id = n.id
    where o.read_at is null and n.read_at is not null
    group by n.match_id
  loop
    perform public.chat_broadcast(
      rec.match_id,
      'message_read',
      jsonb_build_object(
        'match_id',  rec.match_id,
        'reader_id', public.current_profile_id(),  -- service role 경로면 null
        'up_to_id',  rec.up_to_id,
        'read_at',   rec.read_at,
        'count',     rec.read_count
      )
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_messages_broadcast_read on public.messages;
create trigger trg_messages_broadcast_read
  after update on public.messages
  referencing old table as oldtab new table as newtab
  for each statement execute function public.broadcast_message_read();

-- -----------------------------------------------------------------------------
-- 4. private 채널 인가 — topic 'match:{uuid}' 참여자 판정
--    matches_select_participant(00003) 과 동일한 조건: 참여자 + 차단 시 불가시.
-- -----------------------------------------------------------------------------
create or replace function public.can_access_match_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_match_id uuid;
begin
  if p_topic is null or left(p_topic, 6) <> 'match:' then
    return false;
  end if;
  begin
    v_match_id := substring(p_topic from 7)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1 from public.matches m
    where m.id = v_match_id
      and (m.a_id = public.current_profile_id() or m.b_id = public.current_profile_id())
      and (m.a_id is null or m.b_id is null or not public.is_blocked(m.a_id, m.b_id))
  );
end;
$$;

revoke execute on function public.can_access_match_topic(text) from public, anon;
grant execute on function public.can_access_match_topic(text) to authenticated;

-- realtime.messages RLS: 읽기(=채널 구독)만 허용. 쓰기 정책은 의도적으로 없음.
--   로컬/셀프호스트에 realtime 스키마가 없을 수 있어 방어적으로 실행한다.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise warning 'DUCKMATE: realtime.messages 가 없어 private 채널 정책을 건너뜁니다 (Supabase 환경에서 재적용 필요).';
    return;
  end if;
  if to_regprocedure('realtime.topic()') is null then
    raise warning 'DUCKMATE: realtime.topic() 이 없어 private 채널 정책을 건너뜁니다 (Realtime 버전 확인 필요).';
    return;
  end if;

  execute 'drop policy if exists chat_match_topic_read on realtime.messages';
  execute $p$
    create policy chat_match_topic_read on realtime.messages
      for select to authenticated
      using (
        extension = 'broadcast'
        and public.can_access_match_topic(realtime.topic())
      )
  $p$;
exception
  when insufficient_privilege then
    raise warning 'DUCKMATE: realtime.messages 정책 생성 권한 부족 — Supabase 대시보드/service role 로 재적용 필요.';
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. mark_read(match_id) — 상대가 보낸 미읽음 메시지를 일괄 읽음 처리
--    반환 = 처리한 행 수. 문장 트리거가 message_read broadcast 1회 발사.
--    클라이언트가 read_at 을 직접 update 해도 동작하지만(00003 grant),
--    참여자·차단 검증과 단일 broadcast 를 보장하려면 이 함수를 쓴다(E3 규약).
-- -----------------------------------------------------------------------------
create or replace function public.mark_read(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me    uuid := public.current_profile_id();
  v_count integer;
begin
  if v_me is null then
    raise exception 'DUCKMATE_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.a_id = v_me or m.b_id = v_me)
      and (m.a_id is null or m.b_id is null or not public.is_blocked(m.a_id, m.b_id))
  ) then
    -- 존재 노출 방지: 비참여자·차단 모두 동일 코드
    raise exception 'DUCKMATE_MATCH_NOT_FOUND';
  end if;

  update public.messages
     set read_at = now()
   where match_id = p_match_id
     and sender_id is distinct from v_me
     and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_read(uuid) from public, anon;
grant execute on function public.mark_read(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. chat_rooms 뷰 — /chat 목록 (12_flows §4.1)
--    security_invoker = on → 하위 테이블 RLS·컬럼 권한이 그대로 적용된다.
--      · matches       : matches_select_participant (차단 시 방 자체 비노출)
--      · messages      : messages_select_participant + 컬럼 grant(masked_body 만)
--      · profiles(상대): profiles_select_visible(can_view_profile)
--        → 탈퇴(set null)·차단·정지 상대는 partner_* 가 null 로 내려온다
--          = 12_flows §8.10 "대화를 종료한 상대예요" 익명 처리에 그대로 대응.
--    정렬 키 sort_at = 마지막 메시지 시각, 없으면 matched_at (새 매칭 스트립).
-- -----------------------------------------------------------------------------
create or replace view public.chat_rooms
  with (security_invoker = on) as
with mine as (
  select
    m.id,
    m.status,
    m.matched_at,
    m.closed_at,
    m.first_suggestion,
    public.current_profile_id() as me_id,
    case when m.a_id = public.current_profile_id() then m.b_id else m.a_id end as partner_id
  from public.matches m
  where m.a_id = public.current_profile_id()
     or m.b_id = public.current_profile_id()
)
select
  mine.id                      as match_id,
  mine.status,
  mine.matched_at,
  mine.closed_at,
  mine.first_suggestion,
  mine.me_id                   as my_profile_id,
  mine.partner_id,
  p.nickname                   as partner_nickname,
  p.verify_level               as partner_verify_level,
  p.fav_note                   as partner_fav_note,
  p.current_obsession          as partner_current_obsession,
  p.mode                       as partner_mode,
  p.region_code                as partner_region_code,
  last_msg.id                  as last_message_id,
  last_msg.masked_body         as last_message_body,
  last_msg.sender_id           as last_message_sender_id,
  last_msg.image_path          as last_message_image_path,
  last_msg.created_at          as last_message_at,
  coalesce(unread.cnt, 0)      as unread_count,
  coalesce(last_msg.created_at, mine.matched_at) as sort_at,
  -- A5 §5.3 해제 조건: matched_at + 72h && 양측 Lv≥2 (상대 비노출이면 잠금 유지)
  (
    now() >= mine.matched_at + interval '72 hours'
    and coalesce(me.verify_level, 0) >= 2
    and coalesce(p.verify_level, 0) >= 2
  )                            as contact_unlocked
from mine
left join public.profiles me   on me.id = mine.me_id
left join public.profiles p    on p.id  = mine.partner_id
left join lateral (
  select msg.id, msg.masked_body, msg.sender_id, msg.image_path, msg.created_at
  from public.messages msg
  where msg.match_id = mine.id
  order by msg.id desc
  limit 1
) last_msg on true
left join lateral (
  select count(*)::integer as cnt
  from public.messages msg
  where msg.match_id = mine.id
    and msg.sender_id is distinct from mine.me_id
    and msg.read_at is null
) unread on true;

revoke all on public.chat_rooms from anon;
grant select on public.chat_rooms to authenticated;

comment on view public.chat_rooms is
  'D4 · /chat 목록용 뷰. security_invoker=on 이므로 RLS·컬럼 권한이 그대로 적용된다. 원문 body/mask_rules 는 어떤 컬럼으로도 노출하지 않는다.';
comment on function public.mark_read(uuid) is
  'D4 · 상대가 보낸 미읽음 메시지 일괄 읽음 처리. 반환=처리 행 수. message_read broadcast 1회 발사.';
comment on function public.can_access_match_topic(text) is
  'D4 · Realtime private 채널 인가 — topic "match:{match_id}" 참여자 판정(차단 시 false).';
