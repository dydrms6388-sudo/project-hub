import { describe, expect, it } from "vitest";
import { PROVIDER_EVENT_TYPES, type ProviderEventType } from "./types";
import {
  InvalidTransitionError,
  LIVE_STATES,
  SUBSCRIPTION_AFFECTING_EVENTS,
  SUBSCRIPTION_STATES,
  SUBSCRIPTION_TRANSITIONS,
  canTransition,
  isLiveState,
  isTerminalState,
  transition,
  type SubscriptionState,
} from "./state-machine";

/**
 * 전수표: 6 상태 × 9 이벤트 = 54 셀. 값이 문자열이면 다음 상태, `null` 이면 INVALID_TRANSITION.
 * 이 표가 곧 계약이다 — 바꾸려면 19_payments.md 의 mermaid 도 함께 고친다.
 */
const EXPECTED: Record<SubscriptionState, Record<ProviderEventType, SubscriptionState | null>> = {
  free: {
    "subscription.activated": "active",
    "subscription.renewed": null,
    "subscription.past_due": null,
    "subscription.canceled": null,
    "subscription.expired": null,
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": null,
    "item.granted": null,
  },
  active: {
    "subscription.activated": null,
    "subscription.renewed": "active",
    "subscription.past_due": "past_due",
    "subscription.canceled": "canceled",
    "subscription.expired": "expired",
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": "refunded",
    "item.granted": null,
  },
  past_due: {
    "subscription.activated": null,
    "subscription.renewed": "active",
    "subscription.past_due": "past_due",
    "subscription.canceled": "canceled",
    "subscription.expired": "expired",
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": "refunded",
    "item.granted": null,
  },
  canceled: {
    "subscription.activated": "active",
    "subscription.renewed": null,
    "subscription.past_due": null,
    "subscription.canceled": null,
    "subscription.expired": "expired",
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": "refunded",
    "item.granted": null,
  },
  expired: {
    "subscription.activated": null,
    "subscription.renewed": null,
    "subscription.past_due": null,
    "subscription.canceled": null,
    "subscription.expired": null,
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": null,
    "item.granted": null,
  },
  refunded: {
    "subscription.activated": null,
    "subscription.renewed": null,
    "subscription.past_due": null,
    "subscription.canceled": null,
    "subscription.expired": null,
    "payment.succeeded": null,
    "payment.failed": null,
    "payment.refunded": null,
    "item.granted": null,
  },
};

describe("subscription state machine — 전수 전이", () => {
  it("상태·이벤트 목록이 표와 일치한다", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...SUBSCRIPTION_STATES].sort());
    for (const s of SUBSCRIPTION_STATES) {
      expect(Object.keys(EXPECTED[s]).sort()).toEqual([...PROVIDER_EVENT_TYPES].sort());
    }
  });

  for (const state of SUBSCRIPTION_STATES) {
    for (const event of PROVIDER_EVENT_TYPES) {
      const expected = EXPECTED[state][event];
      it(`${state} + ${event} → ${expected ?? "INVALID_TRANSITION"}`, () => {
        const result = transition(state, event);
        if (expected === null) {
          expect(result).toBeInstanceOf(InvalidTransitionError);
          const err = result as InvalidTransitionError;
          expect(err.code).toBe("INVALID_TRANSITION");
          expect(err.message).toBe(`INVALID_TRANSITION: ${state} + ${event}`);
          expect(err.state).toBe(state);
          expect(err.event).toBe(event);
          expect(canTransition(state, event)).toBe(false);
        } else {
          expect(result).toBe(expected);
          expect(canTransition(state, event)).toBe(true);
        }
      });
    }
  }
});

describe("불변식", () => {
  it("canceled 는 절대 renewed 되지 않는다 (A4: 해지 = 갱신 중단)", () => {
    expect(transition("canceled", "subscription.renewed")).toBeInstanceOf(InvalidTransitionError);
  });

  it("종단 상태(expired/refunded)는 어떤 이벤트도 받지 않는다", () => {
    for (const s of ["expired", "refunded"] as const) {
      expect(isTerminalState(s)).toBe(true);
      for (const ev of PROVIDER_EVENT_TYPES) expect(canTransition(s, ev)).toBe(false);
      expect(Object.keys(SUBSCRIPTION_TRANSITIONS[s])).toHaveLength(0);
    }
  });

  it("free 로 들어오는 전이는 없다 (free = 행 없음, 재구독은 새 행)", () => {
    for (const s of SUBSCRIPTION_STATES) {
      for (const ev of PROVIDER_EVENT_TYPES) expect(SUBSCRIPTION_TRANSITIONS[s][ev]).not.toBe("free");
    }
  });

  it("refunded 는 살아있는 상태(active/past_due/canceled)에서만 도달한다", () => {
    for (const s of SUBSCRIPTION_STATES) {
      const reaches = PROVIDER_EVENT_TYPES.some((ev) => SUBSCRIPTION_TRANSITIONS[s][ev] === "refunded");
      expect(reaches).toBe(isLiveState(s));
    }
  });

  it("LIVE_STATES 는 SQL 부분 유니크 인덱스·get_effective_tier 와 동일한 3개", () => {
    expect([...LIVE_STATES]).toEqual(["active", "past_due", "canceled"]);
  });

  it("payment.succeeded / payment.failed / item.granted 는 구독 상태를 바꾸지 않는다", () => {
    expect(SUBSCRIPTION_AFFECTING_EVENTS).not.toContain("payment.succeeded");
    expect(SUBSCRIPTION_AFFECTING_EVENTS).not.toContain("payment.failed");
    expect(SUBSCRIPTION_AFFECTING_EVENTS).not.toContain("item.granted");
    expect(SUBSCRIPTION_AFFECTING_EVENTS).toContain("payment.refunded");
  });

  it("정상 시나리오: free → active → past_due → active → canceled → expired", () => {
    const path: ProviderEventType[] = [
      "subscription.activated",
      "subscription.past_due",
      "subscription.renewed",
      "subscription.canceled",
      "subscription.expired",
    ];
    let s: SubscriptionState = "free";
    for (const ev of path) {
      const next = transition(s, ev);
      expect(next).not.toBeInstanceOf(Error);
      s = next as SubscriptionState;
    }
    expect(s).toBe("expired");
  });
});
