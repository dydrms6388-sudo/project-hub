import { describe, expect, it } from "vitest";
import { REPORT_REASONS, REPORT_REASON_CODES } from "@duckmate/db";
import { REPORT_CATEGORIES, categoryOf, reasonMeta } from "@/lib/moderation/constants";
import { afterReportHref, parseReportParams } from "./params";

const T = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";

describe("신고 카테고리 5 → 세부 14 매핑 (화면 순서 고정)", () => {
  it("14 코드가 카테고리 5개에 정확히 한 번씩, REPORT_REASONS.category 와 일치", () => {
    const all = REPORT_CATEGORIES.flatMap((c) => c.codes);
    expect(all.length).toBe(14);
    expect(new Set(all).size).toBe(14);
    expect([...all].sort()).toEqual([...REPORT_REASON_CODES].sort());
    for (const r of REPORT_REASONS) expect(categoryOf(r.code), r.code).toBe(r.category);
  });

  it("1단 순서 = C3 §7.2 (안전·성적혐오·프로필·외부유도·기타), OTHER 만 상세 필수", () => {
    expect(REPORT_CATEGORIES.map((c) => c.key)).toEqual(["safety", "sexual_hate", "profile", "lure_commercial", "other"]);
    expect(REPORT_CATEGORIES[0]!.codes).toEqual(["ROMANCE_SCAM", "THREAT_VIOLENCE", "STALKING", "MINOR_SUSPECT"]);
    expect(reasonMeta("OTHER").requiresDetail).toBe(true);
    expect(REPORT_REASON_CODES.filter((c) => reasonMeta(c).requiresDetail)).toEqual(["OTHER"]);
  });
});

describe("/report 파라미터", () => {
  it("uuid 검증 · surface 추론 · 사유 프리셀렉트", () => {
    expect(parseReportParams({ target: T, match: M })).toEqual({ targetId: T, matchId: M, surface: "chat", presetReason: null });
    expect(parseReportParams({ target: T })).toEqual({ targetId: T, matchId: null, surface: "profile", presetReason: null });
    expect(parseReportParams({ target: "not-a-uuid", match: "x", reason: "ROMANCE_SCAM" })).toEqual({ targetId: null, matchId: null, surface: "profile", presetReason: "ROMANCE_SCAM" });
    expect(parseReportParams({ target: T, surface: "profile", match: M, reason: "NOPE" }).surface).toBe("profile");
  });
  it("완료 후 이동", () => {
    expect(afterReportHref("chat")).toBe("/chat");
    expect(afterReportHref("profile")).toBe("/reco");
  });
});
