import { describe, expect, it } from 'vitest';
import { allocateCuts, goalPlan, maxCutCapacity, type CategorySpending } from '../src/index.js';

const SPENDING: CategorySpending[] = [
  { category: 'food.dining', name: '외식', current: 420_000, isFixed: false },
  { category: 'shopping.online', name: '쇼핑', current: 310_000, isFixed: false },
  { category: 'food.cafe', name: '카페', current: 120_000, isFixed: false },
  { category: 'home.rent', name: '월세', current: 700_000, isFixed: true },
  { category: 'home.telecom', name: '통신비', current: 55_000, isFixed: true },
];

describe('allocateCuts', () => {
  it('지출이 큰 변동비부터 깎는다', () => {
    const plan = allocateCuts(SPENDING, 200_000);
    expect(plan.cuts.map((cut) => cut.name)).toEqual(['외식', '쇼핑']);
    expect(plan.totalCut).toBe(200_000);
  });

  it('카테고리당 30% 를 넘겨 제안하지 않는다', () => {
    const plan = allocateCuts(SPENDING, 10_000_000);
    for (const cut of plan.cuts) {
      expect(cut.cut).toBeLessThanOrEqual(Math.floor(cut.current * 0.3));
    }
  });

  it('고정비는 건드리지 않는다 — 월세를 30% 깎으라는 제안은 무의미하다', () => {
    const plan = allocateCuts(SPENDING, 10_000_000);
    expect(plan.cuts.map((cut) => cut.category)).not.toContain('home.rent');
    expect(plan.cuts.map((cut) => cut.category)).not.toContain('home.telecom');
  });

  it('제안 금액은 현재 - 삭감액과 일치한다', () => {
    for (const cut of allocateCuts(SPENDING, 250_000).cuts) {
      expect(cut.suggested).toBe(cut.current - cut.cut);
      expect(cut.suggested).toBeGreaterThanOrEqual(0);
    }
  });

  it('필요액이 0 이하면 아무것도 제안하지 않는다', () => {
    expect(allocateCuts(SPENDING, 0)).toEqual({ cuts: [], totalCut: 0 });
    expect(allocateCuts(SPENDING, -5_000)).toEqual({ cuts: [], totalCut: 0 });
  });

  it('필요한 만큼만 깎는다 — 마지막 카테고리는 상한까지 가지 않는다', () => {
    const plan = allocateCuts(SPENDING, 130_000);
    expect(plan.totalCut).toBe(130_000);
    expect(plan.cuts).toHaveLength(2);
    expect(plan.cuts[1]?.cut).toBe(4_000); // 외식 126,000 + 쇼핑 4,000
  });

  it('지출이 0 인 카테고리는 건너뛴다', () => {
    const plan = allocateCuts([{ category: 'x', name: '없음', current: 0, isFixed: false }], 1_000);
    expect(plan.cuts).toEqual([]);
  });

  it('삭감액은 전부 정수다', () => {
    const plan = allocateCuts(
      [{ category: 'x', name: '홀수', current: 33_333, isFixed: false }],
      1_000_000,
    );
    expect(plan.cuts[0]?.cut).toBe(9_999); // floor(33,333 × 0.3)
    expect(Number.isInteger(plan.totalCut)).toBe(true);
  });

  it('삭감 비율을 조절할 수 있다', () => {
    const plan = allocateCuts(SPENDING, 10_000_000, 0.1);
    expect(plan.cuts[0]?.cut).toBe(42_000);
  });

  it('같은 금액이면 순서가 결정적이다', () => {
    const tied: CategorySpending[] = [
      { category: 'b', name: 'B', current: 100_000, isFixed: false },
      { category: 'a', name: 'A', current: 100_000, isFixed: false },
    ];
    expect(allocateCuts(tied, 1_000_000).cuts.map((c) => c.category)).toEqual(['a', 'b']);
  });
});

describe('maxCutCapacity', () => {
  it('변동비 30% 의 합이다', () => {
    // 외식 126,000 + 쇼핑 93,000 + 카페 36,000
    expect(maxCutCapacity(SPENDING)).toBe(255_000);
  });
});

