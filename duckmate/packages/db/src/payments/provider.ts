// =============================================================================
// 덕메이트(DuckMate) · D6 — 결제 PaymentProvider 인터페이스 (Phase 3 선확정)
//
// ⚠️ Phase 1 게이트 전: 이 파일은 **타입·상수·상태 머신·스텁 선언만** 담는다.
//    Toss/RevenueCat 실연동 코드는 Phase 3(TossPaymentsProvider) / Phase 4
//    (IapProvider)에서 apps/web/lib/payments/ 구현체와 함께 채운다 (B3 P-1).
//
// 규약 근거:
//   · 04_monetization §4(상태 머신)·§2.2(원장)·§5(환불 계산식)
//   · 09_store_policy  P-1~P-6 (어댑터 강제·채널 공통 상품 키·SUB_CHANNEL_CONFLICT)
//   · 07_legal_checklist L2 (통신판매업 신고번호 부재 → 결제 세션 503)
//   · 14_schema D1-6 (원장 멱등키 = (user_id, ref) 복합 unique)
//   · supabase/migrations/00012_payments.sql (payments·payment_events)
//
// 가격의 단일 진실은 ../tier-limits (TIER_PRICES / ITEM_PRICES) — 여기서 재정의
// 하지 않고 참조만 한다. UI 가격 표시는 provider.getProducts() 결과만 렌더(P-6).
// =============================================================================

import type {
  ItemType,
  Json,
  LedgerBucket,
  SubscriptionStatus,
  SubscriptionTier,
} from "../types";
import { ITEM_PRICES, TIER_PRICES } from "../tier-limits";

// ---------------------------------------------------------------------------
// 0. 공용 에러
// ---------------------------------------------------------------------------

/** Phase 게이트 전 스텁 호출 방어. DB 측 대응물 = DUCKMATE_NOT_IMPLEMENTED 예외. */
export class NotImplementedError extends Error {
  constructor(phase: string) {
    super(`NOT_IMPLEMENTED: ${phase} 에서 구현된다`);
    this.name = "NotImplementedError";
  }
}

// ---------------------------------------------------------------------------
// 1. 결제 채널 (B3 P-4: subscriptions.provider ∈ {toss, apple, google})
// ---------------------------------------------------------------------------

