/**
 * TossPaymentProvider — Phase 3 구현 자리 (지금은 stub: 모든 메서드 PAYMENTS_DISABLED).
 *
 * Phase 3 구현 메모 (19_payments.md §2·§3 참조):
 *  - createCheckout: 서버가 `skus.price_krw`(is_active) 를 읽어 orderId(=payments.id 사전 발급)·amount 로
 *    Toss 결제창(정기결제는 billingAuth → billingKey) 세션 생성. customerKey = auth user_id.
 *    금액은 절대 클라이언트에서 받지 않는다.
 *  - verifyWebhook: (1) `TOSS_WEBHOOK_SECRET` 가 있으면 서명 헤더 HMAC 검증, (2) 항상 결제 조회 API
 *    (`GET /v1/payments/{paymentKey}`, secret key Basic) 로 status·totalAmount 를 재확인 → 불일치 시 WEBHOOK_INVALID.
 *    이벤트 매핑: PAYMENT_STATUS_CHANGED(DONE→payment.succeeded, CANCELED/PARTIAL_CANCELED→payment.refunded,
 *    ABORTED/EXPIRED→payment.failed); 자동결제 성공/실패는 어댑터가 subscription.renewed / subscription.past_due 로 번역.
 *  - cancelSubscription('period_end'): billingKey 삭제 없이 `subscriptions.cancel_at = current_period_end` 만 기록
 *    (갱신 배치가 cancel_at 이 있으면 청구하지 않음). 'now' 는 refund 플로우 전용.
 *  - refund: Toss 결제 취소 API(`POST /v1/payments/{paymentKey}/cancel`, cancelAmount = compute_refund 결과)
 *    → payments.refunded_amount_krw 갱신은 웹훅(payment.refunded)이 담당(직접 갱신 금지, 단일 경로).
 *  - getDisplayPrice: `skus` 행 → "₩9,900" + display_terms.
 *  - manageSubscriptionUrl: 웹은 앱 내 화면(/settings/subscription) → null.
 *  - refundPath: { kind: 'in_app' }.
 *  - Toss 전용 UI(카드 등록·사업자 정보 블록·전자상거래법 고지)는 이 provider 의 내부 컴포넌트로 격리(B3 §0-11).
 */
import { paymentsDisabledError } from "../errors";
import type { PaymentProvider, RefundPath } from "../types";

export class TossPaymentProvider implements PaymentProvider {
  readonly id = "toss" as const;

  createCheckout(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  verifyWebhook(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  cancelSubscription(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  refund(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  getDisplayPrice(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  manageSubscriptionUrl(): Promise<never> {
    return Promise.reject(paymentsDisabledError());
  }
  refundPath(): RefundPath {
    throw paymentsDisabledError();
  }
}