describe('goalPlan — 달성 가능', () => {
  it('흑자만으로 충분하면 삭감을 제안하지 않는다', () => {
    const plan = goalPlan({
      target: 6_000_000,
      saved: 0,
      targetDate: '2027-08-11',
      today: '2026-08-11',
      recentMonthlySurplus: 800_000,
      categorySpending: SPENDING,
    });
    expect(plan).toMatchObject({
      feasible: true,
      monthsLeft: 12,
      requiredMonthly: 500_000,
      cuts: [],
      shortfall: 0,
      alternative: null,
    });
  });

  it('이미 모았으면 그렇게 알린다', () => {
    const plan = goalPlan({
      target: 1_000_000,
      saved: 1_000_000,
      targetDate: '2027-08-11',
      today: '2026-08-11',
      recentMonthlySurplus: 0,
      categorySpending: SPENDING,
    });
    expect(plan).toMatchObject({ alreadyAchieved: true, feasible: true, requiredMonthly: 0 });
  });

  it('부족분을 삭감으로 메울 수 있으면 어디를 줄일지 알려준다', () => {
    // 12개월에 6,000,000 → 매달 500,000 필요. 흑자 340,000 → 160,000 부족.
    const plan = goalPlan({
      target: 6_000_000,
      saved: 0,
      targetDate: '2027-08-11',
      today: '2026-08-11',
      recentMonthlySurplus: 340_000,
      categorySpending: SPENDING,
    });
    expect(plan.feasible).toBe(true);
    expect(plan.gap).toBe(160_000);
    expect(plan.totalCut).toBe(160_000);
    expect(plan.cuts[0]).toMatchObject({ name: '외식', current: 420_000, suggested: 294_000 });
    expect(plan.alternative).toBeNull();
  });

  it('필요 금액은 올림한다 — 내림하면 마지막 달에 모자란다', () => {
    const plan = goalPlan({
      target: 1_000_000,
      saved: 0,
      targetDate: '2026-11-11',
      today: '2026-08-11',
      recentMonthlySurplus: 0,
      categorySpending: SPENDING,
    });
    expect(plan.monthsLeft).toBe(3);
    expect(plan.requiredMonthly).toBe(333_334);
    expect(plan.requiredMonthly * plan.monthsLeft).toBeGreaterThanOrEqual(1_000_000);
  });
});

describe('goalPlan — 달성 불가', () => {
  const impossible = {
    target: 12_000_000,
    saved: 0,
    targetDate: '2027-02-11',
    today: '2026-08-11',
    recentMonthlySurplus: 300_000,
    categorySpending: SPENDING,
  };

  it('솔직하게 불가능하다고 말한다', () => {
    const plan = goalPlan(impossible);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfall).toBeGreaterThan(0);
  });

  it('삭감을 최대로 해도 모자란 만큼이 shortfall 이다', () => {
    const plan = goalPlan(impossible);
    expect(plan.totalCut).toBe(maxCutCapacity(SPENDING));
    expect(plan.shortfall).toBe(plan.gap - plan.totalCut);
  });

  it('대안 기한을 계산해서 함께 준다', () => {
    const plan = goalPlan(impossible);
    // 매달 최대 300,000 + 255,000 = 555,000 → 12,000,000 / 555,000 = 22개월
    expect(plan.alternative).toMatchObject({ months: 22, targetDate: '2028-06-11' });
    expect(plan.alternative!.requiredMonthly).toBeLessThanOrEqual(555_000);
  });

  it('대안 기한은 원래 기한보다 뒤다', () => {
    const plan = goalPlan(impossible);
    expect(plan.alternative!.months).toBeGreaterThan(plan.monthsLeft);
  });

  it('흑자도 없고 줄일 것도 없으면 대안을 지어내지 않는다', () => {
    const plan = goalPlan({
      target: 10_000_000,
      saved: 0,
      targetDate: '2027-02-11',
      today: '2026-08-11',
      recentMonthlySurplus: -200_000,
      categorySpending: [{ category: 'home.rent', name: '월세', current: 700_000, isFixed: true }],
    });
    expect(plan.feasible).toBe(false);
    expect(plan.alternative).toBeNull();
  });
});

describe('goalPlan — 기한 경계', () => {
  it('기한이 지났어도 0 으로 나누지 않는다', () => {
    const plan = goalPlan({
      target: 1_000_000,
      saved: 0,
      targetDate: '2026-01-01',
      today: '2026-08-11',
      recentMonthlySurplus: 0,
      categorySpending: SPENDING,
    });
    expect(plan.monthsLeft).toBe(1);
    expect(plan.requiredMonthly).toBe(1_000_000);
  });

  it('같은 달 안이면 1개월로 본다', () => {
    const plan = goalPlan({
      target: 300_000,
      saved: 0,
      targetDate: '2026-08-31',
      today: '2026-08-11',
      recentMonthlySurplus: 0,
      categorySpending: SPENDING,
    });
    expect(plan.monthsLeft).toBe(1);
  });

  it('날짜가 아직 안 지난 달은 세지 않는다', () => {
    // 8/11 → 2027/2/1 은 5개월 (6개월째 되는 날이 아직 안 왔다)
    const plan = goalPlan({
      target: 500_000,
      saved: 0,
      targetDate: '2027-02-01',
      today: '2026-08-11',
      recentMonthlySurplus: 0,
      categorySpending: SPENDING,
    });
    expect(plan.monthsLeft).toBe(5);
  });
});
