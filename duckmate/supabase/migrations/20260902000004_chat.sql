-- =============================================================================
-- 0004 — chat: messages, message_flags
-- 원문 body 는 발신자 + service role 만. 수신자는 v_messages 뷰(0010)로 masked_body 만.
-- =============================================================================

create table public.messages (
  id                      uuid primary key default gen_random_uuid(),
  match_id                uuid not null references public.matches(id) on delete cascade,
  sender_id               uuid not null references public.profiles(id) on delete cascade,
  body                    text,                                 -- 원문(증거). 컬럼 권한으로 authenticated select 금지
  masked_body             text not null,                        -- 서버(D4)가 룰 평가 후 생성. 클라이언트는 항상 이것만 렌더
  image_path              text,                                 -- storage 'chat-images': {match_id}/{message_id}.webp
  suggestion_template_id  text,                                 -- 제안 카드로 자동 전송된 첫 메시지
  is_held                 boolean not null default false,       -- BW_* hold: 수신자 미전달
  created_at              timestamptz not null default now(),
  read_at                 timestamptz,
  constraint messages_has_content check (body is not null or image_path is not null),
  constraint messages_image_path_prefix check (image_path is null or image_path like match_id::text || '/%')
);

create table public.message_flags (
  id          bigint generated always as identity primary key,
  message_id  uuid not null references public.messages(id) on delete cascade,
  rule_id     text not null,                                    -- CT_* / BW_* / SC_* / MN_* (packages/db/src/safety-rules.ts)
  matched     text,                                             -- 매칭된 원문 조각(증거용)
  score       smallint not null default 0,
  created_at  timestamptz not null default now()
);