export const PAYMENT_CHANNELS = ["toss", "apple", "google"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

// ---------------------------------------------------------------------------
// 2. 상품 카탈로그 — 채널 공통 키 (B3 P-3 / 04 §6.1 확정 키를 그대로 사용)
//
//    ⚠️ 키는 dm_plus_monthly / dm_pro_monthly / dm_superlike_5 / dm_boost_1 로
//    확정한다 (B3 P-3 + 04 §6.1 "RevenueCat product id 규칙"과 동일).
//    오케스트레이터 초안의 dm_sub_plus / dm_item_* 표기는 본 확정 키로 대체됨 —
//    모든 테이블·원장 ref·이벤트 로깅·RevenueCat 상품 등록에 이 키만 쓴다.
//    가격은 키에 넣지 않는다(웹/IAP 차등가 — B3 P-3).
// ---------------------------------------------------------------------------

export const PRODUCT_KEYS = [
  "dm_plus_monthly",
  "dm_pro_monthly",
  "dm_superlike_5",
  "dm_boost_1",
] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

export type SubscriptionProductKey = "dm_plus_monthly" | "dm_pro_monthly";
export type ConsumableProductKey = "dm_superlike_5" | "dm_boost_1";

export interface SubscriptionProduct {
  key: SubscriptionProductKey;
  kind: "subscription";
  tier: Exclude<SubscriptionTier, "free">;
  /** 웹(Toss) VAT 포함 표시가=결제가. 단일 진실 = TIER_PRICES. IAP 는 스토어 실시간 가격 사용(getProducts). */
  webPrice: number;
  billingCycle: "monthly";
}

export interface ConsumableProduct {
  key: ConsumableProductKey;
  kind: "consumable";
  itemType: ItemType;
  quantity: number;
  /** 웹(Toss) VAT 포함가. 단일 진실 = ITEM_PRICES. */
  webPrice: number;
  /** 구매분 만료일수. null = 무만료 (A4 §3: 슈퍼라이크 구매분 무만료, 부스트 90일). */
  expiresInDays: number | null;
}

export type Product = SubscriptionProduct | ConsumableProduct;

export const PRODUCT_CATALOG = {
  dm_plus_monthly: {
    key: "dm_plus_monthly",
    kind: "subscription",
    tier: "plus",
    webPrice: TIER_PRICES.plus,
    billingCycle: "monthly",
  },
  dm_pro_monthly: {
    key: "dm_pro_monthly",
    kind: "subscription",
    tier: "pro",
    webPrice: TIER_PRICES.pro,
    billingCycle: "monthly",
  },
  dm_superlike_5: {
    key: "dm_superlike_5",
    kind: "consumable",
    itemType: "superlike",
    quantity: 5,
    webPrice: ITEM_PRICES.superlike_pack_5,
    expiresInDays: null,
  },
  dm_boost_1: {
    key: "dm_boost_1",
    kind: "consumable",
    itemType: "boost",
    quantity: 1,
    webPrice: ITEM_PRICES.boost_1,
    expiresInDays: 90,
  },
} as const satisfies Record<ProductKey, Product>;

// ---------------------------------------------------------------------------
// 3. 에러 코드 + HTTP 매핑
//    서버(Edge Function)는 이 코드만 반환하고, E4 는 코드→안내 문구 매핑만 한다.
// ---------------------------------------------------------------------------

export const PAYMENT_ERROR_CODES = [
  /** L2: 통신판매업 신고번호(ECOMMERCE_REG_NO) 부재 — 결제 세션 생성 차단. 웹훅은 무관. */
  "MAIL_ORDER_NO_MISSING",
  /** B3 P-4/W-5: 타 채널 활성 구독 존재. 안내 문구에 채널명 언급 금지(스토어 steering 시비 차단). */
  "SUB_CHANNEL_CONFLICT",
  /** 같은 채널에서 이미 활성 구독 존재 (업/다운그레이드는 별도 플로우 — B3 W-7). */
  "ALREADY_SUBSCRIBED",
  /** productKey 가 PRODUCT_CATALOG 에 없음. */
  "PRODUCT_NOT_FOUND",
  /** 결제/세션을 찾을 수 없음. */
  "PAYMENT_NOT_FOUND",
  /** A4 다크패턴 #7: 클라이언트 전송 금액 무시, 서버 카탈로그 재계산과 불일치. */
  "AMOUNT_MISMATCH",
  /** verifyWebhook 서명 검증 실패 — 지급/상태 전이 절대 금지, 원문 로깅 후 4xx. */
  "WEBHOOK_SIGNATURE_INVALID",
  /** 상태 머신 전이 표에 없는 전이 시도 (SUBSCRIPTION_TRANSITIONS 위반). */
  "INVALID_STATE_TRANSITION",
  /** 청약철회 7일(paid_at + 7 days, 서버 시각) 경과 — 해지 예약만 안내 (L7). */
  "REFUND_WINDOW_EXPIRED",
  /** 이미 환불 완료/진행 중인 결제. */
  "REFUND_ALREADY_PROCESSED",
  /** 아이템 잔액 부족 — 차감 실패 → 페이월 트리거 (A4 §2.2). */
  "INSUFFICIENT_BALANCE",
  /** 멱등키 중복 — 에러가 아닌 식별 코드. 최초 처리 결과를 그대로 재반환한다. */
  "IDEMPOTENT_REPLAY",
  /** PG/스토어 측 오류 통과 전달. */
  "PROVIDER_ERROR",
] as const;
export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

/** Edge Function 응답 status 매핑. IDEMPOTENT_REPLAY 는 200(원 결과 재반환). */
export const PAYMENT_ERROR_HTTP_STATUS: Record<PaymentErrorCode, number> = {
  MAIL_ORDER_NO_MISSING: 503,
  SUB_CHANNEL_CONFLICT: 409,
  ALREADY_SUBSCRIBED: 409,
  PRODUCT_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  AMOUNT_MISMATCH: 400,
  WEBHOOK_SIGNATURE_INVALID: 401,
  INVALID_STATE_TRANSITION: 409,
  REFUND_WINDOW_EXPIRED: 422,
  REFUND_ALREADY_PROCESSED: 409,
  INSUFFICIENT_BALANCE: 402,
  IDEMPOTENT_REPLAY: 200,
  PROVIDER_ERROR: 502,
};

/** 모든 provider 메서드 결과의 공통 형태 (discriminated union). */
export type PaymentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PaymentErrorCode; message?: string };

