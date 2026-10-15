-- @ggu/ugc-core — canonical schema.
-- All tables are prefixed `ugc_` and shared across every consuming service;
-- rows are separated by `app_slug`, never by per-service tables. Keep the table
-- names in lockstep with src/db/tables.ts.
--
-- Apply with the Supabase CLI: `supabase db push`, or paste into the SQL editor.
-- RLS is enabled with deny-by-default; service code uses the service role, and
-- public read is scoped to published rows only.

create extension if not exists "pgcrypto";      -- gen_random_uuid()
-- create extension if not exists vector;        -- Phase 1: dedup embeddings

-- ── enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type ugc_status as enum
    ('pending','queued','published','blocked','hidden','deleted');
exception when duplicate_object then null; end $$;

-- ── submissions: raw intake, pre-moderation ─────────────────────────────────
create table if not exists ugc_submissions (
  id          uuid primary key default gen_random_uuid(),
  app_slug    text not null,
  content     jsonb not null,
  author_id   text,
  ip_hash     text,
  status      ugc_status not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists ugc_submissions_app_status_idx
  on ugc_submissions (app_slug, status, created_at desc);
create index if not exists ugc_submissions_author_idx
  on ugc_submissions (app_slug, author_id);

-- ── content: published, SEO-eligible records ────────────────────────────────
create table if not exists ugc_content (
  id            uuid primary key,                 -- mirrors submission id
  app_slug      text not null,
  slug          text not null,
  content       jsonb not null,
  content_score int  not null default 0,
  indexed       boolean not null default false,
  url           text not null,
  reactions     int  not null default 0,
  status        ugc_status not null default 'published',
  published_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (app_slug, slug)
);
create index if not exists ugc_content_app_indexed_idx
  on ugc_content (app_slug, indexed, content_score desc);
create index if not exists ugc_content_status_idx
  on ugc_content (app_slug, status);

-- ── moderations: audit trail of every verdict ───────────────────────────────
create table if not exists ugc_moderations (
  id             bigint generated always as identity primary key,
  app_slug       text not null,
  submission_id  uuid not null references ugc_submissions(id) on delete cascade,
  quality_score  int  not null,
  toxicity       real not null default 0,
  spam           real not null default 0,
  pii            boolean not null default false,
  categories     text[] not null default '{}',
  reason         text,
  source         text not null,                   -- rules | llm | combined
  decision       text not null,                   -- publish | queue | block
  created_at     timestamptz not null default now()
);
create index if not exists ugc_moderations_submission_idx
  on ugc_moderations (submission_id);

-- ── moderation queue: inconclusive items awaiting a human ────────────────────
create table if not exists ugc_moderation_queue (
  submission_id  uuid primary key references ugc_submissions(id) on delete cascade,
  app_slug       text not null,
  quality_score  int  not null,
  categories     text[] not null default '{}',
  enqueued_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    text
);
create index if not exists ugc_queue_app_pending_idx
  on ugc_moderation_queue (app_slug, enqueued_at) where resolved_at is null;

-- ── engagements: votes / reactions / comments ───────────────────────────────
create table if not exists ugc_engagements (
  id          uuid primary key default gen_random_uuid(),
  app_slug    text not null,
  content_id  uuid not null references ugc_content(id) on delete cascade,
  kind        text not null,                       -- vote | reaction | comment
  author_id   text,
  body        text,                                -- comments only
  created_at  timestamptz not null default now()
);
create index if not exists ugc_engagements_content_idx
  on ugc_engagements (content_id, kind);

-- ── reports: abuse / takedown signals ───────────────────────────────────────
create table if not exists ugc_reports (
  id           uuid primary key default gen_random_uuid(),
  app_slug     text not null,
  content_id   uuid not null references ugc_content(id) on delete cascade,
  reason       text not null,
  reporter_id  text,
  created_at   timestamptz not null default now()
);
create index if not exists ugc_reports_content_idx
  on ugc_reports (content_id);

-- ── rate counters: rolling-window buckets for submit gating ─────────────────
create table if not exists ugc_rate_counters (
  app_slug    text not null,
  window_key  text not null,                       -- e.g. 'ip:<hash>:2026-07-22T13'
  count       int  not null default 0,
  expires_at  timestamptz not null,
  primary key (app_slug, window_key)
);
create index if not exists ugc_rate_counters_expiry_idx
  on ugc_rate_counters (expires_at);

-- Atomic increment used by UgcStore.bumpCounter. Returns the new count.
create or replace function ugc_bump_counter(
  p_app_slug text, p_window_key text, p_ttl_sec int
) returns int language plpgsql as $$
declare v_count int;
begin
  insert into ugc_rate_counters (app_slug, window_key, count, expires_at)
  values (p_app_slug, p_window_key, 1, now() + make_interval(secs => p_ttl_sec))
  on conflict (app_slug, window_key)
  do update set count = ugc_rate_counters.count + 1
  returning count into v_count;
  return v_count;
end $$;

-- ── RLS: deny by default; public may read published content only ────────────
alter table ugc_submissions       enable row level security;
alter table ugc_content           enable row level security;
alter table ugc_moderations       enable row level security;
alter table ugc_moderation_queue  enable row level security;
alter table ugc_engagements       enable row level security;
alter table ugc_reports           enable row level security;
alter table ugc_rate_counters     enable row level security;

-- Public (anon) read access limited to live, published content.
drop policy if exists ugc_content_public_read on ugc_content;
create policy ugc_content_public_read on ugc_content
  for select using (status = 'published' and indexed is not null);

-- All writes and all other tables are service-role only (bypasses RLS).
-- No anon/authenticated policies are granted elsewhere on purpose.
