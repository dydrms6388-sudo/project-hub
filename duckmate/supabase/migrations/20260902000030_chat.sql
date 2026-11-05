-- =============================================================================
-- 0030 — chat (D4): 서버측 마스킹(SQL 최종 방어) · send_message RPC · 읽음/나가기 · 채팅 목록 · 신고 미리보기 ·
--        Realtime 브로드캐스트(masked 페이로드만) · 상한
-- 의존: 0001~0014 (can_send_message / can_send_chat_image / create_report / issue_sanction / check_rate_limit).
-- 원칙:
--   · 원문 body 는 절대 Realtime 으로 나가지 않는다 → messages 를 supabase_realtime publication 에 **추가하지 않고**
--     AFTER INSERT(커밋 시점) 트리거가 realtime.send() 로 masked 페이로드만 private 채널 match:{id} / inbox:{profile_id} 에 보낸다.
--   · masked_body 는 TS(safety-rules.ts)가 1차, 이 파일의 mask_contacts()(동일 정규식 문자열, ARE) 가 최종 방어.
--     BEFORE INSERT 트리거가 모든 insert 경로(D3 첫 메시지 포함)에 재마스킹을 강제한다. 해제 = matched_at+72h AND 양쪽 L3.
--   · messages 직접 insert 는 authenticated 에서 회수(D1 §0-10: 클라이언트 직접 쓰기는 read_at 만). 전송은 send_message(service role) 만.
--   · 새 service 전용 함수는 public/anon/authenticated 에서 execute 를 명시 회수한다(D2 §0-28).
-- =============================================================================

-- ---------- 마스킹 해제 조건 (A5 §7.1) ----------
create or replace function public.contact_unmasked(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.profiles a on a.id = m.a_id
    join public.profiles b on b.id = m.b_id
    where m.id = p_match_id
      and m.matched_at + interval '72 hours' <= now()
      and a.verify_level >= 3 and b.verify_level >= 3
  )
$$;

-- ---------- 연락처 탐지·마스킹 (packages/db/src/safety-rules.ts CONTACT_RULES 와 패턴 문자열 1:1, 순서 동일) ----------
-- 전처리: NFKC + zero-width 제거. 각 패턴의 첫 캡처 그룹 = 보존할 접두어(\1).
create or replace function public.contact_rule_patterns()
returns table (rule_id text, pattern text, placeholder text, ord integer)
language sql immutable as $$
  select * from (values
    ('CT_EMAIL',
     '()([A-Za-z0-9._%+-]{1,64}\s*(?:@|골뱅이|\(at\)|\[at\])\s*[A-Za-z0-9-]{1,63}(?:\s*(?:\.|닷|dot|\(dot\))\s*[A-Za-z0-9-]{1,63}){1,3})',
     '[연락처 숨김]', 1),
    ('CT_URL',
     '(^|[^A-Za-z0-9@./-])((?:https?://|www\.)[^\s]+|[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,3}\.(?:com|net|kr|me|link|io|co|xyz|site|app|shop|gg|tv|org|info|cc|ly|us|life|club|store|top|online|page|space|zone|pro|biz|ai|kim|one)(?:\.[A-Za-z]{2,3})?(?:/[^\s]*)?(?![A-Za-z0-9]))',
     '[링크 숨김]', 2),
    ('CT_PHONE',
     '(^|[^0-9+])([0o공영][\s._*·-]{0,3}[1li일][\s._*·-]{0,3}[016789lio공영일육칠팔구](?:[\s._*·-]{0,3}[0-9oli공영일이삼사오육칠팔구]){7,8}|\+?82[\s.-]{0,3}0?[\s.-]{0,3}1[\s.-]{0,3}[016789](?:[\s.-]{0,3}[0-9]){7,8})',
     '[연락처 숨김]', 3),
    ('CT_ACCOUNT',
     '()((?:은행|뱅크|bank|국민|신한|우리|하나|농협|기업|카뱅|토스|케이뱅크|케뱅|새마을|우체국|수협|씨티|제일|신협|저축|계좌)[^\n0-9]{0,10}[0-9](?:[\s-]{0,2}[0-9]){9,13})(?![0-9])',
     '[계좌 숨김]', 4),
    ('CT_KAKAO',
     '()((?:카[\s._-]{0,2}카[\s._-]{0,2}오[\s._-]{0,2}톡|카[\s._-]{0,2}톡|카카오|kakao[\s._-]{0,2}talk|kakao|katalk|kkt|ㅋㅌ|ᄏᄐ|open\.kakao\.com|오픈[\s._-]{0,2}(?:채팅|톡)|옾[\s._-]{0,2}(?:챗|톡))[^\n]{0,12}(?=[A-Za-z0-9._-]{0,29}[A-Za-z])[A-Za-z0-9._-]{4,20})(?![A-Za-z0-9])',
     '[연락처 숨김]', 5),
    ('CT_TELEGRAM_LINE',
     '(^|[^A-Za-z])((?:텔레그램|텔레|telegram|tg|t\.me/|라인[\s._:@-]{0,3}(?:아이디|id)|line[\s._:@-]{0,3}id)[\s._:@는은-]{0,4}(?=[A-Za-z0-9._-]{0,29}[A-Za-z])[A-Za-z0-9._]{3,32})(?![A-Za-z0-9])',
     '[연락처 숨김]', 6),
    ('CT_INSTA',
     '(^|[^A-Za-z])((?:인스타그램|인스타|인별|instagram|insta|ig)[\s._:@-]{0,3}(?:아이디|id)?[\s._:@는은-]{0,4}(?=[A-Za-z0-9._-]{0,29}[A-Za-z])[A-Za-z0-9._]{3,30}|@(?=[A-Za-z0-9._-]{0,29}[A-Za-z])[A-Za-z0-9._]{3,30})(?![A-Za-z0-9])',
     '[연락처 숨김]', 7)
  ) as t(rule_id, pattern, placeholder, ord)