// ---------------------------------------------------------------------------
// 4. 구독 상태 머신 (A4 §4 확정)
//
//    none → active → (cancel_scheduled) → expired
//    active → past_due(유예 3일·재시도 3회) → expired
//    active|cancel_scheduled → refunded (7일 내 청약철회, 즉시 free 강등)
//    expired|refunded → active (재구독)
// ---------------------------------------------------------------------------

/** 상태별 허용 전이 목록. 여기 없는 전이는 INVALID_STATE_TRANSITION. */
export const SUBSCRIPTION_TRANSITIONS = {
  none: ["active"],
  active: ["cancel_scheduled", "past_due", "expired", "refunded"],
  cancel_scheduled: ["active", "expired", "refunded"],
  past_due: ["active", "expired"],
  expired: ["active"],
  refunded: ["active"],
} as const satisfies Record<SubscriptionStatus, readonly SubscriptionStatus[]>;

/** 전이 트리거 사전 — 각 전이가 어떤 사건으로만 일어나는지 명세 (구현 시 이 표 밖 전이 금지). */
export const SUBSCRIPTION_TRANSITION_TABLE = [
  { from: "none", to: "active", trigger: "checkout_confirmed" }, // 최초 결제 승인(웹훅 검증 후)
  { from: "active", to: "cancel_scheduled", trigger: "cancel_requested" }, // 기간 말 해지 예약(cancel_at = current_period_end)
  { from: "cancel_scheduled", to: "active", trigger: "cancel_withdrawn" }, // 기간 내 해지 철회
  { from: "cancel_scheduled", to: "expired", trigger: "period_ended" }, // 예약 도래 → free 강등
  { from: "active", to: "past_due", trigger: "renewal_failed" }, // 갱신 결제 실패 (유예 시작, 혜택 유지)
  { from: "past_due", to: "active", trigger: "retry_succeeded" }, // 재시도 성공
  { from: "past_due", to: "expired", trigger: "grace_exhausted" }, // 3일/3회 소진 → free 강등
  { from: "active", to: "expired", trigger: "provider_expired" }, // 채널 측 종료 통보 (IAP expiration 등)
  { from: "active", to: "refunded", trigger: "withdrawal_refunded" }, // 7일 내 청약철회 → 즉시 강등 + grant_sub 전량 회수
  { from: "cancel_scheduled", to: "refunded", trigger: "withdrawal_refunded" },
  { from: "expired", to: "active", trigger: "resubscribed" },
  { from: "refunded", to: "active", trigger: "resubscribed" },
] as const satisfies ReadonlyArray<{
  from: SubscriptionStatus;
  to: SubscriptionStatus;
  trigger: string;
}>;

export type SubscriptionTransitionTrigger =
  (typeof SUBSCRIPTION_TRANSITION_TABLE)[number]["trigger"];

/** 전이 가능 여부 판정 — 순수 조회. 구현부는 반드시 이 함수를 통과한 전이만 UPDATE 한다. */
export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  return (SUBSCRIPTION_TRANSITIONS[from] as readonly SubscriptionStatus[]).includes(to);
}

// ---------------------------------------------------------------------------
// 5. 원장(item_ledger) 지급/차감 규약
// ---------------------------------------------------------------------------

/**
 * 버킷 차감(소진) 우선순위 — 만료 임박분 우선 (A4 §2.2 확정):
 *   grant_sub(주간 지급, 당주 소멸) → grant_reward(보상, +30일) → purchase(무만료/90일)
 * 실제 SQL 구현은 이 배열이 아니라 `expires_at asc nulls last` 정렬
 * (idx_item_ledger_balance)로 같은 결과를 얻는다 — 두 정의가 어긋나면 A4 위반.
 */
export const BUCKET_CONSUME_ORDER = [
  "grant_sub",
  "grant_reward",
  "purchase",
] as const satisfies readonly LedgerBucket[];

/**
 * 원장 멱등키(ref) 포맷 규약. D1-6: unique 는 (user_id, ref) 복합 —
 * `weekly:2026-W34` 처럼 전 유저 공통 ref 가 가능하다.
 */
