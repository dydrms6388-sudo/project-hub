-- =============================================================================
-- 덕메이트(DuckMate) · D6 마이그레이션 00012 — 결제 스키마 선확정 (Phase 3 인터페이스)
--
-- ⚠️ Phase 1 게이트 전: 테이블/제약/RLS 만 확정한다. Toss 실연동·웹훅 처리 코드는
--    Phase 3 (Edge Function + TossPaymentsProvider) 에서 작성.
--
-- 추가 근거 (14_schema §6-1 "payments 테이블 없음 — Phase 3 D6 추가" 의 선행 이행):
--   · refund_requests.payment_ref / item_ledger.ref(`payment:{id}`) 가 참조할
--     결제 원본 행이 없으면 calc_refund() 시그니처를 확정할 수 없다 → payments 신설.
--   · 웹훅 재전송 멱등 처리는 item_ledger (user_id, ref) 만으로는 부족하다
--     (상태 전이·환불 이벤트는 원장 행을 만들지 않음) → payment_events 신설.
--   · B3 P-4: subscriptions.provider ∈ {toss, apple, google} — CHECK 로 못박는다
--     (00002 주석의 'revenuecat' 표기는 폐기: 채널 = 스토어 단위, RevenueCat 은 게이트웨이).
-- 정합: packages/db/src/payments/provider.ts 의 PaymentRow / PaymentEventRow 와 1:1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. subscriptions.provider 채널 값 확정 (B3 P-4)
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  add constraint chk_subscriptions_provider
  check (provider is null or provider in ('toss', 'apple', 'google'));

-- -----------------------------------------------------------------------------
-- 1. payments — 결제 원본 (단건 결제 1행. 구독 갱신도 갱신 회차마다 1행)
--    · 원장 지급 ref = 'payment:' || id (멱등키 — provider.ts LedgerRef 규약)
--    · refund_requests.payment_ref 는 이 테이블의 id (text 캐스팅) 를 담는다
--    · paid_at = 청약철회 7일 기산점 (서버 시각 — 07_legal §7)
-- -----------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  -- 결제 기록은 정산·환불 분쟁 대비 탈퇴 후에도 보존 → set null
  user_id             uuid references auth.users (id) on delete set null,
  provider            text not null check (provider in ('toss', 'apple', 'google')),
  -- 채널 공통 상품 키 (B3 P-3 / 04 §6.1 확정 — 가격은 키에 넣지 않는다)
  product_key         text not null check (product_key in
                        ('dm_plus_monthly', 'dm_pro_monthly', 'dm_superlike_5', 'dm_boost_1')),
  -- 서버가 카탈로그 기준 재계산한 금액 (다크패턴 가드 #7: 클라이언트 전송액 무시)
  amount              integer not null check (amount >= 0),
  currency            text not null default 'KRW' check (currency = 'KRW'),
  status              text not null default 'ready' check (status in
                        ('ready', 'confirmed', 'failed', 'partial_refunded', 'refunded')),
  provider_payment_id text,                             -- Toss paymentKey / 스토어 transaction id
  provider_session_id text,                             -- Toss orderId 등 체크아웃 식별자
  paid_at             timestamptz,
  refunded_amount     integer not null default 0 check (refunded_amount >= 0),
  refunded_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- 환불액이 결제액을 초과할 수 없다
  check (refunded_amount <= amount),
  -- 승인 완료면 반드시 승인 시각·채널 식별자가 있다
  check (status not in ('confirmed', 'partial_refunded', 'refunded')
         or (paid_at is not null and provider_payment_id is not null))
);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- 채널 결제 식별자 멱등 (재승인/재전송 방어)
create unique index uq_payments_provider_payment
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index uq_payments_provider_session
  on public.payments (provider, provider_session_id) where provider_session_id is not null;
-- 결제 내역 화면(E4) / 유저별 7일 철회 창 조회
create index idx_payments_user on public.payments (user_id, created_at desc);
-- 환불 큐·정산 대조: 상태별 스캔
create index idx_payments_status on public.payments (status, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. payment_events — 웹훅 이벤트 원장 (수신 즉시 append, 처리 결과 기록)
--    · (provider, event_id) unique = 재전송 멱등: 충돌 시 재처리 없이 200 반환
--    · 지급/상태 전이는 "이 테이블에 insert 성공한" 이벤트에 대해서만 수행 (B3 P-5)
--    · event_id 가 없는 채널 페이로드는 수신부가 payload 해시로 대체 생성
-- -----------------------------------------------------------------------------
create table public.payment_events (
  id           bigint generated always as identity primary key,
  provider     text not null check (provider in ('toss', 'apple', 'google')),
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  status       text not null default 'received' check (status in
                 ('received', 'processed', 'skipped', 'failed')),
  error        text,
  payment_id   uuid references public.payments (id) on delete set null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)                           -- 웹훅 재전송 멱등
);

-- 실패 재처리 큐 (Phase 3 cron: failed 만 재시도)
create index idx_payment_events_retry
  on public.payment_events (received_at) where status in ('received', 'failed');
create index idx_payment_events_payment on public.payment_events (payment_id);

-- -----------------------------------------------------------------------------
-- 3. RLS — 결제 쓰기는 전부 service role (클라이언트 요청 단독 지급 금지, A4 §2.2)
-- -----------------------------------------------------------------------------
alter table public.payments       enable row level security;
alter table public.payment_events enable row level security;

-- payments: 본인 읽기만 (E4 결제 내역·환불 예상액 화면). 쓰기 정책 없음 = service 전용.
create policy payments_select_own on public.payments
  for select to authenticated
  using (user_id = auth.uid());

-- payment_events: 정책 0개 = service role 전용 (원문 페이로드에 PG 식별자 포함 — 노출 금지)
