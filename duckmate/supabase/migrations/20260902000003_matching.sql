-- =============================================================================
-- 0003 — matching: daily_recommendations, likes, matches, blocks
-- =============================================================================

create table public.daily_recommendations (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  target_id     uuid not null references public.profiles(id) on delete cascade,
  loop_date     date not null,                              -- KST 07:00 경계 하루(loop_date()). 브리프의 `date`
  position      smallint not null default 0,
  score         numeric(5,4) not null check (score between 0 and 1),
  reasons       jsonb not null default '[]'::jsonb,
  is_from_liker boolean not null default false,             -- 나를 좋아한 사람(카드에 표기 금지)
  is_boosted    boolean not null default false,
  seen_at       timestamptz,
  acted_at      timestamptz,
  action        public.reco_action,
  created_at    timestamptz not null default now(),
  unique (profile_id, target_id, loop_date),
  constraint reco_not_self check (profile_id <> target_id),
  constraint reco_action_with_time check ((acted_at is null) = (action is null))
);

create table public.likes (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles(id) on delete cascade,
  to_id       uuid not null references public.profiles(id) on delete cascade,
  type        public.like_type not null default 'like',
  created_at  timestamptz not null default now(),
  unique (from_id, to_id),
  constraint likes_not_self check (from_id <> to_id)
);

create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  a_id              uuid not null references public.profiles(id) on delete cascade,
  b_id              uuid not null references public.profiles(id) on delete cascade,
  mode              public.profile_mode not null,           -- 매칭 당시 양쪽 모드(항상 동일)
  matched_at        timestamptz not null default now(),
  first_suggestion  jsonb not null default '[]'::jsonb,     -- [{id, template_id, title, body, kind}] ×3 (D3)
  status            public.match_status not null default 'active',
  ended_at          timestamptz,
  first_message_at  timestamptz,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint matches_ordered_pair check (a_id < b_id),      -- (least, greatest) 정규화 → unique(a_id,b_id) 가 곧 무순서 유니크
  unique (a_id, b_id)
);

create table public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
