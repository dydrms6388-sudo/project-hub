-- 하루치 — 초기 스키마 + RLS
--
-- 원칙 (스펙 3장 / 7장):
--   * 모든 테이블에 RLS 를 켠다. 정책 없는 테이블을 만들지 않는다.
--   * 금액은 bigint(원 단위 정수). numeric/float 를 쓰지 않는다.
--   * 금융 인증정보(ID/PW/공동인증서)를 담는 컬럼은 존재하지 않는다.
--   * 카드번호는 뒤 4자리만 저장한다.
--
-- 근거: 신용정보법 개정으로 2021.8 부터 스크래핑 기반 금융데이터 수집은
--       마이데이터 허가 없이 불가하다. 이 서비스는 사용자가 직접 붙여넣거나
--       업로드한 텍스트만 다룬다.
--       https://www.law.go.kr/법령/신용정보의이용및보호에관한법률

set check_function_bodies = off;

/* ────────────────────────────────────────────────────────────────────────────
 * 멤버십 판정 헬퍼
 *
 * 정책 안에서 ledger_members 를 직접 조회하면 ledger_members 자신의 정책이
 * 다시 평가되어 무한 재귀가 난다. SECURITY DEFINER 함수로 한 번 끊는다.
 * search_path 를 고정해 함수 탈취를 막는다.
 * ──────────────────────────────────────────────────────────────────────────── */

create or replace function public.is_ledger_member(target_ledger uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ledger_members m
    where m.ledger_id = target_ledger and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_ledger(target_ledger uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ledger_members m
    where m.ledger_id = target_ledger
      and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_ledger_owner(target_ledger uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ledger_members m
    where m.ledger_id = target_ledger
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

/* ────────────────────────────────────────────────────────────────────────────
 * 테이블
 * ──────────────────────────────────────────────────────────────────────────── */

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  currency text not null default 'KRW',
  -- 월급날 기준 회계월. 25 면 "8월" 은 7/25~8/24 다.
  -- 29~31 은 없는 달이 생기므로 28 로 제한한다.
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  created_at timestamptz not null default now()
);

create table public.ledger_members (
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

-- 결제수단. 인증정보는 어떤 형태로도 저장하지 않는다.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  kind text not null check (kind in ('credit', 'check', 'bank', 'cash', 'prepaid')),
  -- '신한','국민','토스뱅크' 등 표시용 문자열일 뿐이다. 연동을 의미하지 않는다.
  issuer text,
  nickname text not null check (length(nickname) between 1 and 40),
  -- 뒤 4자리만. 전체 번호 저장 금지 (스펙 7장-2).
  last4 text check (last4 ~ '^[0-9]{4}$'),
  color text,
  archived boolean not null default false
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid references public.ledgers(id) on delete cascade, -- null = 시스템 기본
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  is_fixed boolean not null default false, -- 고정비 여부 (burn rate 계산에서 분리)
  icon text,
  sort_order int not null default 0
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  occurred_at timestamptz not null,
  -- 항상 양수. 방향은 kind, 취소 여부는 is_cancellation 이 나타낸다.
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  merchant_raw text,
  merchant_normalized text,
  memo text,
  installment_months smallint check (installment_months between 2 and 60),
  is_pending boolean not null default false,
  -- 승인취소/부분취소. 통계에서 같은 kind 의 금액을 차감한다.
  -- 스펙 3장 DDL 에는 없지만, 4-1 의 "취소 = 음수 처리" 요구를
  -- "amount 는 항상 양수" 제약과 양립시키려면 이 플래그가 필요하다.
  is_cancellation boolean not null default false,
  is_excluded boolean not null default false,
  source text not null check (source in ('manual', 'paste', 'notification', 'import', 'recurring')),
  dedupe_key text not null,
  raw_payload jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ledger_id, dedupe_key)
);

create index transactions_ledger_occurred_idx
  on public.transactions (ledger_id, occurred_at desc);
create index transactions_ledger_category_occurred_idx
  on public.transactions (ledger_id, category_id, occurred_at);
-- 분류 필요 건을 대시보드 상단에 고정하려면 부분 인덱스가 필요하다.
create index transactions_uncategorized_idx
  on public.transactions (ledger_id, occurred_at desc)
  where category_id is null;
-- raw_payload 90일 정리 작업이 전체 스캔을 하지 않도록.
create index transactions_raw_payload_created_idx
  on public.transactions (created_at)
  where raw_payload is not null;

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid references public.ledgers(id) on delete cascade, -- null = 전역 기본규칙
  match_type text not null check (match_type in ('exact', 'contains', 'regex')),
  pattern text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  priority int not null default 100, -- 낮을수록 우선
  hit_count int not null default 0,
  created_from text check (created_from in ('seed', 'user_correction', 'llm'))
);

create index category_rules_ledger_priority_idx
  on public.category_rules (ledger_id, priority);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade, -- null = 총예산
  period text not null default 'monthly',
  amount bigint not null check (amount >= 0),
  starts_on date not null,
  ends_on date,
  rollover boolean not null default false,
  unique (ledger_id, category_id, starts_on)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  title text not null,
  target_amount bigint not null check (target_amount > 0),
  saved_amount bigint not null default 0 check (saved_amount >= 0),
  target_date date not null,
  linked_category_ids uuid[],
  status text not null default 'active'
    check (status in ('active', 'achieved', 'paused', 'failed')),
  created_at timestamptz not null default now()
);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  merchant_normalized text not null,
  amount bigint not null check (amount > 0),
  interval_days smallint not null check (interval_days > 0),
  next_expected_on date,
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  is_confirmed boolean not null default false,
  is_cancelled boolean not null default false
);

