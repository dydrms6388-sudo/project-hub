# Billing Provider 인터페이스 설계

Stripe / 토스페이먼츠를 교체 가능하도록 추상화. 실제 SDK 연동은 사용자 구현.

---

## IBillingProvider

```typescript
// 결제 제공자 공통 인터페이스
interface IBillingProvider {
  /** 제공자 식별자 */
  readonly name: BillingProvider;

  /**
   * 구독 체크아웃 세션 생성
   * @returns 결제창 URL
   */
  createSubscriptionCheckout(
    params: CreateCheckoutRequest
  ): Promise<CreateCheckoutResponse>;

  /**
   * 단건 결제(크레딧 충전) 세션 생성
   * @returns 결제창 URL
   */
  createPaymentCheckout(
    params: CreateCheckoutRequest
  ): Promise<CreateCheckoutResponse>;

  /**
   * 웹훅 이벤트 검증 및 파싱
   * @param rawBody - 웹훅 요청 raw body (Buffer)
   * @param signature - 웹훅 서명 헤더 값
   * @returns 파싱된 이벤트 또는 null (검증 실패)
   */
  verifyWebhook(
    rawBody: Buffer,
    signature: string
  ): Promise<ParsedWebhookEvent | null>;

  /**
   * 구독 취소
   * @param subscriptionId - 제공자의 구독 ID
   * @param immediately - true면 즉시, false면 기간 만료 후
   */
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<void>;

  /**
   * 환불
   * @param paymentId - 제공자의 결제 ID
   * @param amount - 환불 금액 (전액 환불이면 생략)
   */
  refund(paymentId: string, amount?: number): Promise<void>;
}

interface ParsedWebhookEvent {
  type: string;           // 예: 'checkout.session.completed'
  userId: string | null;  // DB에서 조회한 내부 userId (없으면 null)
  metadata: Record<string, unknown>;
}
```

---

## ISubscriptionRepository

```typescript
interface ISubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>;
  upsert(data: Partial<Subscription>): Promise<Subscription>;
  cancel(subscriptionId: string): Promise<void>;
}
```

---

## ICreditService

```typescript
// 크레딧 원자적 증감 서비스
interface ICreditService {
  /**
   * 크레딧 충전 (웹훅 수신 후 호출)
   * @returns 충전 후 잔액
   */
  charge(userId: string, amount: number, reason: string): Promise<number>;

  /**
   * 크레딧 차감 (마이크로서비스 요청 시)
   * @returns 차감 후 잔액
   * @throws InsufficientCreditsError
   */
  deduct(
    userId: string,
    amount: number,
    serviceId: string
  ): Promise<number>;

  /**
   * 잔액 조회
   */
  getBalance(userId: string): Promise<number>;
}
```

---

## Stripe vs 토스페이먼츠 구현 노트

| 항목 | Stripe | 토스페이먼츠 |
|---|---|---|
| 체크아웃 | `stripe.checkout.sessions.create()` | 결제 위젯 클라이언트 SDK |
| 웹훅 검증 | `stripe.webhooks.constructEvent()` | HMAC-SHA256 서명 검증 |
| 구독 | 기본 내장 | 정기결제 API 별도 |
| 환불 | `stripe.refunds.create()` | 취소 API |
| 통화 | USD (KRW 지원) | KRW |
| 한국 카드 | 제한적 | 완전 지원 |

**권장**: Stripe(글로벌/구독) + 토스페이먼츠(한국 카드 단건) 병행.
두 제공자를 `IBillingProvider`로 추상화하면 라우팅 로직 단순화 가능.

```typescript
// 라우팅 예시 (설계 의도)
// 한국 사용자 + 단건 결제 → tosspayments
// 구독 또는 해외 사용자 → stripe
function selectProvider(
  currency: 'krw' | 'usd',
  mode: 'subscription' | 'payment'
): IBillingProvider {
  // 실제 구현 시 작성
}
```
