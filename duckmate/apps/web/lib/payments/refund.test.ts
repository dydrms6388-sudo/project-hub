import { describe, expect, it } from "vitest";
import { PaymentError } from "./errors";
import { FULL_REFUND_REASONS, computeRefund, daysInKstMonth, usedDaysBetween } from "./refund";

const KST = (s: string) => new Date(`${s}+09:00`);

describe("computeRefund — refund-policy.md §4 예시 3건 (고정)", () => {
  it("예시 1: 플러스 ₩9,900, 9/1 결제 → 9/3 요청 = ₩8,910", () => {
    const r = computeRefund({ kind: "subscription", price: 9900, purchasedAt: KST("2026-09-01T10:00:00"), now: KST("2026-09-03T09:00:00") });
    expect(r.snapshot.usedDays).toBe(3);
    expect(r.snapshot.daysInMonth).toBe(30);
    expect(r.deductionKrw).toBe(990);
    expect(r.refundKrw).toBe(8910);
    expect(r.eligible).toBe(true);
    expect(r.outcome).toBe("formula");
  });

  it("예시 2: 슈퍼라이크 5개 ₩4,900 중 2개 사용, 5일째 = ₩2,940", () => {
    const r = computeRefund({ kind: "item", price: 4900, qty: 5, usedQty: 2, purchasedAt: KST("2026-09-01T12:00:00"), now: KST("2026-09-05T12:00:00") });
    expect(r.snapshot.unitPrice).toBe(980);
    expect(r.deductionKrw).toBe(1960);
    expect(r.refundKrw).toBe(2940);
    expect(r.snapshot.reclaimableQty).toBe(3);
    expect(r.eligible).toBe(true);
  });

  it("예시 3: 부스트 ₩3,900 발동 40분 경과, 당일 요청 = ₩0 / service_fault 면 ₩3,900", () => {
    const base = { kind: "boost" as const, price: 3900, usedQty: 1, purchasedAt: KST("2026-09-01T12:00:00"), now: KST("2026-09-01T12:40:00") };
    const r = computeRefund(base);
    expect(r.refundKrw).toBe(0);
    expect(r.deductionKrw).toBe(3900);
    expect(r.eligible).toBe(false);
    expect(r.outcome).toBe("consumed");

    const fault = computeRefund({ ...base, reasonCode: "service_fault" });
    expect(fault.refundKrw).toBe(3900);
    expect(fault.deductionKrw).toBe(0);
    expect(fault.outcome).toBe("full_by_reason");
  });
});

describe("구독", () => {
  it("결제 당일 요청도 1일 사용", () => {
    const r = computeRefund({ kind: "subscription", price: 9900, purchasedAt: KST("2026-09-01T00:10:00"), now: KST("2026-09-01T23:50:00") });
    expect(r.snapshot.usedDays).toBe(1);
    expect(r.refundKrw).toBe(9900 - 330);
  });

  it("7일째(=168h 이내)는 공식, 7일 초과는 불가", () => {
    const at = KST("2026-09-01T10:00:00");
    const ok = computeRefund({ kind: "subscription", price: 9900, purchasedAt: at, now: KST("2026-09-08T10:00:00") });
    expect(ok.outcome).toBe("formula");
    expect(ok.snapshot.usedDays).toBe(8);
    const over = computeRefund({ kind: "subscription", price: 9900, purchasedAt: at, now: KST("2026-09-08T10:00:01") });
    expect(over.outcome).toBe("window_expired");
    expect(over.refundKrw).toBe(0);
    expect(over.deductionKrw).toBe(9900);
    expect(over.eligible).toBe(false);
  });

  it("달 일수는 결제일(KST) 기준: 2월 28일, 10월 31일", () => {
    expect(daysInKstMonth(KST("2026-02-10T00:00:00"))).toBe(28);
    expect(daysInKstMonth(KST("2026-10-31T23:59:59"))).toBe(31);
    // UTC 로는 9/30 15:30 이지만 KST 는 10/1 → 31일
    expect(daysInKstMonth(new Date("2026-09-30T15:30:00Z"))).toBe(31);
    const r = computeRefund({ kind: "subscription", price: 19900, purchasedAt: KST("2026-10-01T09:00:00"), now: KST("2026-10-02T09:00:00") });
    expect(r.snapshot.daysInMonth).toBe(31);
    expect(r.deductionKrw).toBe(Math.round((19900 * 2) / 31)); // 1284
    expect(r.refundKrw).toBe(19900 - 1284);
  });

  it("usedDays/daysInMonth 명시값이 자동 계산보다 우선 (SQL 대조용)", () => {
    const r = computeRefund({ kind: "subscription", price: 9900, usedDays: 3, daysInMonth: 30, purchasedAt: KST("2026-09-01T10:00:00"), now: KST("2026-09-01T10:00:00") });
    expect(r.refundKrw).toBe(8910);
  });

  it("KST 달력일 경계: 자정 직전 결제 → 직후 요청 = 2일", () => {
    expect(usedDaysBetween(KST("2026-09-01T23:59:00"), KST("2026-09-02T00:01:00"))).toBe(2);
  });
});