export type LedgerRef =
  | `payment:${string}` //       구매 지급 (payment_id) — 웹훅 검증 후에만
  | `refund:${string}` //        환불 회수 음수 행 (refund_request_id)
  | `weekly:${string}` //        주간 구독 지급 (weekly:2026-W34) — D7 cron
  | `weekly_reset:${string}` //  이전 주 grant_sub 잔여 소멸 음수 행
  | `monthly_boost:${string}` // 프로 월 부스트 지급 (A4 조정안 #2)
  | `quest:${string}` //         퀘스트 보상 (quest:{quest_id}:{date})
  | `use:${string}` //           사용 차감 (use:{uuid} — 클라이언트 요청 멱등키)
  | `admin:${string}`; //        어드민 정정 (반대 부호 새 행, audit_logs 필수)

/** 지급(+) 커맨드. ⚠️ 구매 지급은 verifyWebhook 통과 후에만 — 클라이언트 요청 단독 지급 절대 금지. */
export interface LedgerGrantCommand {
  userId: string;
  itemType: ItemType;
  /** 양수. */
  quantity: number;
  bucket: LedgerBucket;
  ref: LedgerRef;
  /** ISO timestamptz. null = 무만료(purchase 슈퍼라이크). */
  expiresAt: string | null;
}

/** 차감(−) 커맨드. 차감 순서는 서버가 BUCKET_CONSUME_ORDER(=expires_at asc)로 강제. */
export interface LedgerConsumeCommand {
  userId: string;
  itemType: ItemType;
  /** 양수(차감 개수). v1 사용 차감은 항상 1. */
  quantity: number;
  ref: LedgerRef;
}

export interface LedgerCommandResult {
  /** false = (user_id, ref) 멱등 충돌 — 이미 반영됨(재전송/더블탭), 원장 무변경. */
  applied: boolean;
  /** 커맨드 처리 후 유효 잔액 (만료분 제외 — item_balances 뷰 기준). */
  balanceAfter: number;
  /** 잔액 부족으로 차감 거부 시 INSUFFICIENT_BALANCE (지급은 항상 성공). */
  error?: Extract<PaymentErrorCode, "INSUFFICIENT_BALANCE">;
}

// ---------------------------------------------------------------------------
// 6. payments / payment_events Row 타입 (00012_payments.sql 과 1:1)
//    ※ types.ts 는 D1 소유로 동결 — payments 계열 Row 는 이 파일이 단일 소스.
// ---------------------------------------------------------------------------

export type PaymentStatus =
  | "ready" //            세션 생성됨, 승인 전
  | "confirmed" //        승인 완료 (웹훅/confirm 검증 후)
  | "failed" //           승인 실패
  | "partial_refunded" // 부분 환불 (소모성 미사용분 등)
  | "refunded"; //        전액 환불