$$;

create or replace function public.safety_preprocess(p_text text)
returns text language sql immutable as $$
  select regexp_replace(normalize(coalesce(p_text, ''), NFKC), '[​‌‍﻿⁠]', '', 'g')
$$;

-- {masked, hits:[{rule_id, matched}]} — TS maskContacts() 와 같은 결과
create or replace function public.detect_contacts(p_text text)
returns jsonb language plpgsql immutable as $$
declare
  v_text  text := public.safety_preprocess(p_text);
  v_rule  record;
  v_m     text[];
  v_hits  jsonb := '[]'::jsonb;
begin
  for v_rule in select * from public.contact_rule_patterns() order by ord loop
    for v_m in select regexp_matches(v_text, v_rule.pattern, 'gi') loop
      v_hits := v_hits || jsonb_build_object('rule_id', v_rule.rule_id, 'matched', left(v_m[2], 120));
    end loop;
    v_text := regexp_replace(v_text, v_rule.pattern, '\1' || v_rule.placeholder, 'gi');
  end loop;
  return jsonb_build_object('masked', v_text, 'hits', v_hits);
end $$;

create or replace function public.mask_contacts(p_text text)
returns text language sql immutable as $$
  select public.detect_contacts(p_text) ->> 'masked'
$$;
comment on function public.mask_contacts is 'SQL 최종 방어 마스킹. packages/db/src/safety-rules.ts CONTACT_RULES 와 동일 패턴(변경 시 양쪽 동시 수정 + 대조 테스트).';

-- ---------- BEFORE INSERT: 모든 insert 경로에 재마스킹 강제 ----------
create or replace function public.trg_messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.masked_body is null then
    -- D1 §0-22: 기본값으로 원문 복사 금지. 호출자가 반드시 채운다(누락 시 NOT NULL 로 실패).
    return new;
  end if;
  if new.body is null then
    new.masked_body := coalesce(nullif(new.masked_body, ''), '[사진]');
    return new;
  end if;
  if public.contact_unmasked(new.match_id) then
    new.masked_body := new.body;            -- 72h + 양쪽 L3: 원문 그대로
  else
    new.masked_body := public.mask_contacts(new.masked_body);   -- TS 결과 위에 SQL 재마스킹 (합집합)
  end if;
  return new;
