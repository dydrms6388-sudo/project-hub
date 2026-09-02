import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORE_PARAMS,
  availabilityOverlap,
  hobbyScore,
  isIntroWelcome,
  mutualSignal,
  quizCosine,
  scoreBucket,
  scorePair,
  scorePercent,
  type HobbyFeature,
  type ProfileFeatures,
  type QuizFeature,
} from "./score";

const NOW = new Date("2026-09-02T09:00:00+09:00");
const h = (hobbyId: number, categoryId: number, rank: number, intensity: number): HobbyFeature => ({ hobbyId, categoryId, rank, intensity });
const q = (questionId: number, choice: number, weight = 1): QuizFeature => ({ questionId, choice, weight });
const base = (patch: Partial<ProfileFeatures> = {}): ProfileFeatures => ({
  hobbies: [],
  quiz: [],
  slots: [],
  lastActiveAt: NOW,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  complete: false,
  ...patch,
});

describe("hobbyScore (2단 자카드)", () => {
  it("완전 동일 Top3 → 1", () => {
    const a = [h(1, 1, 1, 3), h(2, 1, 2, 3), h(3, 2, 3, 3)];
    expect(hobbyScore(a, a).hobby).toBeCloseTo(1, 6);
  });
  it("Top3 는 가중 2배: rank1 겹침이 rank4 겹침보다 크다", () => {
    const a = [h(1, 1, 1, 3), h(2, 1, 2, 3), h(3, 2, 3, 3), h(4, 3, 4, 3)];
    const topMatch = [h(1, 1, 1, 3), h(9, 9, 2, 3), h(8, 8, 3, 3)];
    const lowMatch = [h(4, 3, 1, 3), h(9, 9, 2, 3), h(8, 8, 3, 3)];
    // 태그: top 2/(2+2+2+1+2+2)=2/11, low: hobby4 는 a 에서 w=1, b 에서 w=2 → min 1 / union 12
    expect(hobbyScore(a, topMatch).tagJaccard).toBeCloseTo(2 / 11, 6);
    expect(hobbyScore(a, lowMatch).tagJaccard).toBeCloseTo(1 / 12, 6);
  });
  it("intensity 차이 ≥3 이면 해당 태그 기여 ×0.5 (경계: 2 는 페널티 없음)", () => {
    const a = [h(1, 1, 1, 5)];
    expect(hobbyScore(a, [h(1, 1, 1, 2)]).tagJaccard).toBeCloseTo(0.5, 6);
    expect(hobbyScore(a, [h(1, 1, 1, 3)]).tagJaccard).toBeCloseTo(1, 6);
    expect(hobbyScore(a, [h(1, 1, 1, 2)], 4).tagJaccard).toBeCloseTo(1, 6);
  });
  it("세부 태그 미겹침 + 카테고리 일치 → 카테고리 항만 (F-069)", () => {
    const r = hobbyScore([h(1, 5, 1, 3)], [h(2, 5, 1, 3)]);
    expect(r.tagJaccard).toBe(0);
    expect(r.categoryJaccard).toBe(1);
    expect(r.hobby).toBeCloseTo(0.3, 6);
  });
  it("양쪽 빈 취미 → 0", () => {
    expect(hobbyScore([], []).hobby).toBe(0);
  });
});

describe("quizCosine", () => {
  it("3문항 미만이면 0.5 중립 (PRD §0-10)", () => {
    expect(quizCosine([q(1, 1), q(2, 1)], [q(1, 1), q(2, 1), q(3, 1)])).toBe(0.5);
    expect(quizCosine([], [])).toBe(0.5);
  });
  it("동일 답 → 1, 전부 다름 → 0", () => {
    const a = [q(1, 1), q(2, 2), q(3, 3)];
    expect(quizCosine(a, a)).toBeCloseTo(1, 6);
    expect(quizCosine(a, [q(1, 2), q(2, 3), q(3, 4)])).toBe(0);
  });
  it("문항 weight 반영 (weight² 합)", () => {
    const a = [q(1, 1, 1.2), q(2, 1, 1), q(3, 1, 0.8)];
    const b = [q(1, 1, 1.2), q(2, 2, 1), q(3, 2, 0.8)];
    const na = 1.44 + 1 + 0.64;
    expect(quizCosine(a, b)).toBeCloseTo(1.44 / Math.sqrt(na * na), 6);
  });
  it("답한 문항이 다르면 교집합만 dot, 노름은 각자", () => {
    const a = [q(1, 1), q(2, 1), q(3, 1)];
    const b = [q(1, 1), q(4, 1), q(5, 1)];
    expect(quizCosine(a, b)).toBeCloseTo(1 / 3, 6);
  });
});

describe("availabilityOverlap", () => {
  it("(weekday, slot) 자카드", () => {
    const a = [{ weekday: 6, slot: "afternoon" as const }, { weekday: 3, slot: "evening" as const }];
    const b = [{ weekday: 6, slot: "afternoon" as const }, { weekday: 7, slot: "morning" as const }];
    expect(availabilityOverlap(a, b)).toBeCloseTo(1 / 3, 6);
    expect(availabilityOverlap([], b)).toBe(0);
    expect(availabilityOverlap(a, a)).toBe(1);
  });
});

