import { describe, expect, it } from "vitest";
import { allowedSanctionLevels, canIssueSanctionLevel, canPerform, isPriorityUpgrade, maxSanctionLevel, roleSatisfies } from "./permissions";
import {
  datingFemaleRatio, funnelWithRates, likeToMatchRate, matchToFirstMessageRate, photoReview24hRate, ratio, remainingSeconds,
  reportRatePerActive, reportRatePerMatch, slaCompliance, slaComplianceAll,
} from "./metrics";
import type { DailyMetricRow, SlaRow } from "./types";

describe("권한 매트릭스 (PRD §0-47 / 05 §4.1)", () => {
  it("moderator ≤ 3, admin ≤ 6, null 은 0", () => {
    expect(maxSanctionLevel("moderator")).toBe(3);
    expect(maxSanctionLevel("admin")).toBe(6);
    expect(maxSanctionLevel(null)).toBe(0);
    expect(allowedSanctionLevels("moderator")).toEqual([1, 2, 3]);
    expect(allowedSanctionLevels("admin")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(allowedSanctionLevels(undefined)).toEqual([]);
  });
  it("moderator × 레벨", () => {
    for (const l of [0, 1, 2, 3] as const) expect(canIssueSanctionLevel("moderator", l)).toBe(true);
    for (const l of [4, 5, 6] as const) expect(canIssueSanctionLevel("moderator", l)).toBe(false);
  });
  it("admin × 레벨", () => {
    for (const l of [0, 1, 2, 3, 4, 5, 6] as const) expect(canIssueSanctionLevel("admin", l)).toBe(true);
  });
  it("비관리자는 아무것도 못 한다", () => {
    expect(canIssueSanctionLevel(null, 0)).toBe(false);
    expect(canPerform(null, "photo_review")).toBe(false);
    expect(roleSatisfies(undefined, "moderator")).toBe(false);
  });
  it("액션별 최소 역할", () => {
    expect(canPerform("moderator", "report_resolve")).toBe(true);
    expect(canPerform("moderator", "photo_review")).toBe(true);
    expect(canPerform("moderator", "sanction_lift")).toBe(false);
    expect(canPerform("moderator", "appeal_decide")).toBe(false);
    expect(canPerform("moderator", "force_logout")).toBe(false);
    expect(canPerform("moderator", "account_delete_schedule")).toBe(false);
    expect(canPerform("moderator", "audit_read")).toBe(false);
    expect(canPerform("admin", "appeal_decide")).toBe(true);
    expect(canPerform("admin", "audit_read")).toBe(true);
  });
  it("우선순위는 상향만", () => {
    expect(isPriorityUpgrade("P2", "P0")).toBe(true);
    expect(isPriorityUpgrade("P1", "P1")).toBe(false);
    expect(isPriorityUpgrade("P0", "P3")).toBe(false);
  });
});

const day = (p: Partial<DailyMetricRow>): DailyMetricRow => ({
  loop_date: "2026-09-01", active_users: 0, signups: 0, onboarding_completed: 0, reco_count: 0, reco_seen: 0, reco_acted: 0,
  likes: 0, superlikes: 0, matches: 0, first_messages: 0, messages: 0, reports: 0, sanctions: 0, sanctions_auto: 0, ...p,
});

describe("지표 계산 (0060 SQL 카운트 → KPI)", () => {
  it("ratio 는 분모 0 이면 null", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(2, 4)).toBe(0.5);
  });
  it("좋아요→매칭 / 매칭→첫 메시지 / 신고율", () => {
    const rows = [day({ likes: 50, matches: 4, first_messages: 3, reports: 1, active_users: 100 }), day({ likes: 50, matches: 4, first_messages: 2, reports: 0, active_users: 100 })];
    expect(likeToMatchRate(rows)).toBeCloseTo(0.08);
    expect(matchToFirstMessageRate(rows)).toBeCloseTo(5 / 8);
    expect(reportRatePerActive(rows)).toBeCloseTo(1 / 200);
    expect(reportRatePerMatch(rows)).toBeCloseTo(1 / 8);
    expect(reportRatePerActive([day({ reports: 3 })])).toBeNull();
  });
  it("SLA 준수율: 기한 안 지난 미종결 건은 분모 제외", () => {
    const row: SlaRow = { priority: "P0", total: 10, handled: 6, within_sla: 5, overdue_open: 2, open_in_sla: 2, avg_handle_minutes: 40 };
    expect(slaCompliance(row)).toBeCloseTo(5 / 8);
    expect(slaCompliance({ handled: 0, within_sla: 0, overdue_open: 0 })).toBeNull();
    const p3: SlaRow = { ...row, priority: "P3", within_sla: 0, handled: 0, overdue_open: 5 };
    expect(slaComplianceAll([row, p3])).toBeCloseTo(5 / 8); // P3 제외
    expect(slaComplianceAll([row, p3], ["P0", "P3"])).toBeCloseTo(5 / 13);
  });
  it("데이팅 여성 비율 (KPI 35%)", () => {
    const r = datingFemaleRatio([
      { mode: "dating", gender: "female", cnt: 35 }, { mode: "dating", gender: "male", cnt: 60 }, { mode: "dating", gender: "unspecified", cnt: 5 },
      { mode: "friend", gender: "female", cnt: 100 },
    ]);
    expect(r.total).toBe(100);
    expect(r.female).toBe(35);
    expect(r.ratio).toBeCloseTo(0.35);
    expect(datingFemaleRatio([]).ratio).toBeNull();
  });
  it("퍼널 전환율", () => {
    const f = funnelWithRates([{ ord: 2, step: "basic", label: "", cnt: 50 }, { ord: 1, step: "signup", label: "", cnt: 100 }, { ord: 3, step: "hobbies", label: "", cnt: 25 }]);
    expect(f.map((x) => x.step)).toEqual(["signup", "basic", "hobbies"]);
    expect(f[1]?.stepRate).toBe(0.5);
    expect(f[2]?.stepRate).toBe(0.5);
    expect(f[2]?.fromStart).toBe(0.25);
  });
  it("사진 24h 처리율 · SLA 남은 시간", () => {
    expect(photoReview24hRate({ reviewed: 20, within_24h: 19 })).toBeCloseTo(0.95);
    const now = new Date("2026-09-02T00:00:00Z");
    expect(remainingSeconds("2026-09-02T01:00:00Z", now)).toBe(3600);
    expect(remainingSeconds("2026-09-01T23:30:00Z", now)).toBe(-1800);
  });
});