end $$;
drop trigger if exists trg_messages_before_insert on public.messages;
create trigger trg_messages_before_insert before insert on public.messages
  for each row execute function public.trg_messages_before_insert();

-- ---------- Realtime: 커밋 시점에 masked 페이로드만 브로드캐스트 ----------
-- realtime.send(payload, event, topic, private) 는 Supabase 런타임 함수. 없거나 실패해도 메시지 insert 는 성공해야 한다.
create or replace function public.realtime_send_safe(p_payload jsonb, p_event text, p_topic text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  raise warning 'realtime.send skipped (%): %', sqlstate, sqlerrm;
end $$;

create or replace function public.trg_messages_broadcast()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_match      public.matches%rowtype;
  v_recipient  uuid;
  v_scam       boolean;
  v_preview    text;
begin
  if new.is_held then return null; end if;                       -- hold: 수신자 미전달
  select * into v_match from public.matches where id = new.match_id;
  if not found then return null; end if;
  v_recipient := case when v_match.a_id = new.sender_id then v_match.b_id else v_match.a_id end;
  v_scam := exists (select 1 from public.message_flags f where f.message_id = new.id and f.rule_id in ('SC_MONEY', 'SC_INVEST'));
  v_preview := left(case when new.image_path is not null then '[사진]' else new.masked_body end, 80);

  perform public.realtime_send_safe(jsonb_build_object(
    'id', new.id, 'match_id', new.match_id, 'sender_id', new.sender_id,
    'masked_body', new.masked_body, 'image_path', new.image_path,
    'suggestion_template_id', new.suggestion_template_id,
    'created_at', new.created_at, 'scam_signal', v_scam
  ), 'message', 'match:' || new.match_id::text);

  perform public.realtime_send_safe(jsonb_build_object(
    'match_id', new.match_id, 'message_id', new.id, 'sender_id', new.sender_id,
    'preview', v_preview, 'created_at', new.created_at
  ), 'inbox', 'inbox:' || v_recipient::text);
  return null;
end $$;
drop trigger if exists trg_messages_broadcast on public.messages;
-- constraint trigger(deferred) = 커밋 직전 실행 → send_message 가 넣은 message_flags 를 볼 수 있다
create constraint trigger trg_messages_broadcast after insert on public.messages
  deferrable initially deferred for each row execute function public.trg_messages_broadcast();

create or replace function public.trg_matches_status_broadcast()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_payload jsonb;
begin
  if new.status is not distinct from old.status then return null; end if;
  v_payload := jsonb_build_object('match_id', new.id, 'status', new.status, 'ended_at', new.ended_at);
  perform public.realtime_send_safe(v_payload, 'match_status', 'match:' || new.id::text);
  perform public.realtime_send_safe(v_payload, 'match_status', 'inbox:' || new.a_id::text);
  perform public.realtime_send_safe(v_payload, 'match_status', 'inbox:' || new.b_id::text);
  return null;
end $$;
drop trigger if exists trg_matches_status_broadcast on public.matches;
create trigger trg_matches_status_broadcast after update of status on public.matches
  for each row execute function public.trg_matches_status_broadcast();

-- private 채널 구독 권한: realtime.messages RLS (Supabase 런타임에만 존재 → 있을 때만 생성)
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists dm_chat_topics_read on realtime.messages';
    execute $p$
      create policy dm_chat_topics_read on realtime.messages for select to authenticated
      using (
        (realtime.topic() ~ '^match:[0-9a-f-]{36}$'
           and public.is_match_participant(substr(realtime.topic(), 7)::uuid, public.current_profile_id()))
        or (realtime.topic() ~ '^inbox:[0-9a-f-]{36}$'
           and substr(realtime.topic(), 7)::uuid = public.current_profile_id())
      )
    $p$;
  else
    raise notice 'realtime.messages not present — skipping broadcast RLS policy (local PG)';
  end if;
end $$;

-- ---------- 자동 신고 (24h 중복 방지, system) ----------
create or replace function public.auto_report_once(
  p_target_id uuid, p_reason public.report_reason, p_match_id uuid, p_detail text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_res jsonb;
begin
  select id into v_id from public.reports
  where target_id = p_target_id and reason_code = p_reason and surface = 'system'
    and reporter_id is null and created_at > now() - interval '24 hours'
    and status not in ('dismissed')
  order by created_at desc limit 1;
  if v_id is not null then return null; end if;
  v_res := public.create_report(p_target_id, p_reason, p_detail, p_match_id, 'system', null);
  return (v_res ->> 'report_id')::uuid;
end $$;

-- ---------- send_message (service role 전용) ----------
--   p_flags: TS scoreMessage().flags → [{rule_id, matched, score}] (서버 액션이 계산; 클라이언트 값 아님)
--   p_client_masked: TS maskContacts().masked (SQL 이 그 위에 재마스킹)
create or replace function public.send_message(
  p_match_id       uuid,
  p_sender_id      uuid,
  p_body           text default null,
  p_image_path     text default null,
  p_flags          jsonb default '[]'::jsonb,
  p_message_id     uuid default null,
  p_client_masked  text default null,
  p_suggestion_template_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_match        public.matches%rowtype;
  v_sender       public.profiles%rowtype;
  v_partner      public.profiles%rowtype;
  v_body         text := nullif(btrim(coalesce(p_body, '')), '');
  v_id           uuid := coalesce(p_message_id, gen_random_uuid());
  v_unmasked     boolean;
  v_detect       jsonb;
  v_masked       text;
  v_flags        jsonb := '[]'::jsonb;
  v_rule_ids     text[] := '{}';
  v_f            jsonb;
  v_today        integer;
  v_streak       integer;
  v_day_start    timestamptz;
  v_is_held      boolean := false;
  v_ct_count     integer := 0;
  v_scam_7d      integer := 0;
  v_scam_now     integer := 0;
  v_auto         jsonb := '[]'::jsonb;
  v_report       uuid;
  v_prior_same   integer;
  v_refused      boolean := false;
  v_partner_id   uuid;
  v_hold_reason  text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN: send_message is service role only' using errcode = '42501';
  end if;
  if p_match_id is null or p_sender_id is null then
    raise exception 'INVALID_INPUT: match/sender required' using errcode = 'check_violation';
  end if;
  if v_body is null and p_image_path is null then
    raise exception 'INVALID_INPUT: body or image required' using errcode = 'check_violation';
  end if;
  if v_body is not null and char_length(v_body) > 2000 then
    raise exception 'INVALID_INPUT: body too long' using errcode = 'check_violation';
  end if;
  if p_image_path is not null and p_image_path not like p_match_id::text || '/%' then
    raise exception 'INVALID_INPUT: image path prefix' using errcode = 'check_violation';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NOT_FOUND: match' using errcode = 'no_data_found'; end if;
  if p_sender_id not in (v_match.a_id, v_match.b_id) then
    raise exception 'FORBIDDEN: not a participant' using errcode = '42501';
  end if;
  v_partner_id := case when v_match.a_id = p_sender_id then v_match.b_id else v_match.a_id end;
  select * into v_sender from public.profiles where id = p_sender_id;
  select * into v_partner from public.profiles where id = v_partner_id;

  -- 판정 함수 공유(D1 §0-9) + 실패 사유 매핑
  if not public.can_send_message(p_match_id, p_sender_id) then
    if v_match.status <> 'active' then
      raise exception 'NOT_ENTITLED: MATCH_%', upper(v_match.status::text) using errcode = '42501';
    elsif public.active_sanction_level(p_sender_id) >= 2 then
      raise exception 'SANCTIONED: chat_restricted' using errcode = '42501';
    elsif v_sender.verify_level < 2 or v_partner.verify_level < 2 then
      raise exception 'NOT_VERIFIED' using errcode = '42501';
    elsif public.are_blocked(v_match.a_id, v_match.b_id) then
      raise exception 'NOT_ENTITLED: BLOCKED' using errcode = '42501';
    else
      raise exception 'NOT_ENTITLED: cannot_send' using errcode = '42501';
    end if;
  end if;
  if p_image_path is not null and not public.can_send_chat_image(p_match_id, p_sender_id) then
    raise exception 'NOT_ENTITLED: IMAGE_NOT_ALLOWED' using errcode = '42501';
  end if;

  -- 상한: 매칭당 200/일(loop_date), 미응답 상대에게 연속 20개
  v_day_start := (public.loop_date(now())::timestamp + interval '7 hours') at time zone 'Asia/Seoul';
  select count(*) into v_today from public.messages
  where match_id = p_match_id and sender_id = p_sender_id and created_at >= v_day_start;
  if v_today >= 200 then
    raise exception 'RATE_LIMITED: DAILY_CAP' using errcode = '42501';
  end if;
  select count(*) into v_streak from (
    select sender_id from public.messages where match_id = p_match_id order by created_at desc limit 20
  ) t where t.sender_id = p_sender_id;
  if v_streak >= 20 then
    raise exception 'RATE_LIMITED: WAIT_FOR_REPLY' using errcode = '42501';
  end if;

  -- ---- 마스킹 (SQL 최종) + 연락처 히트 ----
  v_unmasked := public.contact_unmasked(p_match_id);
  if v_body is null then
    v_masked := '[사진]';
    v_detect := jsonb_build_object('masked', '[사진]', 'hits', '[]'::jsonb);
  else
    v_detect := public.detect_contacts(v_body);                                   -- 히트는 원문 기준
    v_masked := case when v_unmasked then v_body
                     else public.mask_contacts(coalesce(p_client_masked, v_body)) end;   -- TS 결과 위에 재마스킹
  end if;

  -- TS 플래그 + SQL 연락처 히트 병합 (rule_id 단위 dedupe)
  for v_f in select * from jsonb_array_elements(coalesce(p_flags, '[]'::jsonb)) loop
    if (v_f ->> 'rule_id') is not null and not ((v_f ->> 'rule_id') = any (v_rule_ids)) then
      v_rule_ids := v_rule_ids || (v_f ->> 'rule_id');
      v_flags := v_flags || jsonb_build_object('rule_id', v_f ->> 'rule_id', 'matched', left(v_f ->> 'matched', 120),
                                               'score', coalesce((v_f ->> 'score')::integer, 0));
    end if;
  end loop;
  for v_f in select * from jsonb_array_elements(v_detect -> 'hits') loop
    if not ((v_f ->> 'rule_id') = any (v_rule_ids)) then
      v_rule_ids := v_rule_ids || (v_f ->> 'rule_id');
      v_flags := v_flags || jsonb_build_object('rule_id', v_f ->> 'rule_id', 'matched', v_f ->> 'matched', 'score', 0);
      if v_f ->> 'rule_id' = 'CT_ACCOUNT' and not ('SC_MONEY' = any (v_rule_ids)) then
        v_rule_ids := v_rule_ids || 'SC_MONEY'::text;
        v_flags := v_flags || jsonb_build_object('rule_id', 'SC_MONEY', 'matched', 'CT_ACCOUNT', 'score', 3);
      end if;
    end if;
  end loop;

  -- 행동형 시그널: SC_OFFAPP(매칭 24h 내 CT 2회↑), SC_TEMPLATE(같은 30자↑ 문장을 매칭 3개에)
  if exists (select 1 from unnest(v_rule_ids) r where r like 'CT\_%' and r <> 'CT_LURE') then
    select count(distinct m.id) + 1 into v_ct_count
    from public.messages m join public.message_flags f on f.message_id = m.id
    where m.match_id = p_match_id and m.sender_id = p_sender_id and f.rule_id like 'CT\_%' and f.rule_id <> 'CT_LURE'
      and m.body is distinct from m.masked_body;
    if not v_unmasked and v_match.matched_at + interval '24 hours' > now() and v_ct_count >= 2
       and not ('SC_OFFAPP' = any (v_rule_ids)) then
      v_rule_ids := v_rule_ids || 'SC_OFFAPP'::text;
      v_flags := v_flags || jsonb_build_object('rule_id', 'SC_OFFAPP', 'matched', null, 'score', 2);
    end if;
  end if;
  if v_body is not null and char_length(v_body) >= 30 then
    if (select count(distinct match_id) from public.messages
        where sender_id = p_sender_id and match_id <> p_match_id and body = v_body
          and created_at > now() - interval '7 days') >= 2 then
      v_rule_ids := v_rule_ids || 'SC_TEMPLATE'::text;
      v_flags := v_flags || jsonb_build_object('rule_id', 'SC_TEMPLATE', 'matched', left(v_body, 60), 'score', 3);
    end if;
  end if;

  -- ---- hold 판정 (A5 §7.2) ----
  if 'BW_ILLEGAL' = any (v_rule_ids) then v_is_held := true; v_hold_reason := 'BW_ILLEGAL'; end if;
  if 'BW_ADULT_BIZ' = any (v_rule_ids) then v_is_held := true; v_hold_reason := coalesce(v_hold_reason, 'BW_ADULT_BIZ'); end if;
  foreach v_hold_reason in array array['BW_SEXUAL', 'BW_HATE'] loop
    if v_hold_reason = any (v_rule_ids) then
      select count(*) into v_prior_same
      from public.messages m join public.message_flags f on f.message_id = m.id
      where m.match_id = p_match_id and m.sender_id = p_sender_id and f.rule_id = v_hold_reason;
      if v_prior_same >= 1 then v_is_held := true; end if;
    end if;
  end loop;
  -- A5 §7.4: BW_SEXUAL + 상대의 직전 3개 메시지에 거절 표현
  if 'BW_SEXUAL' = any (v_rule_ids) then
    select bool_or(m.masked_body ~ '(싫어|하지 ?마|불편|그만|안할래|싫다고|부담스러)') into v_refused
    from (select masked_body from public.messages where match_id = p_match_id and sender_id = v_partner_id
          order by created_at desc limit 3) m;
    v_refused := coalesce(v_refused, false);
  end if;

  -- ---- insert ----
  insert into public.messages (id, match_id, sender_id, body, masked_body, image_path, suggestion_template_id, is_held)
  values (v_id, p_match_id, p_sender_id, v_body, v_masked, p_image_path, p_suggestion_template_id, v_is_held);

  insert into public.message_flags (message_id, rule_id, matched, score)
  select v_id, f ->> 'rule_id', f ->> 'matched', coalesce((f ->> 'score')::integer, 0)
  from jsonb_array_elements(v_flags) f;

  -- ---- 자동 조치 ----
  -- 연락처 우회 3회 (같은 매칭, 같은 발신자, 마스킹된 히트만) → OFF_PLATFORM_LURE (P2)
  if v_ct_count >= 3 and v_ct_count % 3 = 0 and not v_unmasked then
    v_report := public.auto_report_once(p_sender_id, 'OFF_PLATFORM_LURE', p_match_id,
      'AUTO: 같은 매칭에서 연락처 패턴 ' || v_ct_count || '회');
    if v_report is not null then v_auto := v_auto || to_jsonb('OFF_PLATFORM_LURE'::text); end if;
  end if;
  if 'BW_VIOLENCE' = any (v_rule_ids) then
    v_report := public.auto_report_once(p_sender_id, 'THREAT_VIOLENCE', p_match_id, 'AUTO:BW_VIOLENCE');
    if v_report is not null then v_auto := v_auto || to_jsonb('THREAT_VIOLENCE'::text); end if;
  end if;
  if 'BW_ILLEGAL' = any (v_rule_ids) then
    v_report := public.auto_report_once(p_sender_id, 'OTHER', p_match_id, 'AUTO:BW_ILLEGAL 불법 콘텐츠·마약 은어');
    if v_report is not null then v_auto := v_auto || to_jsonb('BW_ILLEGAL'::text); end if;
  end if;
  if 'BW_ADULT_BIZ' = any (v_rule_ids) then
    v_report := public.auto_report_once(p_sender_id, 'COMMERCIAL_SPAM', p_match_id, 'AUTO:BW_ADULT_BIZ');
    if v_report is not null then v_auto := v_auto || to_jsonb('COMMERCIAL_SPAM'::text); end if;
  end if;
  if 'BW_SEXUAL' = any (v_rule_ids) and (v_refused or (v_is_held and 'BW_SEXUAL' = any (v_rule_ids))) then
    v_report := public.auto_report_once(p_sender_id, 'SEXUAL_HARASSMENT', p_match_id,
      case when v_refused then 'AUTO:BW_SEXUAL 거절 이후 지속' else 'AUTO:BW_SEXUAL 2회' end);
    if v_report is not null then
      v_auto := v_auto || to_jsonb('SEXUAL_HARASSMENT'::text);
      if v_refused and public.active_sanction_level(p_sender_id) < 2 then
        perform public.issue_sanction(p_sender_id, 2, 'AUTO:BW_SEXUAL_REFUSED', interval '24 hours', v_report, 'SEXUAL_HARASSMENT', null);
        v_auto := v_auto || to_jsonb('chat_restricted_24h'::text);
      end if;
    end if;
  end if;
  if 'BW_HATE' = any (v_rule_ids) and v_is_held then
    v_report := public.auto_report_once(p_sender_id, 'HATE_SPEECH', p_match_id, 'AUTO:BW_HATE 2회');
    if v_report is not null then v_auto := v_auto || to_jsonb('HATE_SPEECH'::text); end if;
  end if;
  -- 미성년 시그널: MN_AGE 단독 또는 MN 2종 → MINOR_SUSPECT (create_report 가 비노출) + 채팅 제한 24h
  if 'MN_AGE' = any (v_rule_ids) or ('MN_SCHOOL' = any (v_rule_ids) and 'MN_AGE' = any (v_rule_ids)) then
    v_report := public.auto_report_once(p_sender_id, 'MINOR_SUSPECT', p_match_id, 'AUTO:MN 시그널');
    if v_report is not null then
      v_auto := v_auto || to_jsonb('MINOR_SUSPECT'::text);
      if public.active_sanction_level(p_sender_id) < 2 then
        perform public.issue_sanction(p_sender_id, 2, 'AUTO:MN_AGE', interval '24 hours', v_report, 'MINOR_SUSPECT', null);
        v_auto := v_auto || to_jsonb('chat_restricted_24h'::text);
      end if;
    end if;
  end if;
  -- 스캠 점수 7일 롤링(프로필 단위): ≥5 자동 신고 P0(+create_report 자동 24h 제한), ≥8 비노출
  select coalesce(sum(f.score), 0) into v_scam_7d
  from public.message_flags f join public.messages m on m.id = f.message_id
  where m.sender_id = p_sender_id and f.rule_id like 'SC\_%' and f.created_at > now() - interval '7 days';
  select coalesce(sum((f ->> 'score')::integer), 0) into v_scam_now
  from jsonb_array_elements(v_flags) f where (f ->> 'rule_id') like 'SC\_%';
  if v_scam_now > 0 and v_scam_7d >= 5 then
    v_report := public.auto_report_once(p_sender_id, 'ROMANCE_SCAM', p_match_id, 'AUTO:SC 점수 ' || v_scam_7d || ' (7일)');
    if v_report is not null then v_auto := v_auto || to_jsonb('ROMANCE_SCAM'::text); end if;
    if v_scam_7d >= 8 then
      update public.profiles set hidden_at = coalesce(hidden_at, now()), hidden_reason = coalesce(hidden_reason, 'SCAM_SCORE')
      where id = p_sender_id and hidden_at is null;
      v_auto := v_auto || to_jsonb('profile_hidden_scam'::text);
    end if;
  end if;

  return jsonb_build_object(
    'message_id', v_id,
    'masked_body', v_masked,
    'is_held', v_is_held,
    'unmasked', v_unmasked,
    'flags', (select coalesce(jsonb_agg(f ->> 'rule_id'), '[]'::jsonb) from jsonb_array_elements(v_flags) f),
    'contact_hit_count', v_ct_count,
    'warn_contact', v_ct_count >= 3,
    'scam_banner', ('SC_MONEY' = any (v_rule_ids)) or ('SC_INVEST' = any (v_rule_ids)),
    'scam_score_7d', v_scam_7d,
    'auto_actions', v_auto,
    'created_at', (select created_at from public.messages where id = v_id)
  );
end $$;
comment on function public.send_message is
  'service role 전용(서버 액션 sendMessage). can_send_message/can_send_chat_image 검사 → 상한 → SQL 재마스킹 → message_flags → 자동 조치. 반환 {message_id, masked_body, is_held, flags, contact_hit_count, warn_contact, scam_banner, auto_actions}.';

-- ---------- mark_read / leave_match (authenticated) ----------
create or replace function public.mark_read(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id(); v_n integer;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if not public.is_match_participant(p_match_id, v_me) then
    raise exception 'FORBIDDEN: not a participant' using errcode = '42501';
  end if;
  update public.messages set read_at = now()
  where match_id = p_match_id and sender_id <> v_me and read_at is null and not is_held;
  get diagnostics v_n = row_count;
  return jsonb_build_object('match_id', p_match_id, 'marked', v_n);
end $$;

create or replace function public.leave_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_profile_id(); v_match public.matches%rowtype;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NOT_FOUND: match' using errcode = 'no_data_found'; end if;
  if v_me not in (v_match.a_id, v_match.b_id) then
    raise exception 'FORBIDDEN: not a participant' using errcode = '42501';
  end if;
  if v_match.status <> 'active' then
    return jsonb_build_object('match_id', p_match_id, 'status', v_match.status, 'changed', false);
  end if;
  update public.matches set status = 'left', ended_at = now() where id = p_match_id;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, meta)
  values (auth.uid(), 'user', 'match_left', 'match', p_match_id::text, jsonb_build_object('profile_id', v_me));
  return jsonb_build_object('match_id', p_match_id, 'status', 'left', 'changed', true);
end $$;

-- ---------- 채팅 목록 / 방 헤더 (authenticated) ----------
-- v_my_matches 와 같은 가시성(차단자 화면에서는 제거) + 상대 요약(v_profile_public 의 age_band 계산 동일) + 시각·권한 파생값.
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
      case when p_match_id is not null then mt.first_suggestion else null end as first_suggestion
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
comment on function public.get_chat_list is '채팅 목록(인자 없음) / 방 헤더(p_match_id). 차단자 화면에서는 방 제거, 피차단자·left·paused 는 status 로 남는다.';

-- ---------- 신고 화면 미리보기: 최근 5개 ----------
create or replace function public.get_report_context(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when public.current_profile_id() is null then null
    when not public.is_match_participant(p_match_id, public.current_profile_id()) then null
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id, 'is_mine', m.sender_id = public.current_profile_id(),
        'display_body', case when m.sender_id = public.current_profile_id() then m.body else m.masked_body end,
        'has_image', m.image_path is not null, 'created_at', m.created_at) order by m.created_at)
      from (select * from public.messages
            where match_id = p_match_id and (not is_held or sender_id = public.current_profile_id())
            order by created_at desc limit 5) m), '[]'::jsonb)
  end
