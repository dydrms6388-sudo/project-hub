/**
 * 결제/구독 인터페이스 (D6 · Phase 1 = 타입·상수만, 구현 없음)
 *
 * 계약 문서: docs/agents/04_monetization.md(A4) · 09_store_policy.md(B3) · 19_payments.md(D6)
 * DB 스키마: supabase/migrations/20260902000006_payments_schema_only.sql (enum 은 0001)
 *
 * 원칙
 *  - provider(toss/apple/google)가 무엇이든 서버 상태는 `subscriptions`/`payments`/`item_ledger` 3테이블이며
 *    권한 판정은 SQL `get_effective_tier(user_id)` 단일 함수다. 클라이언트·SDK 의 entitlement 값은 UI 캐시.
 *  - E4 는 이 인터페이스가 주는 값(`DisplayPrice`·`RefundPath`·관리 URL)만 렌더한다. Toss 고유 UI 는
 *    `TossPaymentProvider` 내부로 격리 (B3 §0-5·11).
 */
import type { Enums, Tier } from "@duckmate/db";
import { SKU_IDS } from "@duckmate/db";

// ---------------------------------------------------------------------------
// provider / sku
// ---------------------------------------------------------------------------
/** SQL enum `payment_provider` 와 1:1. Phase 3 = toss, Phase 4 = apple/google(RevenueCat 경유) */
export type PaymentProviderId = Enums["payment_provider"];
export const PAYMENT_PROVIDERS = ["toss", "apple", "google"] as const satisfies ReadonlyArray<PaymentProviderId>;

/** provider 가 아직 없는 상태(Phase 1~2, `PAYMENTS_ENABLED!=='true'`) */
export type DisabledProviderId = "disabled";

export type SkuId = (typeof SKU_IDS)[number];
export type SubscriptionSkuId = Extract<SkuId, "plus_monthly" | "pro_monthly">;
export type ItemSkuId = Exclude<SkuId, SubscriptionSkuId>;
export type PaidTier = Exclude<Tier, "free">;

/** SKU → 티어 (구독 SKU 만). 가격은 절대 코드에 두지 않는다 — `skus.price_krw` / provider display_price 가 소스 */
export const SUBSCRIPTION_SKU_TIER: Readonly<Record<SubscriptionSkuId, PaidTier>> = {
  plus_monthly: "plus",
  pro_monthly: "pro",
};

export type PaymentKind = Enums["payment_kind"];
export type ItemType = Enums["item_type"];
export type RefundReason = Enums["refund_reason"];
export type SubscriptionStatus = Enums["subscription_status"];
export type PaymentStatus = Enums["payment_status"];

// ---------------------------------------------------------------------------
// ledger ref 규칙 (A4 §3) — 원장 불변 규칙은 19_payments.md §5
// ---------------------------------------------------------------------------
export type LedgerRef =
  | `purchase:${string}`
  | `sub_grant:${string}:${string}`
  | `quest:${string}`
  | `use:${string}`
  | `expire:${string}`
  | `refund_reversal:${string}`
  | `admin:${string}`;

// ---------------------------------------------------------------------------
// 이벤트 (provider 웹훅 → 정규화된 도메인 이벤트)
// ---------------------------------------------------------------------------
export const SUBSCRIPTION_EVENT_TYPES = [
  "subscription.activated",
  "subscription.renewed",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.expired",
] as const;
export const PAYMENT_EVENT_TYPES = ["payment.succeeded", "payment.failed", "payment.refunded"] as const;
export const ITEM_EVENT_TYPES = ["item.granted"] as const;
export const PROVIDER_EVENT_TYPES = [...SUBSCRIPTION_EVENT_TYPES, ...PAYMENT_EVENT_TYPES, ...ITEM_EVENT_TYPES] as const;

export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];
export type ItemEventType = (typeof ITEM_EVENT_TYPES)[number];
export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[number];

interface ProviderEventBase<T extends ProviderEventType> {
  type: T;
  provider: PaymentProviderId;
  /**
   * idempotency 키. provider 가 주는 이벤트 고유 ID(Toss: 웹훅 body 의 eventId/transactionKey,
   * RevenueCat: event.id). 같은 (provider, providerEventId) 재수신 시 처리하지 않고 200.
   */
  providerEventId: string;
  /** ISO 8601 */
  occurredAt: string;
  /** Supabase auth.users.id. provider 메타데이터(customerKey / app_user_id)에서 복원. 매핑 실패 시 null → 운영 큐 */
  userId: string | null;
  /** provider 원본 페이로드(감사 로그용, 카드번호 등 민감정보는 provider 가 애초에 보내지 않음) */
  raw?: unknown;
}

export interface SubscriptionEvent extends ProviderEventBase<SubscriptionEventType> {
  subscription: {
    /** Toss billingKey 기반 구독 ID / RevenueCat original_transaction_id·purchase_token */
    providerSubId: string;
    sku: SubscriptionSkuId;
    tier: PaidTier;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    /** canceled: = currentPeriodEnd (A4: 기간 말까지 혜택 유지) */
    cancelAt?: string | null;
  };
}

