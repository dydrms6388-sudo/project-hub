import { describe, expect, it } from "vitest";
import { ageBandOf, isAdultKst, partsToIso, validateBirthDate } from "./age";
import { formatKrPhone } from "./phone-format";
import { QUIZ_FALLBACK } from "./quiz";
import { consentsComplete, toConsentPayload } from "./consents";

describe("age helpers", () => {
  const now = new Date("2026-09-01T16:00:00Z"); // 2026-09-02 01:00 KST
  it("partsToIso pads month/day", () => {
    expect(partsToIso({ year: "1998", month: "3", day: "7" })).toBe("1998-03-07");
  });
  it("validates existence/future", () => {
    expect(validateBirthDate("1998-02-30")).toBe("날짜를 다시 확인해 주세요");
    expect(validateBirthDate("2099-01-01")).toBe("날짜를 다시 확인해 주세요");
    expect(validateBirthDate("1998-03-07")).toBeNull();
  });
  it("만 19세 boundary at KST", () => {
    expect(isAdultKst("2007-09-02", now)).toBe(true);
    expect(isAdultKst("2007-09-03", now)).toBe(false);
  });
  it("age band hides the raw date", () => {
    expect(ageBandOf("1998-03-07", now)).toBe("20대 후반");
    expect(ageBandOf("2003-01-01", now)).toBe("20대 초반");
    expect(ageBandOf("1995-01-01", now)).toBe("30대 초반");
    expect(ageBandOf(null)).toBe("");
  });
});

describe("phone format / consents / quiz", () => {
  it("formats 010 numbers", () => {
    expect(formatKrPhone("01012345678")).toBe("010-1234-5678");
    expect(formatKrPhone("0101234")).toBe("010-1234");
  });
  it("consents: 3 required, evidence bundled with terms", () => {
    expect(consentsComplete({ terms: true, privacy: true, youthPolicy: false, marketingPush: false })).toBe(false);
    expect(toConsentPayload({ terms: true, privacy: true, youthPolicy: true, marketingPush: false })).toEqual({ terms: true, privacy: true, youthPolicy: true, evidenceSnapshot: true, marketingPush: false });
  });
  it("quiz fallback: 10 questions, ≤30 chars, 2~4 options", () => {
    expect(QUIZ_FALLBACK).toHaveLength(10);
    for (const q of QUIZ_FALLBACK) {
      expect(q.text.length).toBeLessThanOrEqual(30);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
    }
  });
});