-- 업로드 이력. 원본 파일은 저장하지 않고 메타데이터만 남긴다 (스펙 4-2).
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  filename text not null,
  detected_format text,
  row_count int,
  inserted_count int,
  duplicate_count int,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- 상호명 정규화 사전. 전역 공유 자산이라 쓰기는 service_role 만 가능하다.
create table public.merchant_dictionary (
  pattern text primary key,
  normalized text not null,
  default_category_id uuid references public.categories(id),
  confidence numeric(3, 2) not null default 0.8 check (confidence between 0 and 1)
);

/* ────────────────────────────────────────────────────────────────────────────
 * RLS — 전 테이블 활성화
 * ──────────────────────────────────────────────────────────────────────────── */

alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.imports enable row level security;
alter table public.merchant_dictionary enable row level security;

-- ledgers
create policy ledgers_select on public.ledgers
  for select to authenticated using (public.is_ledger_member(id));
create policy ledgers_insert on public.ledgers
  for insert to authenticated with check (owner_id = auth.uid());
create policy ledgers_update on public.ledgers
  for update to authenticated using (public.is_ledger_owner(id)) with check (public.is_ledger_owner(id));
create policy ledgers_delete on public.ledgers
  for delete to authenticated using (public.is_ledger_owner(id));

-- ledger_members
-- 가계부를 막 만든 소유자가 자기 자신을 owner 로 넣는 것만 예외로 허용한다.
-- 그 외의 멤버 추가·변경·삭제는 소유자만 할 수 있다.
create policy ledger_members_select on public.ledger_members
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy ledger_members_insert on public.ledger_members
  for insert to authenticated with check (
    public.is_ledger_owner(ledger_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.ledgers l
        where l.id = ledger_id and l.owner_id = auth.uid()
      )
    )
  );
create policy ledger_members_update on public.ledger_members
  for update to authenticated using (public.is_ledger_owner(ledger_id))
  with check (public.is_ledger_owner(ledger_id));
create policy ledger_members_delete on public.ledger_members
  for delete to authenticated using (public.is_ledger_owner(ledger_id));

-- 가계부에 속한 데이터: 조회는 멤버 전원, 쓰기는 owner/editor 만.
create policy accounts_select on public.accounts
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy accounts_write on public.accounts
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

-- categories / category_rules 는 ledger_id 가 null 인 시스템 기본값을 함께 갖는다.
-- 기본값은 누구나 읽을 수 있지만 아무도 고칠 수 없다 (service_role 만).
create policy categories_select on public.categories
  for select to authenticated using (ledger_id is null or public.is_ledger_member(ledger_id));
create policy categories_write on public.categories
  for all to authenticated
  using (ledger_id is not null and public.can_edit_ledger(ledger_id))
  with check (ledger_id is not null and public.can_edit_ledger(ledger_id));

create policy category_rules_select on public.category_rules
  for select to authenticated using (ledger_id is null or public.is_ledger_member(ledger_id));
create policy category_rules_write on public.category_rules
  for all to authenticated
  using (ledger_id is not null and public.can_edit_ledger(ledger_id))
  with check (ledger_id is not null and public.can_edit_ledger(ledger_id));

create policy transactions_select on public.transactions
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy transactions_write on public.transactions
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

create policy budgets_select on public.budgets
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy budgets_write on public.budgets
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

create policy goals_select on public.goals
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy goals_write on public.goals
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

create policy recurring_select on public.recurring_transactions
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy recurring_write on public.recurring_transactions
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

create policy imports_select on public.imports
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy imports_write on public.imports
  for all to authenticated using (public.can_edit_ledger(ledger_id))
  with check (public.can_edit_ledger(ledger_id));

-- merchant_dictionary: 인증 사용자 전원 읽기, 쓰기는 service_role 만.
-- service_role 은 RLS 를 우회하므로 쓰기 정책을 만들지 않는 것이 곧 정책이다.
create policy merchant_dictionary_select on public.merchant_dictionary
  for select to authenticated using (true);

/* ────────────────────────────────────────────────────────────────────────────
 * raw_payload 90일 보존 (스펙 7장-5)
 *
 * 문자 원문은 디버깅·재파싱용이라 오래 둘 이유가 없다. 거래 자체는 남기고
 * 원문만 지운다.
 * ──────────────────────────────────────────────────────────────────────────── */

create or replace function public.purge_old_raw_payloads()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purged integer;
begin
  update public.transactions
     set raw_payload = null
   where raw_payload is not null
     and created_at < now() - interval '90 days';
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_old_raw_payloads() from public, anon, authenticated;

-- pg_cron 이 있는 환경에서만 스케줄을 건다. 없으면 배포 스크립트가 대신 호출한다.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'haruchi-purge-raw-payloads',
      '30 18 * * *', -- UTC 18:30 = KST 03:30
      $cron$select public.purge_old_raw_payloads();$cron$
    );
  end if;
end;
$$;