export interface PaymentRow {
  id: string;
  user_id: string | null;
  provider: PaymentChannel;
  product_key: ProductKey;
  /** 서버가 카탈로그 기준 재계산한 결제액(원, VAT 포함) — 클라이언트 전송액 무시. */
  amount: number;
  currency: "KRW";
  status: PaymentStatus;
  /** PG/스토어 측 결제 식별자 (Toss paymentKey / 스토어 transaction id). */
  provider_payment_id: string | null;
  /** 체크아웃 세션/주문 식별자 (Toss orderId). */
  provider_session_id: string | null;
  /** 청약철회 7일 기산점 — 서버 시각. */
  paid_at: string | null;
  refunded_amount: number;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentEventStatus = "received" | "processed" | "skipped" | "failed";

/** 웹훅 이벤트 원장 — (provider, event_id) unique 로 재전송 멱등 처리. */
export interface PaymentEventRow {
  id: number;
  provider: PaymentChannel;
  /** 채널 측 이벤트 고유 id. 없는 채널은 payload 해시로 대체 생성. */
  event_id: string;
  event_type: string;
  payload: Json;
  status: PaymentEventStatus;
  error: string | null;
  payment_id: string | null;
  received_at: string;
  processed_at: string | null;
}

// ---------------------------------------------------------------------------
// 7. 웹훅 정규화 이벤트 (B3 P-5: provider 무관 공통 파이프라인의 입력)
// ---------------------------------------------------------------------------

export type PaymentWebhookEventType =
  | "payment.confirmed" //          단건/최초 결제 승인 → 지급/구독 활성
  | "subscription.renewed" //       갱신 성공 → 기간 연장 (+ 프로 월 부스트 지급)
  | "subscription.renewal_failed" // 갱신 실패 → past_due
  | "subscription.expired" //       채널 측 종료 → expired
  | "refund.completed" //           (부분)취소 성공 → 원장 회수 확정 + 상태 전이
  | "refund.failed"; //             취소 실패 → 보상 트랜잭션(원장 회수 롤백)

/** verifyWebhook 이 반환하는, 채널 표현을 벗겨낸 공통 이벤트. */
export interface PaymentWebhookEvent {
  provider: PaymentChannel;
  eventId: string;
  type: PaymentWebhookEventType;
  /** 채널 측 발생 시각 (ISO). */
  occurredAt: string;
  providerPaymentId: string | null;
  providerSubscriptionId: string | null;
  /** 원문 페이로드 — payment_events.payload 에 그대로 보존. */
  raw: Json;
}

export type WebhookVerification =
  | { valid: true; event: PaymentWebhookEvent }
  | { valid: false; error: Extract<PaymentErrorCode, "WEBHOOK_SIGNATURE_INVALID"> };

// ---------------------------------------------------------------------------
// 8. PaymentProvider 인터페이스 (서버측 계약 — Edge Function 이 사용)
// ---------------------------------------------------------------------------

/** B3 P-2: 채널별 UX 능력치. UI 는 이 값으로만 분기(채널명 하드코딩 금지). */
export interface ProviderCapabilities {
  /** 앱/웹 내 자체 환불 플로우 제공 여부 (toss=true, IAP=false — 스토어 위임). */
  canRefundInApp: boolean;
  /** 카탈로그 가격을 직접 표시 가능 여부 (IAP 는 getProducts 스토어 실시간 가격만). */
  canShowPrice: boolean;
  /** 외부(리다이렉트) 체크아웃 여부 (Toss=true, IAP=false). */
  externalCheckout: boolean;
}

export interface CreateCheckoutSessionParams {
  userId: string;
  productKey: ProductKey;
  /**
   * 결제 성공/실패 복귀 라우트 — 경로 기반(`/settings/subscription/...`),
   * 절대 URL 조립은 buildAppUrl() 유틸 소관 (B3 §5.1).
   */
  successPath: string;
  failPath: string;
  /** 세션 생성 멱등키 (더블탭 방어). */
  idempotencyKey: string;
}

export interface CheckoutSession {
  /** payments.id (status=ready 행 선생성). */
  paymentId: string;
  productKey: ProductKey;
  /** 서버 재계산 금액 — E4 는 이 값만 표시. */
  amount: number;
  currency: "KRW";
  /** 리다이렉트형(Toss) 결제 URL. IAP 는 null (네이티브 구매 시트). */
  checkoutUrl: string | null;
  expiresAt: string;
}

export interface ConfirmPaymentParams {
  paymentId: string;
  /** 채널 승인 자격 증명 (Toss: paymentKey+orderId+amount 등) — 채널별 해석. */
  providerPayload: Json;
}

export interface ConfirmedPayment {
  payment: PaymentRow;
  /** 구독 상품이면 전이 결과 상태 (checkout_confirmed | resubscribed). */
  subscriptionStatus: SubscriptionStatus | null;
  /** 소모성 상품이면 지급 결과 (verifyWebhook/승인 검증 통과 후에만 채워짐). */
  ledger: LedgerCommandResult | null;
}

export interface CancelSubscriptionParams {
  userId: string;
  subscriptionId: string;
  /** true = 해지 철회(cancel_withdrawn). false/생략 = 기간 말 해지 예약(cancel_requested). */
  withdraw?: boolean;
}

export interface CancelSubscriptionResult {
  subscriptionId: string;
  status: SubscriptionStatus;
  /** 해지 예약 시 = current_period_end. 혜택은 이 시각까지 유지 (A4 §4). */
  cancelAt: string | null;
}

/**
 * calc_refund(payment_ref, at) 반환 jsonb 와 1:1 (00004 뼈대 — Phase 3 구현).
 * 어드민 큐(D8)와 유저 신청 화면(E4)이 같은 함수 결과를 표시한다 (A4 §5.4-2).
 */
export interface RefundCalcResult {
  paymentId: string;
  kind: "subscription" | "consumable";
  paidAmount: number;
  /** 구독: ceil((at−paid_at)/24h), 최소 1. 소모성은 null. */
  usedDays: number | null;
  /** 구독: 월요금 × d / 30, 원단위 절사. */
  proratedUsage: number | null;
  /** 구독: 해당 결제 grant_sub 사용 개수 × 정가단가(ITEM_PRICES.superlike_unit / boost_1). */
  grantedItemUsage: number | null;
  /** 소모성: 해당 결제 ref 의 purchase 버킷 잔여량. 구독은 null. */
  unusedQuantity: number | null;
  /** 최종 환불액 = max(0, …) — A4 §5.2/5.3 계산식 그대로. */
  refundable: number;
  /** 7일 창 내 여부 (서버 시각, paid_at + interval '7 days'). */
  withinWindow: boolean;
}

export interface ProcessRefundParams {
  paymentId: string;
  refundRequestId: string;
  /** 서버 calc_refund 결과 금액 — 클라이언트 입력 금액 사용 금지. */
  amount: number;
  reason: string;
  /** 서비스 귀책(장애·오과금·중복결제) = 기간·사용분 무관 전액 환불 분기 (L7). */
  serviceFault?: boolean;
}

export interface RefundProcessed {
  payment: PaymentRow;
  refundRequestId: string;
  refundedAmount: number;
  /** 구독 환불이면 refunded 전이 + grant_sub 전량 회수 결과. */
  subscriptionStatus: SubscriptionStatus | null;
  ledgerReclaims: LedgerCommandResult[];
}

/**
 * 결제 어댑터 서버측 계약 (B3 P-1: 모든 결제 진입은 이 인터페이스 경유,
 * 구현체 직접 import 금지).
 *
 * 구현 규약:
 *  1) createCheckoutSession 최상단에서 통신판매업 신고번호(env ECOMMERCE_REG_NO)
 *     부재 시 MAIL_ORDER_NO_MISSING(503) — L2 하드 블로커. 웹훅 처리는 예외 없이 동작.
 *  2) 활성 구독 존재 + 타 채널 구독 상품 → SUB_CHANNEL_CONFLICT(409).
 *     DB 최종 방어선 = uq_subscriptions_active partial unique.
 *  3) 금액은 항상 PRODUCT_CATALOG 서버 재계산 — 불일치 시 AMOUNT_MISMATCH.
 *  4) 지급/상태 전이는 verifyWebhook 검증 통과 + payment_events 멱등 기록 후에만.
 *  5) 상태 전이는 canTransitionSubscription 통과분만 허용.
 */
export interface PaymentProvider {
  readonly channel: PaymentChannel;
  readonly capabilities: ProviderCapabilities;

