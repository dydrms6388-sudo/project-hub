-- =============================================================================
-- 0007 — game & events (SCHEMA ONLY)
-- ⚠️ Phase 2(게임) / Phase 5(이벤트) 전까지 쓰기 금지. Phase 1 앱 코드는 이 테이블을 읽지도 쓰지도 않는다.
-- =============================================================================

create table public.game_profiles (
  profile_id      uuid primary key references public.profiles(id) on delete cascade,
  level           integer not null default 1 check (level >= 1),
  xp              integer not null default 0 check (xp >= 0),
  streak_days     integer not null default 0 check (streak_days >= 0),
  last_played_at  timestamptz,
  coins           integer not null default 0 check (coins >= 0),
  updated_at      timestamptz not null default now()
);

create table public.game_sessions (
  id            uuid primary key default gen_random_uuid(),
  game_type     public.game_type not null,
  loop_date     date not null,
  participants  jsonb not null default '[]'::jsonb,           -- [profile_id, ...]
  state         jsonb not null default '{}'::jsonb,
  result        public.game_session_result not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.quests (
  id          smallint primary key,
  key         text not null unique,
  title       text not null,
  kind        public.quest_kind not null,
  reward      jsonb not null default '{}'::jsonb,             -- {"item_type":"superlike","qty":1}
  is_active   boolean not null default true
);

create table public.quest_progress (
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  quest_id      smallint not null references public.quests(id),
  loop_date     date not null,                                 -- daily: 해당 일 / weekly: 주 시작(월) loop_date
  progress      integer not null default 0 check (progress >= 0),
  completed_at  timestamptz,
  primary key (profile_id, quest_id, loop_date)
);

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  hobby_id      smallint references public.hobbies(id),
  title         text not null,
  description   text,
  region_code   text references public.regions(code),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  capacity      smallint not null default 8 check (capacity between 2 and 8),   -- 정원 ≤ 8 (A1 §10)
  host_id       uuid references public.profiles(id) on delete set null,          -- Phase 5 이전 운영팀 계정만
  status        public.event_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.event_rsvps (
  event_id    uuid not null references public.events(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  status      public.rsvp_status not null default 'going',
  created_at  timestamptz not null default now(),
  primary key (event_id, profile_id)
);
