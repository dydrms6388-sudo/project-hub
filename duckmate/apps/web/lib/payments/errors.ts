/**
 * 결제/권한 에러 코드 (D6 자체 상수)
 *
 * D2 의 `lib/errors.ts` 와 통합 메모(19_payments.md §0-10):
 *   - `NOT_ENTITLED`·`RATE_LIMITED`·`NOT_AUTHENTICATED` 는 `@duckmate/db` 의 `ERROR_CODES` 와 동일 문자열.
 *   - 아래 코드들은 RPC/Edge Function 이 `raise exception '<CODE>: detail'` 로 던지고,
 *     E 그룹은 message 의 첫 토큰(`:` 앞)으로 매핑한다 (14_schema §0-40 규칙 그대로).
 *   - D2 의 공용 에러 클래스가 확정되면 `PaymentError` 는 그것을 extends 하도록 바꾸되
 *     코드 문자열·message 포맷(`${code}: ${detail}`)은 유지한다.
 */
export const PAYMENT_ERROR_CODES = {
  /** 티어 권한 없음 (A4 §2.3 #5 undo 등) */
  NOT_ENTITLED: "NOT_ENTITLED",
  /** 일/주 한도 초과 (A4 §2.3 #2 daily_card_limit 등) */
  LIMIT_REACHED: "LIMIT_REACHED",
  /** 주간 쿼터·구매 잔액 모두 0 (A4 §2.3 #4) */
  NO_SUPERLIKE: "NO_SUPERLIKE",
  /** 이벤트 우선 접수 기간 (A4 §2.3 #7) */
  PRIORITY_WINDOW: "PRIORITY_WINDOW",
  /** 되돌리기 300초 경과 (A4 §2.3 #5, HTTP 410) */
  EXPIRED: "EXPIRED",
  /** `PAYMENTS_ENABLED !== 'true'` — Phase 3 전 모든 유료 경로 */
  PAYMENTS_DISABLED: "PAYMENTS_DISABLED",
  /** 구독 상태 머신 위반 (state-machine.ts) */
  INVALID_TRANSITION: "INVALID_TRANSITION",
  /** 웹훅 서명 검증 실패 / 결제 조회 불일치 */
  WEBHOOK_INVALID: "WEBHOOK_INVALID",
  /** 같은 provider_event_id 재수신 (idempotent 처리, 에러가 아닌 200 응답 대상) */
  WEBHOOK_DUPLICATE: "WEBHOOK_DUPLICATE",
  /** 서버 재계산 금액 ≠ provider 청구 금액 */
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  /** 유저당 살아있는 구독 1개 규칙 위반 (subscriptions_one_live_per_user) */
  DUPLICATE_SUBSCRIPTION: "DUPLICATE_SUBSCRIPTION",
  /** 청약철회 불가 (7일 경과·사용 개시) */
  REFUND_NOT_ELIGIBLE: "REFUND_NOT_ELIGIBLE",
  /** 계산 함수 입력 검증 실패 */
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES];

/** 권한 체크 실패 → HTTP 상태 매핑 (A4 §2.3 표) */
export const PAYMENT_ERROR_HTTP_STATUS: Readonly<Record<PaymentErrorCode, number>> = {
  NOT_ENTITLED: 403,
  LIMIT_REACHED: 403,
  NO_SUPERLIKE: 403,
  PRIORITY_WINDOW: 403,
  EXPIRED: 410,
  PAYMENTS_DISABLED: 501,
  INVALID_TRANSITION: 409,
  WEBHOOK_INVALID: 400,
  WEBHOOK_DUPLICATE: 200,
  AMOUNT_MISMATCH: 409,
  DUPLICATE_SUBSCRIPTION: 409,
  REFUND_NOT_ELIGIBLE: 422,
  INVALID_INPUT: 400,
};

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly detail: string | undefined;

  constructor(code: PaymentErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PaymentError";
    this.code = code;
    this.detail = detail;
  }

  get httpStatus(): number {
    return PAYMENT_ERROR_HTTP_STATUS[this.code];
  }
}

export function isPaymentError(e: unknown, code?: PaymentErrorCode): e is PaymentError {
  return e instanceof PaymentError && (code === undefined || e.code === code);
}

/** "PAYMENTS_DISABLED: Phase 3" — 모든 stub provider 가 던지는 단일 에러 */
export function paymentsDisabledError(): PaymentError {
  return new PaymentError(PAYMENT_ERROR_CODES.PAYMENTS_DISABLED, "Phase 3");
}