export interface PaymentEvent extends ProviderEventBase<PaymentEventType> {
  payment: {
    /** Toss paymentKey 등. `payments(provider, provider_payment_id)` unique */
    providerPaymentId: string;
    sku: SkuId;
    kind: PaymentKind;
    /** provider 가 청구/환불한 금액. 서버는 반드시 `skus.price_krw`/compute_refund 로 재계산해 대조 (AMOUNT_MISMATCH) */
    amountKrw: number;
    providerSubId?: string | null;
    /** payment.refunded 전용: 누적 환불액 */
    refundedAmountKrw?: number;
    /** payment.failed 전용: provider 실패 코드 */
    failureCode?: string;
    receiptUrl?: string | null;
  };
}

export interface ItemGrantedEvent extends ProviderEventBase<ItemEventType> {
  grant: {
    itemType: ItemType;
    qty: number;
    ref: LedgerRef;
    /** boost 90일 / card_refill 당일 07:00 / IAP 구매분·superlike = null (만료 없음) */
    expiresAt: string | null;
  };
}

export type ProviderEvent = SubscriptionEvent | PaymentEvent | ItemGrantedEvent;

// ---------------------------------------------------------------------------
// PaymentProvider 인터페이스
// ---------------------------------------------------------------------------
export interface CheckoutSession {
  /** Toss 결제창 / 스토어 결제 시트로 보낼 URL. 웹은 redirect, 앱은 SDK 가 처리 */
  redirectUrl: string;
  /** provider 측 주문/세션 식별자 (결제 승인 콜백 대조용) */
  providerSessionId?: string;
}

export type CancelAt =
  /** 기본. `cancel_at = current_period_end`, 혜택 유지, 갱신만 중단 (A4 §0) */
  | "period_end"
  /** 환불(청약철회) 승인 플로우 전용 — 직접 호출 금지 */
  | "now";

export interface CancelResult {
  providerSubId: string;
  /** 혜택 종료 시각 (E4 확인 다이얼로그 "혜택은 {날짜}까지 유지돼요") */
  effectiveAt: string;
}

export interface RefundResult {
  providerPaymentId: string;
  /** provider 가 실제 취소한 금액 */
  refundedAmountKrw: number;
  providerRefundId?: string;
  executedAt: string;
}

export interface DisplayPrice {
  sku: SkuId;
  /** 렌더 문자열. 웹 "₩9,900", 스토어는 스토어가 준 현지화 문자열 (B3 §0-8: 앱에서 웹 가격 렌더 금지) */
  display: string;
  /** 웹(Toss)만 숫자 제공. 스토어는 null (표시 문자열만) */
  amountKrw: number | null;
  /** `skus.display_terms` — "월 ₩9,900(부가세 포함) · 매월 자동 갱신 · 언제든 해지" */
  terms: string | null;
}

export type RefundPath =
  /** Toss: 앱 내 [환불 요청] → compute_refund → refund_requests */
  | { kind: "in_app" }
  /** apple/google: 스토어 환불 절차로 안내 (B3 §4.5) */
  | { kind: "store"; url: string; label: string };

export interface PaymentProvider {
  readonly id: PaymentProviderId | DisabledProviderId;

  /** 결제 시작. 서버가 `skus` 에서 금액을 읽고 provider 세션을 만든다 (클라이언트 금액 전달 금지) */
  createCheckout(sku: SkuId, userId: string): Promise<CheckoutSession>;

  /**
   * 웹훅 검증 + 도메인 이벤트로 정규화. 서명(있으면) 검증 → 실패 시 `WEBHOOK_INVALID`.
   * Toss 는 서명 헤더가 없을 수 있으므로 구현은 반드시 결제 조회 API 로 금액·상태를 재확인한다.
   */
  verifyWebhook(rawBody: string, signature: string | null): Promise<ProviderEvent>;

  /** 구독 해지. 기본은 기간 말(`period_end`). */
  cancelSubscription(providerSubId: string, at: CancelAt): Promise<CancelResult>;

  /** 부분/전액 환불 실행. `amountKrw` 는 서버 `compute_refund` 결과만 허용 */
  refund(providerPaymentId: string, amountKrw: number, reason: RefundReason): Promise<RefundResult>;

  /** 가격 표시 문자열 (B3 §0-8) */
  getDisplayPrice(sku: SkuId): Promise<DisplayPrice>;

  /** 구독 관리 화면 링크. 웹은 null(앱 내 화면), 스토어는 딥링크 (B3 §0-5 manageSubscriptionUrl) */
  manageSubscriptionUrl(userId: string): Promise<string | null>;

  /** 환불 진입 경로 (B3 §0-5 refundPath) */
  refundPath(providerPaymentId: string): RefundPath;
}
