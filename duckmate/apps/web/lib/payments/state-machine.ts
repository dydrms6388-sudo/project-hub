/**
 * 구독 상태 머신 (순수 함수, I/O 없음)
 *
 *   free ──activated──▶ active ──past_due──▶ past_due ──renewed──▶ active
 *                        │  ▲                   │
 *                        │  └──activated(해지 철회)── canceled ◀──canceled──┘
 *                        │                              │
 *                        ├──canceled──▶ canceled ──expired──▶ expired (종단)
 *                        ├──expired───▶ expired (종단)
 *                        └──payment.refunded──▶ refunded (종단, past_due/canceled 에서도 가능)
 *
 * - `free` 는 DB 행이 없는 가상 상태(A4 §0). 구독 1건 = 상태 머신 1개. 만료/환불 후 재구독은
 *   **새 행 = free 에서 다시 시작**이며 `subscriptions_one_live_per_user`(active/past_due/canceled) 가
 *   동시에 두 개가 살아있는 것을 막는다.
 * - `canceled` 는 "갱신 안 함 + 기간 말까지 혜택 유지". 따라서 canceled + renewed 는 **불변식 위반**(에러).
 * - 자기 전이(active+renewed, past_due+past_due)만 허용하고 나머지 중복 이벤트는 에러.
 *   웹훅 재전송은 상태 머신이 아니라 provider_event_id idempotency 가 흡수한다(19_payments §3).
 * - Phase 3 웹훅 핸들러는 `SELECT ... FOR UPDATE` 로 행을 잠근 뒤 이 함수를 호출하고, 에러면
 *   `INVALID_TRANSITION` 을 audit_logs 에 남기고 행을 바꾸지 않는다(200 응답, 재시도 유도 금지).
 */
import type { Enums } from "@duckmate/db";
import { PAYMENT_ERROR_CODES, PaymentError } from "./errors";
import { PROVIDER_EVENT_TYPES, type ProviderEventType } from "./types";

export type SubscriptionState = "free" | Enums["subscription_status"];

export const SUBSCRIPTION_STATES = ["free", "active", "past_due", "canceled", "expired", "refunded"] as const satisfies ReadonlyArray<SubscriptionState>;

/** `get_effective_tier`·부분 유니크 인덱스가 "살아있는 구독"으로 보는 상태 */
export const LIVE_STATES = ["active", "past_due", "canceled"] as const satisfies ReadonlyArray<SubscriptionState>;
/** 종단 상태: 어떤 이벤트도 받지 않는다 */
export const TERMINAL_STATES = ["expired", "refunded"] as const satisfies ReadonlyArray<SubscriptionState>;

/** 상태 머신이 소비하는 이벤트 = provider 이벤트 전체. 표에 없는 조합은 에러 */
export type SubscriptionMachineEvent = ProviderEventType;

/**
 * 전이표 (state × event → next). 표에 없으면 INVALID_TRANSITION.
 * `payment.succeeded`/`payment.failed`/`item.granted` 는 구독 상태를 직접 바꾸지 않는다 —
 * Toss 자동결제 성공/실패는 provider 어댑터가 `subscription.renewed`/`subscription.past_due` 로 번역해 넣는다.
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionState, Readonly<Partial<Record<SubscriptionMachineEvent, SubscriptionState>>>>> = {
  free: {
    "subscription.activated": "active",
  },
  active: {
    "subscription.renewed": "active",
    "subscription.past_due": "past_due",
    "subscription.canceled": "canceled",
    "subscription.expired": "expired",
    "payment.refunded": "refunded",
  },
  past_due: {
    "subscription.renewed": "active", // 재시도 결제 성공
    "subscription.past_due": "past_due", // 재시도 실패 반복(유예 기간 내)
    "subscription.canceled": "canceled",
    "subscription.expired": "expired", // 유예 종료
    "payment.refunded": "refunded",
  },
  canceled: {
    "subscription.activated": "active", // 해지 철회(기간 내, 같은 행)
    "subscription.expired": "expired", // cancel_at 도래
    "payment.refunded": "refunded", // 7일 내 청약철회
  },
  expired: {},
  refunded: {},
};

export class InvalidTransitionError extends PaymentError {
  readonly state: SubscriptionState;
  readonly event: SubscriptionMachineEvent;
  constructor(state: SubscriptionState, event: SubscriptionMachineEvent) {
    super(PAYMENT_ERROR_CODES.INVALID_TRANSITION, `${state} + ${event}`);
    this.name = "InvalidTransitionError";
    this.state = state;
    this.event = event;
  }
}

/**
 * 순수 전이 함수. 던지지 않고 Error 를 **반환**한다 (호출자가 로깅/무시 결정).
 */
export function transition(state: SubscriptionState, event: SubscriptionMachineEvent): SubscriptionState | InvalidTransitionError {
  const next = SUBSCRIPTION_TRANSITIONS[state]?.[event];
  return next ?? new InvalidTransitionError(state, event);
}

export function canTransition(state: SubscriptionState, event: SubscriptionMachineEvent): boolean {
  return SUBSCRIPTION_TRANSITIONS[state]?.[event] !== undefined;
}

export function isTerminalState(state: SubscriptionState): boolean {
  return (TERMINAL_STATES as ReadonlyArray<SubscriptionState>).includes(state);
}

export function isLiveState(state: SubscriptionState): boolean {
  return (LIVE_STATES as ReadonlyArray<SubscriptionState>).includes(state);
}

/** 이벤트 중 구독 상태를 바꿀 수 있는 것(어느 상태에서든 표에 1회 이상 등장) */
export const SUBSCRIPTION_AFFECTING_EVENTS: ReadonlyArray<SubscriptionMachineEvent> = PROVIDER_EVENT_TYPES.filter((ev) =>
  SUBSCRIPTION_STATES.some((s) => SUBSCRIPTION_TRANSITIONS[s][ev] !== undefined),
);
