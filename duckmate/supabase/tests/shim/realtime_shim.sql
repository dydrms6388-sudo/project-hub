-- =============================================================================
-- supabase/tests/shim/realtime_shim.sql — 검증 전용 Realtime "broadcast from database" 셰임 (프로덕션 미적용)
-- realtime.messages / realtime.send() / realtime.topic() 만 흉내 낸다. 0030 마이그레이션의 브로드캐스트 트리거·
-- private 채널 RLS 정책이 적용되도록 하기 위한 것. 실 Supabase 에서는 절대 실행하지 않는다.
-- =============================================================================
create schema if not exists realtime;
create table if not exists realtime.messages (
  id uuid default gen_random_uuid(), topic text not null, extension text not null default 'broadcast',
  payload jsonb, event text, private boolean default true, inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
grant usage on schema realtime to anon, authenticated, service_role;
grant select on realtime.messages to anon, authenticated, service_role;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.messages (topic, payload, event, private) values (topic, payload, event, private)
$$;
create or replace function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '') $$;