describe("mutualSignal", () => {
  it("나를 좋아함 = 1, 48h 활동 = 0.3, 그 외 0 (경계 48h)", () => {
    expect(mutualSignal(true, new Date(NOW.getTime() - 30 * 86_400_000), NOW)).toBe(1);
    expect(mutualSignal(false, new Date(NOW.getTime() - 48 * 3_600_000), NOW)).toBe(0.3);
    expect(mutualSignal(false, new Date(NOW.getTime() - 48 * 3_600_000 - 1), NOW)).toBe(0);
  });
});

describe("scorePair (가중합 + 보정)", () => {
  const A = base({
    hobbies: [h(11, 3, 1, 5), h(36, 8, 2, 3), h(1, 1, 3, 2)],
    quiz: Array.from({ length: 10 }, (_, i) => q(i + 1, ((i + 4) % 4) + 1)),
    slots: [
      { weekday: 6, slot: "morning" },
      { weekday: 7, slot: "morning" },
      { weekday: 3, slot: "evening" },
    ],
  });
  // 로컬 PG 검증(16_matching §6 T1)과 동일 입력: 지우 → 민재
  const B = base({
    hobbies: [h(11, 3, 1, 4), h(6, 2, 2, 4), h(26, 6, 3, 3), h(36, 8, 4, 2)],
    quiz: Array.from({ length: 10 }, (_, i) => q(i + 1, ((i + 4) % 4) + 1)),
    slots: [
      { weekday: 6, slot: "morning" },
      { weekday: 7, slot: "morning" },
      { weekday: 6, slot: "afternoon" },
    ],
    createdAt: new Date(NOW.getTime() - 3_600_000),
    complete: true,
  });

  it("SQL pair_features 와 동일 값 (hobby .33 quiz 1 avail .5 mutual .3 base .587 → .617 / .667)", () => {
    const s = scorePair(A, B, { liker: false, now: NOW });
    expect(s.tagJaccard).toBe(0.3);
    expect(s.categoryJaccard).toBe(0.4);
    expect(s.hobby).toBe(0.33);
    expect(s.quiz).toBe(1);
    expect(s.avail).toBe(0.5);
    expect(s.mutual).toBe(0.3);
    expect(s.base).toBe(0.587);
    expect(s.activeBonus).toBe(0.03);
    expect(s.newEligible).toBe(true);
    expect(s.scoreNoNew).toBe(0.617);
    expect(s.scoreWithNew).toBe(0.667);
  });
  it("나를 좋아함: mutual 만점 + 보정 +0.10", () => {
    const s = scorePair(A, B, { liker: true, now: NOW });
    expect(s.mutual).toBe(1);
    expect(s.scoreNoNew).toBeCloseTo(0.4 * 0.33 + 0.35 * 1 + 0.15 * 0.5 + 0.1 * 1 + 0.03 + 0.1, 4);
  });
  it("7일 이상 미활동 −0.10, 48h~7d 는 보정 없음", () => {
    const stale = { ...B, lastActiveAt: new Date(NOW.getTime() - 8 * 86_400_000) };
    const mid = { ...B, lastActiveAt: new Date(NOW.getTime() - 3 * 86_400_000) };
    expect(scorePair(A, stale, { liker: false, now: NOW }).inactivePenalty).toBe(0.1);
    const m = scorePair(A, mid, { liker: false, now: NOW });
    expect(m.activeBonus).toBe(0);
    expect(m.inactivePenalty).toBe(0);
    expect(m.mutual).toBe(0);
  });
  it("신규 72h 는 완성 프로필만 (경계 72h)", () => {
    const incomplete = { ...B, complete: false };
    expect(scorePair(A, incomplete, { liker: false, now: NOW }).newEligible).toBe(false);
    const old = { ...B, createdAt: new Date(NOW.getTime() - 72 * 3_600_000 - 1) };
    expect(scorePair(A, old, { liker: false, now: NOW }).newEligible).toBe(false);
    const edge = { ...B, createdAt: new Date(NOW.getTime() - 72 * 3_600_000) };
    expect(scorePair(A, edge, { liker: false, now: NOW }).newEligible).toBe(true);
  });
  it("부스트 +0.15, 상한 1.0 clamp", () => {
    const s = scorePair(B, B, { liker: true, boosted: true, now: NOW });
    expect(s.boost).toBe(DEFAULT_SCORE_PARAMS.boostBonus);
    expect(s.scoreWithNew).toBe(1);
    expect(s.scoreNoNew).toBeLessThanOrEqual(1);
  });
  it("하한 0 clamp (빈 프로필 + 미활동)", () => {
    const empty = base({ lastActiveAt: new Date(NOW.getTime() - 30 * 86_400_000) });
    const s = scorePair(base(), empty, { liker: false, now: NOW });
    expect(s.base).toBeCloseTo(0.35 * 0.5, 4);
    expect(s.scoreNoNew).toBe(0.075);
    const s2 = scorePair(base({ quiz: [q(1, 1), q(2, 1), q(3, 1)] }), { ...empty, quiz: [q(1, 2), q(2, 2), q(3, 2)] }, { liker: false, now: NOW });
    expect(s2.scoreNoNew).toBe(0);
  });
});

describe("표시 헬퍼", () => {
  it("scorePercent / scoreBucket / isIntroWelcome", () => {
    expect(scorePercent(0.617)).toBe(62);
    expect(scoreBucket(0.19)).toBe("b0");
    expect(scoreBucket(0.8)).toBe("b4");
    expect(isIntroWelcome([{ rank: 1, intensity: 2 }, { rank: 2, intensity: 5 }])).toBe(true);
    expect(isIntroWelcome([{ rank: 4, intensity: 1 }, { rank: 1, intensity: 3 }])).toBe(false);
  });
});
