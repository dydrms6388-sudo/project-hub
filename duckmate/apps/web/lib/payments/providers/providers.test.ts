import { describe, expect, it } from "vitest";
import { DisabledPaymentProvider, getPaymentProvider, isPaymentsEnabled } from "./index";

describe("getPaymentProvider", () => {
  it("PAYMENTS_ENABLED 미설정/false 면 disabled provider", () => {
    expect(getPaymentProvider({ env: {} }).id).toBe("disabled");
    expect(getPaymentProvider({ env: { PAYMENTS_ENABLED: "false" } }).id).toBe("disabled");
    expect(getPaymentProvider({ env: { PAYMENTS_ENABLED: "TRUE" } }).id).toBe("disabled");
    expect(isPaymentsEnabled({ env: { PAYMENTS_ENABLED: "true" }, companyInfoComplete: false })).toBe(false);
  });

  it("활성 시 웹은 toss, 앱은 apple/google — 단 Phase 1 은 전부 stub 이라 호출은 실패", async () => {
    expect(getPaymentProvider({ env: { PAYMENTS_ENABLED: "true" } }).id).toBe("toss");
    expect(getPaymentProvider({ env: { PAYMENTS_ENABLED: "true" }, native: true }).id).toBe("google");
  });

  it("모든 stub 메서드는 'PAYMENTS_DISABLED: Phase 3' 를 던진다", async () => {
    const providers = [new DisabledPaymentProvider(), getPaymentProvider({ env: { PAYMENTS_ENABLED: "true" } }), getPaymentProvider({ env: { PAYMENTS_ENABLED: "true" }, native: true })];
    for (const p of providers) {
      await expect(p.createCheckout("plus_monthly", "u")).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      await expect(p.verifyWebhook("{}", null)).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      await expect(p.cancelSubscription("s", "period_end")).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      await expect(p.refund("p", 100, "change_of_mind")).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      await expect(p.getDisplayPrice("plus_monthly")).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      await expect(p.manageSubscriptionUrl("u")).rejects.toThrow("PAYMENTS_DISABLED: Phase 3");
      expect(() => p.refundPath("p")).toThrow("PAYMENTS_DISABLED: Phase 3");
    }
  });
});