  /** 가격 단일 소스: toss = PRODUCT_CATALOG.webPrice, IAP = 스토어 실시간 조회 (B3 P-2·P-6). */
  getProducts(): Promise<Product[]>;

  createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<PaymentResult<CheckoutSession>>;

  /** 리다이렉트 복귀/승인 콜백 검증 → payments 확정. 승인 실검증(서버-투-서버) 필수. */
  confirmPayment(params: ConfirmPaymentParams): Promise<PaymentResult<ConfirmedPayment>>;

  /** 기간 말 해지 예약 / 해지 철회. 즉시 강등 아님 (A4 §4). */
  cancelSubscription(
    params: CancelSubscriptionParams,
  ): Promise<PaymentResult<CancelSubscriptionResult>>;

  /**
   * 웹훅 서명 검증 + 공통 이벤트로 정규화. 부수효과 금지(순수 검증) —
   * 지급·전이는 공통 파이프라인(B3 P-5)이 payment_events 멱등 기록 후 수행.
   */
  verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerification>;

  /** PG 부분취소 호출. 취소 성공 웹훅(refund.completed) 확인 후에만 원장 확정 (A4 §5.3). */
  processRefund(params: ProcessRefundParams): Promise<PaymentResult<RefundProcessed>>;
}

// ---------------------------------------------------------------------------
// 9. 클라이언트 어댑터 계약 (B3 P-2 — apps/web/lib/payments 팩토리가 구현)
//    UI/훅은 이 타입만 알며, getRuntime() 분기는 팩토리 소관 (B3 E-1).
// ---------------------------------------------------------------------------

export interface ClientPaymentAdapter {
  readonly capabilities: ProviderCapabilities;
  getProducts(): Promise<Product[]>;
  /** 웹 = 체크아웃 리다이렉트, IAP = 네이티브 구매 시트. */
  purchase(productKey: ProductKey): Promise<PaymentResult<{ paymentId: string }>>;
  /** IAP 구매 복원. 웹은 no-op 성공. */
  restore(): Promise<PaymentResult<{ restored: number }>>;
  /** IAP = 스토어 구독 설정 딥링크. 웹 = null(자체 2뎁스 해지 화면 사용). */
  manageSubscriptionUrl(): string | null;
}

// ---------------------------------------------------------------------------
// 10. 구현체 자리 — 선언만. 본체는 Phase 3/4 에서 apps/web/lib/payments 와 함께.
// ---------------------------------------------------------------------------

export const TOSS_CAPABILITIES: ProviderCapabilities = {
  canRefundInApp: true,
  canShowPrice: true,
  externalCheckout: true,
};

export const IAP_CAPABILITIES: ProviderCapabilities = {
  canRefundInApp: false, // 환불은 스토어 위임 (B3 E-3)
  canShowPrice: false, //  가격은 getProducts 스토어 실시간 조회만 (B3 P-2)
  externalCheckout: false,
};

/** Phase 3: Toss Payments 빌링키 구현체 자리. 지금은 전 메서드 NotImplementedError. */
export class TossPaymentsProvider implements PaymentProvider {
  readonly channel = "toss" as const;
  readonly capabilities = TOSS_CAPABILITIES;

