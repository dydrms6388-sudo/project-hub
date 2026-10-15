-- =============================================================================
-- 0006 — payments (SCHEMA ONLY)
-- ⚠️ Phase 3 전까지 쓰기 금지. 테이블·타입·제약만 존재하며 로직(Edge Function/RPC)은 없다.
--     app_settings.payments_enabled='false' 인 동안 get_effective_tier() 는 항상 'free'.
--     결제·구독·ledger 기록은 전자상거래법상 5년 보존 → 삭제 금지(탈퇴 시 user_id set null).
-- =============================================================================

create table public.skus (
  sku               text primary key,                          -- plus_monthly / pro_monthly / superlike_5 / boost_1h / rewind_3 / card_refill_3
  kind              public.payment_kind not null,
  tier              public.subscription_tier,                  -- kind='subscription' 일 때
  item_type         public.item_type,                          -- kind='item' 일 때
  item_qty          integer check (item_qty is null or item_qty > 0),
  price_krw         integer not null check (price_krw >= 0),   -- 부가세 포함 최종가
  display_terms     text,                                      -- "월 ₩9,900(부가세 포함)·매월 자동 갱신·언제든 해지"
  is_active         boolean not null default false,
  experiment_group  text,
  retired_at        timestamptz,                               -- 삭제 대신 비활성(표시·광고 기록 6개월)
  created_at        timestamptz not null default now(),
  constraint skus_kind_fields check (
    (kind = 'subscription' and tier is not null and item_type is null) or
    (kind = 'item' and item_type is not null and item_qty is not null)
  )
);

create table public.sku_price_history (
  id          bigint generated always as identity primary key,
  sku         text not null references public.skus(sku),
  price_krw   integer not null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz
);

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  tier                public.subscription_tier not null check (tier <> 'free'),   -- free 는 행을 만들지 않는다
  provider            public.payment_provider not null,
  provider_sub_id     text,
  sku                 text references public.skus(sku),
  status              public.subscription_status not null,
  current_period_start timestamptz not null,
  current_period_end  timestamptz not null,
  cancel_at           timestamptz,                             -- canceled: = current_period_end
  canceled_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_sub_id)
);
-- 유저당 "혜택이 살아있는" 구독은 1개
create unique index subscriptions_one_live_per_user on public.subscriptions (user_id)
  where status in ('active', 'past_due', 'canceled');

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete set null,
  provider              public.payment_provider not null,
  provider_payment_id   text not null,                         -- Toss paymentKey 등. 카드번호 미저장
  kind                  public.payment_kind not null,
  sku                   text not null references public.skus(sku),
  subscription_id       uuid references public.subscriptions(id) on delete set null,
  amount_krw            integer not null check (amount_krw >= 0),
  status                public.payment_status not null default 'pending',
  paid_at               timestamptz,
  refunded_amount_krw   integer not null default 0 check (refunded_amount_krw >= 0),
  refunded_at           timestamptz,
  receipt_url           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table public.item_ledger (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users(id) on delete set null,
  item_type      public.item_type not null,
  delta          integer not null check (delta <> 0),
  balance_after  integer,                                      -- 참고값. 잔액은 SUM(delta) 로 계산(advisory lock)
  ref            text not null,                                -- purchase:{payment_id} / quest:{..} / use:{..} / expire:{..} / refund_reversal:{..} / admin:{..}
  expires_at     timestamptz,                                  -- boost 90일, card_refill 당일 자정
  created_at     timestamptz not null default now()
);

create table public.boosts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ledger_id   bigint references public.item_ledger(id),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint boosts_window check (ends_at > starts_at)
);

create table public.refund_requests (
  id                      uuid primary key default gen_random_uuid(),
  payment_id              uuid not null references public.payments(id),
  user_id                 uuid references auth.users(id) on delete set null,
  reason_code             public.refund_reason not null,
  computed_deduction_krw  integer not null default 0,
  computed_refund_krw     integer not null default 0,
  formula_snapshot        jsonb not null,                      -- U/D/u/단가 등 compute_refund 입력·출력 보존
  status                  public.refund_status not null default 'requested',
  handled_by              uuid references auth.users(id) on delete set null,
  handled_at              timestamptz,
  executed_at             timestamptz,
  created_at              timestamptz not null default now()
);
