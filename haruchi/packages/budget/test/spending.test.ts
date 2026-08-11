import { describe, expect, it } from 'vitest';
import { getFiscalPeriod, summarizeSpending, type SpendingEntry } from '../src/index.js';

/** 7/25 ~ 8/24 */
const period = getFiscalPeriod('2026-08-11', 25);

function entry(overrides: Partial<SpendingEntry> = {}): SpendingEntry {
  return {
    occurredAt: '2026-08-11T03:30:00.000Z',
    amount: 10_000,
    kind: 'expense',
    isCancellation: false,
    isExcluded: false,
    isFixed: false,
    categoryKey: 'food.cafe',
    ...overrides,
  };
}

describe('summarizeSpending', () => {
  it('지출을 더하고 고정비를 분리한다', () => {
    const summary = summarizeSpending(
      [
        entry({ amount: 12_000 }),
        entry({ amount: 700_000, isFixed: true, categoryKey: 'home.rent' }),
        entry({ amount: 3_300, categoryKey: 'food.convenience' }),
      ],
      period,
    );
    expect(summary).toMatchObject({
      totalSpent: 715_300,
      fixedSpent: 700_000,
      variableSpent: 15_300,
      counted: 3,
    });
  });

  it('취소 건은 같은 카테고리에서 차감한다', () => {
    const summary = summarizeSpending(
      [entry({ amount: 12_000 }), entry({ amount: 12_000, isCancellation: true })],
      period,
    );
    expect(summary.totalSpent).toBe(0);
    expect(summary.byCategory[0]?.amount).toBe(0);
  });

  it('부분취소는 차액만 남긴다', () => {
    const summary = summarizeSpending(
      [entry({ amount: 12_000 }), entry({ amount: 5_000, isCancellation: true })],
      period,
    );
    expect(summary.totalSpent).toBe(7_000);
  });

  it('수입은 지출과 섞이지 않는다', () => {
    const summary = summarizeSpending(
      [entry({ amount: 12_000 }), entry({ amount: 2_500_000, kind: 'income', categoryKey: 'income.salary' })],
      period,
    );
    expect(summary.totalSpent).toBe(12_000);
    expect(summary.totalIncome).toBe(2_500_000);
  });

  it('이체는 세지 않는다 — 내 계좌 간 이동은 소비가 아니다', () => {
    const summary = summarizeSpending(
      [entry({ amount: 500_000, kind: 'transfer', categoryKey: 'transfer' })],
      period,
    );
    expect(summary).toMatchObject({ totalSpent: 0, totalIncome: 0, counted: 0 });
  });

  it('통계 제외 표시된 거래는 뺀다', () => {
    const summary = summarizeSpending([entry({ isExcluded: true })], period);
    expect(summary.counted).toBe(0);
  });

  it('회계월 밖의 거래는 세지 않는다', () => {
    const summary = summarizeSpending(
      [
        // KST 2026-07-24 = 기간 하루 전
        entry({ occurredAt: '2026-07-24T03:00:00.000Z' }),
        // KST 2026-08-25 = 기간 하루 뒤
        entry({ occurredAt: '2026-08-25T03:00:00.000Z' }),
        entry({ occurredAt: '2026-08-11T03:00:00.000Z' }),
      ],
      period,
    );
    expect(summary.counted).toBe(1);
  });

  it('KST 기준으로 기간을 가른다 — UTC 로 판정하면 하루가 밀린다', () => {
    // UTC 2026-07-24 15:00 = KST 2026-07-25 00:00 → 기간 안
    const inside = summarizeSpending([entry({ occurredAt: '2026-07-24T15:00:00.000Z' })], period);
    expect(inside.counted).toBe(1);

    // 1분 전은 KST 로 아직 7/24 → 기간 밖
    const outside = summarizeSpending([entry({ occurredAt: '2026-07-24T14:59:00.000Z' })], period);
    expect(outside.counted).toBe(0);
  });

  it('카테고리별 합계를 큰 순으로 준다', () => {
    const summary = summarizeSpending(
      [
        entry({ amount: 10_000, categoryKey: 'food.cafe' }),
        entry({ amount: 50_000, categoryKey: 'food.dining' }),
        entry({ amount: 20_000, categoryKey: 'food.cafe' }),
      ],
      period,
    );
    expect(summary.byCategory).toEqual([
      { categoryKey: 'food.dining', amount: 50_000, isFixed: false },
      { categoryKey: 'food.cafe', amount: 30_000, isFixed: false },
    ]);
  });

  it('미분류 거래도 합계에 들어간다', () => {
    const summary = summarizeSpending([entry({ categoryKey: null, amount: 9_000 })], period);
    expect(summary.totalSpent).toBe(9_000);
    expect(summary.byCategory[0]?.categoryKey).toBeNull();
  });

  it('빈 입력에도 0 을 돌려준다', () => {
    expect(summarizeSpending([], period)).toMatchObject({
      totalSpent: 0,
      fixedSpent: 0,
      variableSpent: 0,
      totalIncome: 0,
      counted: 0,
      byCategory: [],
    });
  });

  it('합계는 전부 정수다', () => {
    const summary = summarizeSpending(
      [entry({ amount: 3_333 }), entry({ amount: 7_777, isFixed: true })],
      period,
    );
    expect(Number.isInteger(summary.totalSpent)).toBe(true);
    expect(summary.variableSpent + summary.fixedSpent).toBe(summary.totalSpent);
  });
});
