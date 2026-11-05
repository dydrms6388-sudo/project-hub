import { describe, expect, it } from "vitest";
import { REPORT_REASONS, REPORT_REASON_CODES, SANCTION_LEVELS } from "@duckmate/db";
import { MODERATION_RULES, REPORT_CATEGORIES, SANCTION_COPY, SCAM_SIGNAL_WEIGHTS, categoryOf, reasonMeta, slaCopyFor } from "./constants";
import { computeScamScore, massLikeSignal, offAppSignal } from "./scam-score";

describe("REPORT_CATEGORIES ↔ 14 reason codes", () => {
  it("covers every reason code exactly once", () => {
    const all = REPORT_CATEGORIES.flatMap((c) => c.codes);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...REPORT_REASON_CODES].sort());
    expect(all.length).toBe(14);
  });
  it("has 5 categories in C3 §7.2 order", () => {
    expect(REPORT_CATEGORIES.map((c) => c.key)).toEqual(["safety", "sexual_hate", "profile", "lure_commercial", "other"]);
  });
  it("category field of REPORT_REASONS agrees with the 2-step mapping", () => {
    for (const r of REPORT_REASONS) expect(categoryOf(r.code)).toBe(r.category);
  });
  it("OTHER requires detail", () => {
    expect(reasonMeta("OTHER").requiresDetail).toBe(true);
    expect(reasonMeta("ROMANCE_SCAM").requiresDetail).toBe(false);
    expect(reasonMeta("ROMANCE_SCAM").label).toBe("사기·로맨스 스캠");
  });
});

describe("copy & rules", () => {
  it("public SLA promise is 24h for P0~P2, P3 gets receipt notice", () => {
    expect(slaCopyFor("P0")).toContain("24시간");
    expect(slaCopyFor("P2")).toContain("24시간");
    expect(slaCopyFor("P3")).toContain("24시간");
  });
  it("sanction copy exists for all 6 levels and matches auto/manual policy", () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) expect(SANCTION_COPY[level].title({ categoryLabel: "x", days: 3, endsAt: null })).toBeTruthy();
    expect(SANCTION_COPY[1].kind).toBe("modal");
    expect(SANCTION_COPY[2].kind).toBe("banner");
    expect(SANCTION_COPY[6].kind).toBe("permanent");
    expect(SANCTION_LEVELS[MODERATION_RULES.maxAutoSanctionLevel].auto).toBe(true);
    expect(SANCTION_LEVELS[3].auto).toBe(false);
  });
  it("legal-doc figures (08_legal_docs §0-15) match constants", () => {
    expect(MODERATION_RULES.appealWindowDays).toBe(7);
    expect(MODERATION_RULES.appealDecisionHours).toBe(72);
    expect(MODERATION_RULES.evidenceRetentionDays).toEqual({ dismissed: 90, confirmed: 180, permanentBan: 1825, legalHoldRelease: 90 });
    expect(MODERATION_RULES.deleteGraceDays).toBe(7);
    expect(MODERATION_RULES.cumulativeReporters30d).toBe(3);
  });
});

describe("scam score mirror (A5 §7.3)", () => {
  it("weights match the policy table", () => {
    expect(SCAM_SIGNAL_WEIGHTS).toEqual({ SC_MONEY: 3, SC_INVEST: 3, SC_URGENT: 2, SC_OFFAPP: 2, SC_MASS_LIKE: 2, SC_FAST_LOVE: 1, SC_TEMPLATE: 3 });
  });
  it("SC_MONEY + SC_INVEST = 6 → banner; + SC_URGENT = 8 → restrict", () => {
    const r1 = computeScamScore([{ ruleId: "SC_MONEY", count: 1 }, { ruleId: "SC_INVEST", count: 1 }]);
    expect(r1.score).toBe(6);
    expect(r1.level).toBe("banner");
    const r2 = computeScamScore([{ ruleId: "SC_MONEY", count: 1 }, { ruleId: "SC_INVEST", count: 1 }, { ruleId: "SC_URGENT", count: 1 }]);
    expect(r2.score).toBe(8);
    expect(r2.level).toBe("restrict");
  });
  it("ignores non-SC rules and warn_only rules; explicit score wins", () => {
    const r = computeScamScore([{ ruleId: "CT_PHONE", count: 5 }, { ruleId: "SC_URGENT", count: 1 }, { ruleId: "SC_MONEY", count: 2, score: 4 }], ["SC_URGENT"]);
    expect(r.signals.map((s) => s.rule_id)).toEqual(["SC_MONEY"]);
    expect(r.score).toBe(4);
    expect(r.level).toBe("none");
  });
  it("derived signals", () => {
    expect(massLikeSignal(29)).toBeNull();
    expect(massLikeSignal(30)?.ruleId).toBe("SC_MASS_LIKE");
    expect(offAppSignal(0)).toBeNull();
    expect(computeScamScore([offAppSignal(2)!]).score).toBe(4);
  });
});
