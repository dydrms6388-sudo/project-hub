-- =============================================================================
-- 0008 — push_subscriptions, notification_log, analytics_events
-- =============================================================================

create table public.push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  endpoint          text not null unique,
  keys              jsonb not null,                            -- {"p256dh":"...","auth":"..."}
  user_agent        text,
  slot_a_enabled    boolean not null default true,             -- 07:30 추천 도착
  slot_b_enabled    boolean not null default true,             -- 19:30~21:00 이벤트형
  instant_enabled   boolean not null default true,             -- 매칭/답장(뭉침)
  created_at        timestamptz not null default now(),
  last_sent_at      timestamptz,
  disabled_at       timestamptz,                               -- 410 Gone 등
  constraint push_keys_shape check (keys ? 'p256dh' and keys ? 'auth')
);
comment on table public.push_subscriptions is '마케팅 푸시 허용 여부는 여기가 아니라 consents(key=marketing_push) 로 판단.';

create table public.notification_log (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  subscription_id   uuid references public.push_subscriptions(id) on delete set null,
  kind              public.push_kind not null,
  slot              public.push_slot not null,
  template          text not null,                             -- reco_ready / match_created / message_received / photo_reviewed …
  loop_date         date not null,                             -- 일 2건 상한은 loop_date 기준
  budget_consumed   boolean not null default true,             -- 매칭/답장 알림은 false(예산 미소비)
  like_id           uuid references public.likes(id) on delete set null,   -- "좋아요" 알림은 실제 like 행 필수(가짜 신호 금지)
  payload_hash      text,
  sent_at           timestamptz not null default now(),
  opened_at         timestamptz,
  error             text
);

create table public.analytics_events (
  id            bigint generated always as identity primary key,
  user_id_hash  text,                                          -- sha256(user_id + salt). 원문 id 저장 금지
  name          text not null check (name ~ '^[a-z][a-z0-9_]*$'),
  props         jsonb not null default '{}'::jsonb,
  loop_date     date not null,
  session_id    text,
  platform      text,
  created_at    timestamptz not null default now()
);
comment on table public.analytics_events is '가명 이벤트. 2년 보관. 원문 메시지·닉네임·전화번호 금지.';
