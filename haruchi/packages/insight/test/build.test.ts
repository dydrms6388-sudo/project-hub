import type { CategoryTotal } from '@haruchi/budget';
import { getFiscalPeriod } from '@haruchi/budget';
import { describe, expect, it } from 'vitest';
import { buildInsights, formatWon } from '../src/index.js';
import type { InsightEntry } from '../src/types.js';

/** 8/1 ~ 8/31 */
const period = getFiscalPeriod('2026-08-11', 1);

function at(date: string, hour = 12): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`).toISOString();
}

function entry(overrides: Partial<InsightEntry> & { occurredAt: string }): InsightEntry {
  return {
    amount: 10_000,
    kind: 'expense',
    isCancellation: false,
    isExcluded: false,
    isFixed: false,
    categoryKey: 'food.cafe',
    merchantNormalized: '스타벅스',
    ...overrides,
  };
}

const total = (categoryKey: string | null, amount: number): CategoryTotal => ({
  categoryKey,
  amount,
  isFixed: false,
});

const NAMES = { 'food.dining': '외식', 'food.cafe': '카페·음료', 'leisure.subscription': '구독' };

describe('buildInsights — 노출 조건', () => {
  it('첫 주가 지나기 전에는 아무것도 보여주지 않는다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      period,
      today: '2026-08-07',
      currentTotals: [total('food.dining', 500_000)],
      previousTotals: [total('food.dining', 100_000)],
    });
    expect(insights).toEqual([]);
  });

  it('8일째부터 보여준다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      period,
      today: '2026-08-08',
      currentTotals: [total('food.dining', 500_000)],
      previousTotals: [total('food.dining', 100_000)],
      categoryNames: NAMES,
    });
    expect(insights.length).toBeGreaterThan(0);
  });

  it('거래가 없으면 억지로 만들지 않는다', () => {
    expect(
      buildInsights({
        entries: [],
        period,
        today: '2026-08-20',
        currentTotals: [],
        previousTotals: [],
      }),
    ).toEqual([]);
  });

  it('비교할 지난달이 없으면 증감을 말하지 않는다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      period,
      today: '2026-08-20',
      currentTotals: [total('food.dining', 500_000)],
    });
    expect(insights.some((insight) => insight.kind.startsWith('category_'))).toBe(false);
  });
});

describe('buildInsights — 카테고리 증감', () => {
  const base = {
    entries: [entry({ occurredAt: at('2026-08-01') })],
    period,
    today: '2026-08-20' as const,
    categoryNames: NAMES,
  };

  it('증가는 금액과 비율을 함께 말한다', () => {
    const insights = buildInsights({
      ...base,
      currentTotals: [total('food.dining', 520_000)],
      previousTotals: [total('food.dining', 400_000)],
    });
    const increase = insights.find((insight) => insight.kind === 'category_increase');
    expect(increase?.headline).toBe('외식이(가) 지난달보다 120,000원 늘었어요 (+30%)');
  });

  it('감소도 말한다', () => {
    const insights = buildInsights({
      ...base,
      currentTotals: [total('food.dining', 200_000)],
      previousTotals: [total('food.dining', 400_000)],
    });
    const decrease = insights.find((insight) => insight.kind === 'category_decrease');
    expect(decrease?.headline).toBe('외식이(가) 지난달보다 200,000원 줄었어요 (-50%)');
  });

  it('지난달에 없던 카테고리는 비율을 붙이지 않는다', () => {
    const insights = buildInsights({
      ...base,
      currentTotals: [total('leisure.travel', 800_000)],
      previousTotals: [],
    });
    const insight = insights.find((i) => i.kind === 'category_increase');
    expect(insight?.headline).toBe('leisure.travel이(가) 지난달보다 800,000원 늘었어요');
    expect(insight?.changeRatio).toBeNull();
  });

  it('카테고리 이름을 모르면 키를 그대로 쓴다 — 빈칸을 만들지 않는다', () => {
    const insights = buildInsights({
      ...base,
      categoryNames: {},
      currentTotals: [total('food.dining', 520_000)],
      previousTotals: [total('food.dining', 400_000)],
    });
    expect(insights[0]?.headline).toContain('food.dining');
  });
});

describe('buildInsights — 정기결제', () => {
  const subscription = [
    entry({ merchantNormalized: '넷플릭스', amount: 12_900, categoryKey: 'leisure.subscription', occurredAt: at('2026-06-05') }),
    entry({ merchantNormalized: '넷플릭스', amount: 12_900, categoryKey: 'leisure.subscription', occurredAt: at('2026-07-05') }),
    entry({ merchantNormalized: '넷플릭스', amount: 12_900, categoryKey: 'leisure.subscription', occurredAt: at('2026-08-04') }),
  ];

  it('탐지한 정기결제를 알려준다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      history: subscription,
      period,
      today: '2026-08-20',
      currentTotals: [],
      categoryNames: NAMES,
    });
    const recurring = insights.find((insight) => insight.kind === 'recurring_detected');
    expect(recurring?.headline).toBe('넷플릭스 12,900원이(가) 30일마다 나가고 있어요');
  });

  it('사용자가 이미 확인한 정기결제는 반복해서 말하지 않는다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      history: subscription,
      period,
      today: '2026-08-20',
      currentTotals: [],
      knownRecurring: ['넷플릭스'],
    });
    expect(insights.some((insight) => insight.kind === 'recurring_detected')).toBe(false);
  });

  it('미사용 의심 구독은 단정하지 않고 사실만 말한다', () => {
    const longRunning = [
      ...['2026-02-05', '2026-03-07', '2026-04-06', '2026-05-06', '2026-06-05', '2026-07-05', '2026-08-04'].map(
        (date) =>
          entry({
            merchantNormalized: '왓챠',
            amount: 12_900,
            categoryKey: 'leisure.subscription',
            occurredAt: at(date),
          }),
      ),
    ];
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      history: longRunning,
      period,
      today: '2026-08-20',
      currentTotals: [],
    });
    const dormant = insights.find((insight) => insight.kind === 'dormant_subscription');
    expect(dormant?.headline).toContain('왓챠');
    expect(dormant?.headline).toContain('개월째');
    // "안 쓰고 있다"고 단정하지 않는다
    expect(dormant?.headline).not.toContain('안 쓰');
    expect(dormant?.headline).not.toContain('해지');
  });
});

describe('buildInsights — 무지출일과 심야 지출', () => {
  it('무지출일이 3일 이상이면 말한다', () => {
    const insights = buildInsights({
      entries: [entry({ occurredAt: at('2026-08-01') })],
      period,
      today: '2026-08-10',
      currentTotals: [],
    });
    const noSpend = insights.find((insight) => insight.kind === 'no_spend_streak');
    expect(noSpend?.headline).toBe('10일 중 9일은 한 푼도 안 썼어요. 최장 연속 9일이에요');
  });

  it('심야 지출이 3건 이상이고 비중이 15% 이상이면 말한다', () => {
    const entries = [
      entry({ occurredAt: at('2026-08-01', 2), amount: 20_000 }),
      entry({ occurredAt: at('2026-08-02', 3), amount: 20_000 }),
      entry({ occurredAt: at('2026-08-03', 1), amount: 20_000 }),
      entry({ occurredAt: at('2026-08-04', 13), amount: 40_000 }),
    ];
    const insights = buildInsights({ entries, period, today: '2026-08-20', currentTotals: [] });
    const lateNight = insights.find((insight) => insight.kind === 'late_night_spending');
    expect(lateNight?.headline).toBe(
      '자정~새벽 5시 사이에 3번, 60,000원을(를) 썼어요. 이번 달 지출의 60%예요',
    );
  });

  it('심야 지출이 2건뿐이면 말하지 않는다 — 우연이다', () => {
    const entries = [
      entry({ occurredAt: at('2026-08-01', 2) }),
      entry({ occurredAt: at('2026-08-02', 3) }),
    ];
    const insights = buildInsights({ entries, period, today: '2026-08-20', currentTotals: [] });
    expect(insights.some((insight) => insight.kind === 'late_night_spending')).toBe(false);
  });

  it('심야 비중이 작으면 말하지 않는다', () => {
    const entries = [
      entry({ occurredAt: at('2026-08-01', 2), amount: 1_000 }),
      entry({ occurredAt: at('2026-08-02', 3), amount: 1_000 }),
      entry({ occurredAt: at('2026-08-03', 1), amount: 1_000 }),
      entry({ occurredAt: at('2026-08-04', 13), amount: 1_000_000 }),
    ];
    const insights = buildInsights({ entries, period, today: '2026-08-20', currentTotals: [] });
    expect(insights.some((insight) => insight.kind === 'late_night_spending')).toBe(false);
  });
});

describe('buildInsights — 정렬', () => {
  it('행동할 수 있는 것부터 위에 온다', () => {
    const insights = buildInsights({
      entries: [
        entry({ occurredAt: at('2026-08-01', 2) }),
        entry({ occurredAt: at('2026-08-02', 3) }),
        entry({ occurredAt: at('2026-08-03', 1) }),
      ],
      period,
      today: '2026-08-20',
      currentTotals: [total('food.dining', 520_000)],
      previousTotals: [total('food.dining', 400_000)],
      categoryNames: NAMES,
    });
    const kinds = insights.map((insight) => insight.kind);
    expect(kinds.indexOf('category_increase')).toBeLessThan(kinds.indexOf('no_spend_streak'));
  });
});

describe('formatWon', () => {
  it('천 단위로 끊는다', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(999)).toBe('999원');
    expect(formatWon(1_000)).toBe('1,000원');
    expect(formatWon(1_234_567)).toBe('1,234,567원');
  });

  it('음수도 다룬다', () => {
    expect(formatWon(-120_000)).toBe('-120,000원');
  });

  it('Intl 에 의존하지 않는다 — 런타임에 따라 결과가 달라지면 안 된다', () => {
    expect(formatWon(10_000_000_000)).toBe('10,000,000,000원');
  });
});
