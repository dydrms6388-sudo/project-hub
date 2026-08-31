-- 정화 머리방 Phase 1 스키마
-- Supabase SQL Editor에 그대로 붙여넣어 실행한다.

create extension if not exists "pgcrypto";

-- 허용된 운영자(친구) 계정. 매직링크로 가입한 뒤 auth.users에서 user_id를 찾아 insert 한다:
--   insert into owners (user_id) values ('<친구 auth.users.id>');
-- 이 테이블에 없는 계정은 로그인해도 데이터가 보이지 않는다.
create table owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  consent_marketing boolean not null default false,
  consent_photo boolean not null default false,
  created_at timestamptz not null default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  service_type text not null check (service_type in ('extension', 'wig', 'other')),
  price integer,
  memo text,
  visited_at date not null,
  reserved_time time,                 -- 예약 시간 (알림톡 #{시간}용, 선택)
  completed_at timestamptz,           -- "시술 완료" 버튼이 채움. null이면 아직 예약 상태
  next_touchup_at date,               -- extension이면 visited_at + 35일 자동
  review_sent_at timestamptz,
  touchup_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index visits_visited_at_idx on visits (visited_at);
create index visits_next_touchup_idx on visits (next_touchup_at) where touchup_sent_at is null;
create index visits_customer_idx on visits (customer_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  visit_id uuid references visits (id) on delete set null,
  kind text not null check (kind in ('booking_confirm', 'review_request', 'touchup_reminder', 'winback')),
  template_code text,
  provider_id text,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

create index messages_customer_idx on messages (customer_id);

-- RLS: owners에 등록된 계정(친구)만 전체 접근. 크론은 service role 키로 우회.
alter table owners enable row level security;
alter table customers enable row level security;
alter table visits enable row level security;
alter table messages enable row level security;

create policy "owners can read own row" on owners
  for select using (user_id = auth.uid());

create policy "owner full access" on customers
  for all using (exists (select 1 from owners where user_id = auth.uid()))
  with check (exists (select 1 from owners where user_id = auth.uid()));

create policy "owner full access" on visits
  for all using (exists (select 1 from owners where user_id = auth.uid()))
  with check (exists (select 1 from owners where user_id = auth.uid()));

create policy "owner full access" on messages
  for all using (exists (select 1 from owners where user_id = auth.uid()))
  with check (exists (select 1 from owners where user_id = auth.uid()));
