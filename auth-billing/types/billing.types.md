# Billing 타입 설계

TypeScript 타입 초안. 실제 구현 시 `.ts` 파일로 변환.

---

## Subscription

```typescript
interface Subscription {
  id: string;                    // Stripe subscription ID
  userId: string;
  plan: 'pro';
  status: SubscriptionStatus;
  currentPeriodStart: string;    // ISO 8601
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: BillingProvider;
}

type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing';

type BillingProvider = 'stripe' | 'tosspayments';
```

---

## Invoice

```typescript
interface Invoice {
  id: string;
  userId: string;
  amount: number;         // 원 단위 (KRW) 또는 센트 (USD)
  currency: 'krw' | 'usd';
  status: 'paid' | 'failed' | 'pending';
  provider: BillingProvider;
  providerId: string;     // Stripe invoice ID 또는 토스 orderId
  paidAt: string | null;
  createdAt: string;
}
```

---

## CreditTransaction

```typescript
// credits 충전/차감 이력
interface CreditTransaction {
  id: string;
  userId: string;
  type: 'charge' | 'deduct';
  amount: number;               // 양수: 충전, 음수: 차감
  balanceAfter: number;         // 트랜잭션 후 잔액
  reason: string;               // 예: 'purchase', 'service:dydrms-xxx', 'refund'
  serviceId: string | null;     // 차감한 마이크로서비스 ID
  createdAt: string;
}
```

---

## CheckoutSession

```typescript
// 결제 세션 생성 요청/응답
interface CreateCheckoutRequest {
  userId: string;
  priceId: string;              // Stripe Price ID (env.example 참고)
  mode: 'subscription' | 'payment';
  successUrl: string;
  cancelUrl: string;
}

interface CreateCheckoutResponse {
  checkoutUrl: string;          // Stripe Checkout 또는 토스 결제창 URL
  sessionId: string;
}
```

---

## Webhook 이벤트 (처리 설계)

```typescript
// 허브 /api/billing/webhook 에서 처리할 이벤트 목록
type StripeWebhookEvent =
  | 'checkout.session.completed'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

type TossWebhookEvent =
  | 'PAYMENT_STATUS_CHANGED';  // 토스페이먼츠 웹훅 이벤트

// 웹훅 처리 결과
interface WebhookResult {
  received: boolean;
  userId: string | null;
  action: string;               // 예: 'plan_upgraded', 'credits_added', 'plan_canceled'
}
```

---

## DB 테이블 설계 초안 (Supabase Postgres)

```sql
-- subscriptions 테이블
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- credit_transactions 테이블
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,          -- 'charge' | 'deduct'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  service_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- invoices 테이블
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'krw',
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
