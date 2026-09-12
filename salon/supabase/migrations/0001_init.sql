-- 정화 머리방 Phase 1 스키마
-- Supabase SQL Editor에 그대로 붙여넣어 실행한다.

create extension if not exists "pgcrypto";

-- 허용된 운영자(친구) 계정. 매직링크로 1회 로그인한 뒤 auth.users에서 id를 찾아 넣는다:
--   insert into owners (user_id) values ('<친구 auth.users.id>');
-- 이 테이블에 없는 계정은 로그인해도 데이터에 접근할 수 없다.
create table owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  -- 숫자만 저장한다 (앱에서 하이픈 제거 후 저장)
  phone text not null unique check (phone ~ '^01[016789][0-9]{7,8}$'),
  consent_marketing boolean not null default false,
  consent_photo boolean not null default false,
  created_at timestamptz not null default now()
);

create index customers_name_idx on customers (name);
create index customers_created_idx on customers (created_at desc);

create table visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  service_type text not null check (service_type in ('extension', 'wig', 'other')),
  price integer check (price is null or (price >= 0 and price <= 100000000)),
  memo text check (memo is null or char_length(memo) <= 500),
  visited_at date not null,
  reserved_time time,                 -- 예약 시간 (알림톡 #{시간}용, 선택)
  completed_at timestamptz,           -- "시술 완료" 버튼이 채움. null이면 아직 예약 상태
  next_touchup_at date,               -- extension이면 visited_at + 35일 자동
  review_sent_at timestamptz,
  touchup_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint visits_touchup_after_visit
    check (next_touchup_at is null or next_touchup_at >= visited_at)
);

create index visits_visited_at_idx on visits (visited_at desc);
create index visits_customer_idx on visits (customer_id, visited_at desc);
-- 크론이 매일 훑는 두 경로. 미발송 건만 남겨 인덱스를 작게 유지한다.
create index visits_review_due_idx on visits (visited_at)
  where review_sent_at is null and completed_at is not null;
create index visits_touchup_due_idx on visits (next_touchup_at)
  where touchup_sent_at is null and next_touchup_at is not null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  visit_id uuid references visits (id) on delete set null,
  kind text not null check (kind in ('booking_confirm', 'review_request', 'touchup_reminder', 'winback')),
  template_code text,
  provider_id text,
  -- sent | failed | skipped_unconfigured
  status text not null default 'sent',
  error text,                         -- 실패 사유 (고객 상세 화면에 표시)
  sent_at timestamptz not null default now()
);

create index messages_customer_idx on messages (customer_id, sent_at desc);
create index messages_winback_idx on messages (customer_id, sent_at)
  where kind = 'winback' and status = 'sent';

-- RLS: owners에 등록된 계정(친구)만 전체 접근. 크론은 service role 키로 우회한다.
alter table owners enable row level security;
alter table customers enable row level security;
alter table visits enable row level security;
alter table messages enable row level security;

-- owners 조회는 로그인 사용자 본인 행만 (앱의 권한 확인용)
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