$$;

-- ---------- 인덱스 ----------
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);

-- ---------- 권한 ----------
-- 클라이언트 직접 insert 회수: 전송은 send_message 뿐 (RLS insert 정책은 남겨 두되 grant 가 없으므로 도달 불가)
revoke insert on public.messages from authenticated;

revoke execute on function
  public.contact_unmasked(uuid), public.contact_rule_patterns(), public.safety_preprocess(text),
  public.detect_contacts(text), public.mask_contacts(text),
  public.realtime_send_safe(jsonb, text, text), public.auto_report_once(uuid, public.report_reason, uuid, text),
  public.send_message(uuid, uuid, text, text, jsonb, uuid, text, text),
  public.mark_read(uuid), public.leave_match(uuid), public.get_chat_list(uuid), public.get_report_context(uuid)
from public, anon, authenticated;

grant execute on function
  public.contact_unmasked(uuid), public.mask_contacts(text), public.detect_contacts(text),
  public.mark_read(uuid), public.leave_match(uuid), public.get_chat_list(uuid), public.get_report_context(uuid)
to authenticated, service_role;

grant execute on function
  public.contact_rule_patterns(), public.safety_preprocess(text),
  public.realtime_send_safe(jsonb, text, text), public.auto_report_once(uuid, public.report_reason, uuid, text),
  public.send_message(uuid, uuid, text, text, jsonb, uuid, text, text)
to service_role;
