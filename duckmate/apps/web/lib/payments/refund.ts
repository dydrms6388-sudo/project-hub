/**
 * 청약철회·환불 계산 (A4 §6.1 / refund-policy.md §3) — 순수 함수
 *
 * 서버 진실은 Phase 3 의 SQL `compute_refund(payment_id, requested_at)` 이며, 그 함수는 **이 파일과
 * 같은 입력에 같은 출력**을 내야 한다(19_payments.md §4.3 대조 테스트). 클라이언트는 이 함수를
 * "예상 환불액 즉시 표시"(A4 §5-14) 용으로만 쓰고, 실제 환불액은 서버 계산값을 쓴다.
 *
 * 일수 규칙(결정):
 *  - 사용일수 U 는 **KST 달력일** 차이 + 1. 결제 당일 = 1일. (A4 의 floor((R-P)/1day)+1 은 시각이 같을 때
 *    같은 값이며, 달력일 기준이 "9/1 결제 → 9/3 요청 = 3일" 예시와 항상 일치한다.)
 *  - 해당 달 일수 D 는 결제일(KST)이 속한 달의 총 일수.
 *  - 7일 창은 시각 기준: `now - purchasedAt <= 7 × 24h` (SQL: `requested_at - paid_at <= interval '7 days'`).
 *  - card_refill 의 "당일" 은 loop_date(07:00 KST 경계) 기준 (refund-policy §3.4).
 * 반올림: Math.round (양수이므로 SQL `round(numeric)` 과 동일. SQL 에서 double 이 아닌 numeric 을 써야 함).
 */
import { loopDate } from "@duckmate/db";
import { PAYMENT_ERROR_CODES, PaymentError } from "./errors";
import type { RefundReason } from "./types";

export const WITHDRAWAL_WINDOW_DAYS = 7;
export const WITHDRAWAL_WINDOW_MS = WITHDRAWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
/** 7일 규칙·사용분 차감 미적용, 전액 (A4 §6.3) */
export const FULL_REFUND_REASONS = ["service_fault", "duplicate_charge", "minor"] as const satisfies ReadonlyArray<RefundReason>;
export const REFUND_FORMULA_VERSION = 1;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RefundKind = "subscription" | "item" | "boost" | "card_refill";

export interface RefundInput {
  kind: RefundKind;
  /** 결제 금액 F (부가세 포함, ₩ 정수) */
  price: number;
  purchasedAt: Date | string;
  now: Date | string;
  /** 기본 'change_of_mind' */
  reasonCode?: RefundReason;
  // --- subscription ---
  /** 명시하면 자동 계산 대신 사용(테스트·SQL 대조용) */
  usedDays?: number;
  daysInMonth?: number;
  // --- item / boost / card_refill ---
  /** 묶음 수량 Q (boost 는 1) */
  qty?: number;
  /** 사용 수량 u (boost: 발동 = 1) */
  usedQty?: number;
  /** ledger 에서 실제 회수 가능한 수량(퀘스트분 선소진 규칙으로 잔액 < 미사용분일 때). 생략 = qty - usedQty */
  reclaimableQty?: number;
}

export type RefundOutcome =
  /** 7일 내 공식 적용 */
  | "formula"
  /** 사유 코드에 의한 전액 환불 */
  | "full_by_reason"
  /** 7일 경과 — 환불 불가, 잔여 혜택 유지 */
  | "window_expired"
  /** 사용 개시로 환불 0 (부스트 발동, 카드 리필 사용) */
  | "consumed"
  /** card_refill: 구매 당일(loop_date) 아님 */
  | "not_same_day";

export interface RefundFormulaSnapshot {
  version: typeof REFUND_FORMULA_VERSION;
  kind: RefundKind;
  reasonCode: RefundReason;
  price: number;
  purchasedAt: string;
  requestedAt: string;
  elapsedMs: number;
  withinWindow: boolean;
  usedDays?: number;
  daysInMonth?: number;
  qty?: number;
  usedQty?: number;
  reclaimableQty?: number;
  /** F / Q (반올림 전) */
  unitPrice?: number;
  deductionKrw: number;
  refundKrw: number;
  outcome: RefundOutcome;
}

export interface RefundComputation {
  /** refundKrw > 0 */
  eligible: boolean;
  refundKrw: number;
  deductionKrw: number;
  outcome: RefundOutcome;
  /** `refund_requests.formula_snapshot` 에 그대로 저장 (5년 보존) */
  snapshot: RefundFormulaSnapshot;
}

function toDate(v: Date | string, field: string): Date {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, `${field} is not a date`);
  return d;
}

function assertNonNegInt(v: number, field: string): void {
  if (!Number.isInteger(v) || v < 0) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, `${field} must be a non-negative integer`);
}

/** KST 달력일 번호 (epoch 기준 일수) */
function kstDayNumber(d: Date): number {
  return Math.floor((d.getTime() + KST_OFFSET_MS) / DAY_MS);
}

/** 결제일(KST)이 속한 달의 총 일수 */
export function daysInKstMonth(d: Date): number {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 0)).getUTCDate();
}