describe("소모성 아이템", () => {
  it("미사용 전량은 전액, 전량 사용은 0", () => {
    const at = KST("2026-09-01T12:00:00");
    const none = computeRefund({ kind: "item", price: 4900, qty: 5, usedQty: 0, purchasedAt: at, now: at });
    expect(none.refundKrw).toBe(4900);
    const all = computeRefund({ kind: "item", price: 4900, qty: 5, usedQty: 5, purchasedAt: at, now: at });
    expect(all.refundKrw).toBe(0);
    expect(all.outcome).toBe("consumed");
  });

  it("잔액이 미사용분보다 적으면 단가 × 회수 가능 수량", () => {
    const at = KST("2026-09-01T12:00:00");
    const r = computeRefund({ kind: "item", price: 4900, qty: 5, usedQty: 2, reclaimableQty: 1, purchasedAt: at, now: at });
    expect(r.refundKrw).toBe(980);
    expect(r.deductionKrw).toBe(3920);
  });

  it("7일 경과 아이템은 불가", () => {
    const r = computeRefund({ kind: "item", price: 1900, qty: 3, usedQty: 0, purchasedAt: KST("2026-09-01T12:00:00"), now: KST("2026-09-09T12:00:00") });
    expect(r.outcome).toBe("window_expired");
    expect(r.refundKrw).toBe(0);
  });

  it("반올림: 되돌리기 3회권 ₩1,900 중 1회 사용 → 단가 633.33 → 차감 633 → 환불 1,267", () => {
    const at = KST("2026-09-01T12:00:00");
    const r = computeRefund({ kind: "item", price: 1900, qty: 3, usedQty: 1, purchasedAt: at, now: at });
    expect(r.deductionKrw).toBe(633);
    expect(r.refundKrw).toBe(1267);
  });
});

describe("부스트 · 카드 리필", () => {
  it("부스트 미발동은 7일 내 전액", () => {
    const r = computeRefund({ kind: "boost", price: 3900, usedQty: 0, purchasedAt: KST("2026-09-01T12:00:00"), now: KST("2026-09-04T12:00:00") });
    expect(r.refundKrw).toBe(3900);
  });

  it("카드 리필: 미사용 + 당일(loop_date) 전액, 07:00 경계 넘으면 불가, 1장 사용 시 불가", () => {
    const at = KST("2026-09-01T20:00:00");
    expect(computeRefund({ kind: "card_refill", price: 1500, qty: 3, usedQty: 0, purchasedAt: at, now: KST("2026-09-02T06:59:00") }).refundKrw).toBe(1500);
    const next = computeRefund({ kind: "card_refill", price: 1500, qty: 3, usedQty: 0, purchasedAt: at, now: KST("2026-09-02T07:00:00") });
    expect(next.outcome).toBe("not_same_day");
    expect(next.refundKrw).toBe(0);
    const used = computeRefund({ kind: "card_refill", price: 1500, qty: 3, usedQty: 1, purchasedAt: at, now: at });
    expect(used.outcome).toBe("consumed");
  });
});

describe("예외 사유·스냅샷·검증", () => {
  it.each(FULL_REFUND_REASONS)("%s 는 7일 경과·사용 여부 무관 전액", (reason) => {
    const r = computeRefund({ kind: "subscription", price: 9900, reasonCode: reason, purchasedAt: KST("2026-08-01T10:00:00"), now: KST("2026-09-01T10:00:00") });
    expect(r.refundKrw).toBe(9900);
    expect(r.deductionKrw).toBe(0);
    expect(r.outcome).toBe("full_by_reason");
  });

  it("change_of_mind / other 는 공식 적용", () => {
    const r = computeRefund({ kind: "subscription", price: 9900, reasonCode: "other", purchasedAt: KST("2026-09-01T10:00:00"), now: KST("2026-09-03T10:00:00") });
    expect(r.refundKrw).toBe(8910);
  });

  it("스냅샷은 formula_snapshot 에 그대로 저장 가능한 값만 담는다", () => {
    const r = computeRefund({ kind: "subscription", price: 9900, purchasedAt: "2026-09-01T01:00:00.000Z", now: "2026-09-03T00:00:00.000Z" });
    expect(r.snapshot).toMatchObject({
      version: 1,
      kind: "subscription",
      reasonCode: "change_of_mind",
      price: 9900,
      purchasedAt: "2026-09-01T01:00:00.000Z",
      requestedAt: "2026-09-03T00:00:00.000Z",
      withinWindow: true,
      usedDays: 3,
      daysInMonth: 30,
      deductionKrw: 990,
      refundKrw: 8910,
      outcome: "formula",
    });
    expect(JSON.parse(JSON.stringify(r.snapshot))).toEqual(r.snapshot);
  });

  it("잘못된 입력은 INVALID_INPUT", () => {
    const at = KST("2026-09-01T12:00:00");
    expect(() => computeRefund({ kind: "item", price: 4900, qty: 5, usedQty: 6, purchasedAt: at, now: at })).toThrowError(PaymentError);
    expect(() => computeRefund({ kind: "subscription", price: -1, purchasedAt: at, now: at })).toThrow(/INVALID_INPUT/);
    expect(() => computeRefund({ kind: "subscription", price: 9900, purchasedAt: at, now: KST("2026-08-31T12:00:00") })).toThrow(/INVALID_INPUT/);
    expect(() => computeRefund({ kind: "subscription", price: 9900, purchasedAt: "nope", now: at })).toThrow(/INVALID_INPUT/);
  });
});
