/**
 * RevenueCatPaymentProvider — Phase 4 (Apple IAP / Google Play Billing, RevenueCat 경유) 자리. stub.
 *
 * Phase 4 구현 메모 (B3 §4):
 *  - provider id 는 플랫폼별 'apple' | 'google' (RevenueCat 은 집계 SDK 일 뿐 enum 값이 아님).
 *  - createCheckout: 웹 redirect 가 아니라 SDK `purchasePackage()` 호출. redirectUrl 은 앱 내 딥링크 규약으로.
 *  - verifyWebhook: RevenueCat 웹훅 `Authorization` 헤더 == `REVENUECAT_WEBHOOK_AUTH` 비교(상수 시간).
 *    event.id = providerEventId. INITIAL_PURCHASE→activated, RENEWAL→renewed, BILLING_ISSUE→past_due,
 *    CANCELLATION(자동갱신 off)→canceled, EXPIRATION→expired, REFUND→payment.refunded(+subscription refunded),
 *    NON_RENEWING_PURCHASE→payment.succeeded + item.granted(expiresAt = null — IAP 소모성은 만료 불가, B3 §2.4).
 *  - cancelSubscription: 스토어가 관리 → 앱은 manageSubscriptionUrl 딥링크만. 'now' 는 스토어 환불 웹훅으로만 도달.
 *  - refund: 스토어 절차 → 직접 실행 불가 → 항상 reject. compute_refund 는 Toss 전용(B3 §4.5).
 *  - getDisplayPrice: 스토어 현지화 문자열만, amountKrw = null. skus.apple_product_id/google_product_id 매핑.
 *  - refundPath: { kind: 'store', url: 'https://reportaproblem.apple.com' | Play 결제 내역 }.
 *  - 중복 구독 방지: 웹훅 insert 가 `subscriptions_one_live_per_user` 에 걸리면 자동 환불 요청 + 운영 알림(duplicate_charge).
 */
import { paymentsDisabledError } from "../errors";
import type { PaymentProvider, RefundPath } from "../types";

export class RevenueCatPaymentProvider implements PaymentProvider {
  readonly id: "apple" | "google";

  constructor(platform: "apple" | "google") {
    this.id = platform;
  }

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