/** U = max(1, KST 달력일 차이 + 1) */
export function usedDaysBetween(purchasedAt: Date, now: Date): number {
  return Math.max(1, kstDayNumber(now) - kstDayNumber(purchasedAt) + 1);
}

export function isFullRefundReason(reason: RefundReason): boolean {
  return (FULL_REFUND_REASONS as ReadonlyArray<RefundReason>).includes(reason);
}

export function computeRefund(input: RefundInput): RefundComputation {
  const purchasedAt = toDate(input.purchasedAt, "purchasedAt");
  const now = toDate(input.now, "now");
  assertNonNegInt(input.price, "price");
  const reasonCode: RefundReason = input.reasonCode ?? "change_of_mind";
  const elapsedMs = now.getTime() - purchasedAt.getTime();
  if (elapsedMs < 0) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, "now is before purchasedAt");
  const withinWindow = elapsedMs <= WITHDRAWAL_WINDOW_MS;

  const base: Omit<RefundFormulaSnapshot, "deductionKrw" | "refundKrw" | "outcome"> = {
    version: REFUND_FORMULA_VERSION,
    kind: input.kind,
    reasonCode,
    price: input.price,
    purchasedAt: purchasedAt.toISOString(),
    requestedAt: now.toISOString(),
    elapsedMs,
    withinWindow,
  };

  const finish = (partial: Partial<RefundFormulaSnapshot>, deductionKrw: number, refundKrw: number, outcome: RefundOutcome): RefundComputation => {
    const snapshot: RefundFormulaSnapshot = { ...base, ...partial, deductionKrw, refundKrw, outcome };
    return { eligible: refundKrw > 0, refundKrw, deductionKrw, outcome, snapshot };
  };

  // 예외 사유: 7일 규칙·차감 미적용, 전액 (A4 §6.3)
  if (isFullRefundReason(reasonCode)) {
    return finish({}, 0, input.price, "full_by_reason");
  }

  switch (input.kind) {
    case "subscription": {
      const usedDays = input.usedDays ?? usedDaysBetween(purchasedAt, now);
      const daysInMonth = input.daysInMonth ?? daysInKstMonth(purchasedAt);
      if (!Number.isInteger(usedDays) || usedDays < 1) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, "usedDays must be >= 1");
      if (!Number.isInteger(daysInMonth) || daysInMonth < 28 || daysInMonth > 31) {
        throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, "daysInMonth must be 28..31");
      }
      if (!withinWindow) return finish({ usedDays, daysInMonth }, input.price, 0, "window_expired");
      const deduction = Math.round((input.price * usedDays) / daysInMonth);
      return finish({ usedDays, daysInMonth }, deduction, input.price - deduction, "formula");
    }

    case "item": {
      const qty = input.qty ?? 0;
      const usedQty = input.usedQty ?? 0;
      assertNonNegInt(qty, "qty");
      assertNonNegInt(usedQty, "usedQty");
      if (qty < 1) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, "qty must be >= 1");
      if (usedQty > qty) throw new PaymentError(PAYMENT_ERROR_CODES.INVALID_INPUT, "usedQty > qty");
      const unitPrice = input.price / qty;
      const remaining = qty - usedQty;
      const reclaimableQty = Math.min(remaining, input.reclaimableQty ?? remaining);
      assertNonNegInt(reclaimableQty, "reclaimableQty");
      if (!withinWindow) return finish({ qty, usedQty, reclaimableQty, unitPrice }, input.price, 0, "window_expired");
      // 잔액이 미사용분보다 적으면 실제 회수 가능 수량 기준 (A4 §6.2 예시 2 주석)
      const refund = reclaimableQty < remaining ? Math.round(unitPrice * reclaimableQty) : input.price - Math.round(unitPrice * usedQty);
      const deduction = input.price - refund;
      return finish({ qty, usedQty, reclaimableQty, unitPrice }, deduction, refund, refund === 0 && usedQty === qty ? "consumed" : "formula");
    }

    case "boost": {
      const usedQty = input.usedQty ?? 0;
      assertNonNegInt(usedQty, "usedQty");
      // 발동 = 사용 개시 = 전량 사용 (남은 시간 무관)
      if (usedQty > 0) return finish({ qty: 1, usedQty: 1, unitPrice: input.price }, input.price, 0, "consumed");
      if (!withinWindow) return finish({ qty: 1, usedQty: 0, unitPrice: input.price }, input.price, 0, "window_expired");
      return finish({ qty: 1, usedQty: 0, unitPrice: input.price }, 0, input.price, "formula");
    }

    case "card_refill": {
      const qty = input.qty ?? 3;
      const usedQty = input.usedQty ?? 0;
      assertNonNegInt(usedQty, "usedQty");
      const unitPrice = input.price / qty;
      // 1장이라도 사용 시 불가
      if (usedQty > 0) return finish({ qty, usedQty, unitPrice }, input.price, 0, "consumed");
      // 미사용 + 구매 당일(loop_date, 07:00 KST 경계) 만 전액
      if (loopDate(purchasedAt) !== loopDate(now)) return finish({ qty, usedQty, unitPrice }, input.price, 0, "not_same_day");
      return finish({ qty, usedQty, unitPrice }, 0, input.price, "formula");
    }
  }
}
