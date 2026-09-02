import { describe, expect, it } from "vitest";
import { ENTITLEMENTS } from "@duckmate/db";
import { ENTITLEMENT_CHECKPOINTS, assertEntitled, getEntitlements, isEntitled } from "./entitlements";
import { PaymentError } from "./errors";

describe("entitlements", () => {
  it("getEntitlements 는 db 상수를 그대로 반환하고 null 은 free", () => {
    expect(getEntitlements(null)).toBe(ENTITLEMENTS.free);
    expect(getEntitlements("pro")).toBe(ENTITLEMENTS.pro);
  });

  it("boolean 키: free 는 undo 불가, plus 는 가능", () => {
    expect(isEntitled("undo", { tier: "free" })).toBe(false);
    expect(isEntitled("undo", { tier: "plus" })).toBe(true);
    expect(() => assertEntitled("undo", { tier: null })).toThrow(/^NOT_ENTITLED: undo/);
  });

  it("수치 키: used < limit, -1 은 무제한", () => {
    expect(isEntitled("daily_reco_limit", { tier: "free", used: 4 })).toBe(true);
    expect(isEntitled("daily_reco_limit", { tier: "free", used: 5 })).toBe(false);
    expect(isEntitled("battle_detail_top", { tier: "pro", used: 999 })).toBe(true);
    try {
      assertEntitled("daily_card_limit", { tier: "free", used: 1 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PaymentError);
      expect((e as PaymentError).code).toBe("LIMIT_REACHED");
      expect((e as PaymentError).httpStatus).toBe(403);
    }
    expect(() => assertEntitled("weekly_superlike_quota", { tier: "free", used: 1 })).toThrow(/^NO_SUPERLIKE/);
    expect(() => assertEntitled("event_priority", { tier: "plus" })).toThrow(/^PRIORITY_WINDOW/);
  });

  it("see_likers 는 full 만 통과", () => {
    expect(isEntitled("see_likers", { tier: "free" })).toBe(false);
    expect(isEntitled("see_likers", { tier: "plus" })).toBe(true);
  });

  it("체크 포인트는 A4 §2.3 의 8곳", () => {
    expect(ENTITLEMENT_CHECKPOINTS.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