  getProducts(): Promise<Product[]> {
    throw new NotImplementedError("Phase 3");
  }
  createCheckoutSession(
    _params: CreateCheckoutSessionParams,
  ): Promise<PaymentResult<CheckoutSession>> {
    throw new NotImplementedError("Phase 3");
  }
  confirmPayment(_params: ConfirmPaymentParams): Promise<PaymentResult<ConfirmedPayment>> {
    throw new NotImplementedError("Phase 3");
  }
  cancelSubscription(
    _params: CancelSubscriptionParams,
  ): Promise<PaymentResult<CancelSubscriptionResult>> {
    throw new NotImplementedError("Phase 3");
  }
  verifyWebhook(_rawBody: string, _signature: string): Promise<WebhookVerification> {
    throw new NotImplementedError("Phase 3");
  }
  processRefund(_params: ProcessRefundParams): Promise<PaymentResult<RefundProcessed>> {
    throw new NotImplementedError("Phase 3");
  }
}

/** Phase 4: RevenueCat(App Store/Play) 구현체 자리. 채널은 apple/google 중 생성 시 지정. */
export class IapProvider implements PaymentProvider {
  readonly channel: Extract<PaymentChannel, "apple" | "google">;
  readonly capabilities = IAP_CAPABILITIES;

  constructor(channel: Extract<PaymentChannel, "apple" | "google">) {
    this.channel = channel;
  }

  getProducts(): Promise<Product[]> {
    throw new NotImplementedError("Phase 4");
  }
  createCheckoutSession(
    _params: CreateCheckoutSessionParams,
  ): Promise<PaymentResult<CheckoutSession>> {
    throw new NotImplementedError("Phase 4");
  }
  confirmPayment(_params: ConfirmPaymentParams): Promise<PaymentResult<ConfirmedPayment>> {
    throw new NotImplementedError("Phase 4");
  }
  cancelSubscription(
    _params: CancelSubscriptionParams,
  ): Promise<PaymentResult<CancelSubscriptionResult>> {
    throw new NotImplementedError("Phase 4");
  }
  verifyWebhook(_rawBody: string, _signature: string): Promise<WebhookVerification> {
    throw new NotImplementedError("Phase 4");
  }
  processRefund(_params: ProcessRefundParams): Promise<PaymentResult<RefundProcessed>> {
    throw new NotImplementedError("Phase 4");
  }
}
