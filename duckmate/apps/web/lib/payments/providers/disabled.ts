/**
 * Phase 1~2 기본 provider. `PAYMENTS_ENABLED !== 'true'` 이면 항상 이것이 반환된다.
 * 모든 메서드가 "PAYMENTS_DISABLED: Phase 3" 를 던진다 — UI 는 호출 전에 `isPaymentsEnabled()` 로 분기해
 * "준비 중" 배지만 보여주고 결제 버튼을 노출하지 않는다(A4 §0, 브리프 규칙 1).
 */
import { paymentsDisabledError } from "../errors";
import type { PaymentProvider, RefundPath } from "../types";

export class DisabledPaymentProvider implements PaymentProvider {
  readonly id = "disabled" as const;

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
