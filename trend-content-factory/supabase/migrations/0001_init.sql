-- ─────────────────────────────────────────────────────────────
-- TREND CONTENT FACTORY — 초기 스키마
-- RLS: 모든 테이블 service_role 만 접근 (anon/authenticated 차단).
-- 토큰/시크릿은 이 스키마에 저장하지 않는다 → accounts.vault_secret_id 로 Vault 참조만.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── verticals: 버티컬 마스터 (config/verticals.ts 와 동기화) ──
create table if not exists public.verticals (
  slug          text primary key,
  topic         text not null,
  format        text not null check (format in ('card','reel','mixed')),
  handle_ig     text,
  handle_fb     text,
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ── accounts: 계정 (토큰은 Vault 참조 ID만) ──
create table if not exists public.accounts (
  id                uuid primary key default gen_random_uuid(),
  vertical_slug     text not null references public.verticals(slug),
  platform          text not null check (platform in ('ig','fb','tiktok','threads','x')),
  ig_user_id        text,
  fb_page_id        text,
  vault_secret_id   text,                       -- Supabase Vault secret id (토큰 원문 아님)
  warmup_started_at date,
  daily_cap_override int,
  state             text not null default 'active' check (state in ('active','paused','cooldown','disabled')),
  cooldown_until    timestamptz,
  created_at        timestamptz not null default now(),
  unique (vertical_slug, platform)
);

-- ── trends: 수집 트렌드 ──
create table if not exists public.trends (
  id             uuid primary key default gen_random_uuid(),
  vertical       text not null,
  title          text not null,
  summary        text not null default '',
  source_url     text not null default '',
  raw            jsonb not null default '{}'::jsonb,
  velocity_score real not null default 0,
  novelty_score  real not null default 0,
  collected_at   timestamptz not null default now()
);
create index if not exists idx_trends_vertical_collected on public.trends (vertical, collected_at desc);

-- ── drafts: 소재 초안 (Claude 산출) ──
create table if not exists public.drafts (
  id              uuid primary key default gen_random_uuid(),
  vertical        text not null,
  trend_id        uuid references public.trends(id) on delete set null,
  trend_title     text not null default '',
  format          text not null check (format in ('card','reel','mixed')),
  hook            text not null default '',
  slides          jsonb not null default '[]'::jsonb,
  caption         text not null default '',
  hashtags        jsonb not null default '[]'::jsonb,
  cta             text not null default '',
  reel_script     jsonb not null default '[]'::jsonb,
  risk_flags      jsonb not null default '[]'::jsonb,
  fact_confidence real not null default 0,
  source_url      text not null default '',
  status          text not null default 'draft' check (status in ('draft','rejected','approved')),
  mock            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_drafts_vertical_status on public.drafts (vertical, status);

-- ── reviews: 6-페르소나 심사 결과 (M3, Phase 2) ──
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  draft_id     uuid not null references public.drafts(id) on delete cascade,
  total_score  int not null default 0,
  persona_scores jsonb not null default '{}'::jsonb,   -- {scroller, expert, editor, designer, algo, risk}
  follow_no_count int not null default 0,              -- "팔로우 안 함" 판정 수
  passed       boolean not null default false,
  reasons      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_reviews_draft on public.reviews (draft_id);

-- ── assets: 렌더 산출물 (M4, Phase 2) ──
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  draft_id    uuid not null references public.drafts(id) on delete cascade,
  platform    text not null default 'ig' check (platform in ('ig','fb','tiktok','threads','x')),
  kind        text not null check (kind in ('card_png','reel_mp4')),
  storage_path text not null,
  width       int,
  height      int,
  duration_ms int,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_assets_draft on public.assets (draft_id);

-- ── publish_queue: 게시 큐 (M5, Phase 3) ──
create table if not exists public.publish_queue (
  id           uuid primary key default gen_random_uuid(),
  vertical     text not null,
  account_id   uuid references public.accounts(id) on delete set null,
  asset_id     uuid references public.assets(id) on delete set null,
  platform     text not null check (platform in ('ig','fb','tiktok','threads','x')),
  scheduled_at timestamptz not null default now(),
  state        text not null default 'queued'
               check (state in ('queued','reserved','uploading','published','failed','throttled')),
  attempts     int not null default 0,
  last_error   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pubqueue_state_sched on public.publish_queue (state, scheduled_at);

-- ── posts: 게시 완료 기록 ──
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts(id) on delete set null,
  draft_id      uuid references public.drafts(id) on delete set null,
  platform      text not null check (platform in ('ig','fb','tiktok','threads','x')),
  external_id   text,                 -- IG/FB media id
  permalink     text,
  published_at  timestamptz not null default now()
);
create index if not exists idx_posts_account_published on public.posts (account_id, published_at desc);

-- ── post_metrics: 성과 (M6, Phase 4) ──
create table if not exists public.post_metrics (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  window_label  text not null check (window_label in ('1h','24h','72h')),
  reach         int,
  saves         int,
  shares        int,
  plays         int,
  avg_watch_ms  int,
  follows       int,
  collected_at  timestamptz not null default now(),
  unique (post_id, window_label)
);

-- ── rate_limit_log: Graph API 사용률 헤더 기록 (HARD CONSTRAINT #3) ──
create table if not exists public.rate_limit_log (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts(id) on delete set null,
  endpoint      text not null,
  app_usage     real,     -- X-App-Usage worst %
  buc_usage     real,     -- X-Business-Use-Case-Usage worst %
  publishing_quota_usage int,
  raw_headers   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ratelimit_account_created on public.rate_limit_log (account_id, created_at desc);

-- ── job_failures: 모든 실패 (HARD CONSTRAINT #6) ──
create table if not exists public.job_failures (
  id          uuid primary key default gen_random_uuid(),
  worker      text not null,       -- ingest | compose | review | render | publish | insights
  vertical    text,
  context     jsonb not null default '{}'::jsonb,
  error       text not null,
  notified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_jobfail_worker_created on public.job_failures (worker, created_at desc);

-- ── vertical_playbook: 성과 피드백으로 자동 튜닝되는 전략 (M6) ──
create table if not exists public.vertical_playbook (
  id            uuid primary key default gen_random_uuid(),
  vertical      text not null,
  version       int not null default 1,
  hook_pattern  text,
  best_hours    jsonb not null default '[]'::jsonb,
  hashtag_pool  jsonb not null default '[]'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (vertical, version)
);
create index if not exists idx_playbook_vertical_active on public.vertical_playbook (vertical, active);

-- ── RLS: 전 테이블 service_role 전용 ──
do $$
declare t text;
begin
  foreach t in array array[
    'verticals','accounts','trends','drafts','reviews','assets',
    'publish_queue','posts','post_metrics','rate_limit_log','job_failures','vertical_playbook'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_service_all', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true);',
      t || '_service_all', t
    );
  end loop;
end $$;
