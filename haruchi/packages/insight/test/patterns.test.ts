import { getFiscalPeriod } from '@haruchi/budget';
import { describe, expect, it } from 'vitest';
import { noSpendStats, spendingPatterns } from '../src/index.js';
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

describe('noSpendStats', () => {
  it('오늘까지만 센다 — 아직 안 온 날을 무지출일로 세면 거짓말이다', () => {
    const stats = noSpendStats([entry({ occurredAt: at('2026-08-01') })], period, '2026-08-05');
    expect(stats).toMatchObject({ observedDays: 5, noSpendDays: 4 });
  });

  it('최장 연속 기록을 센다', () => {
    const stats = noSpendStats(
      [
        entry({ occurredAt: at('2026-08-01') }),
        entry({ occurredAt: at('2026-08-06') }),
        entry({ occurredAt: at('2026-08-10') }),
      ],
      period,
      '2026-08-10',
    );
    // 8/2~8/5 (4일), 8/7~8/9 (3일)
    expect(stats.longestStreak).toBe(4);
    expect(stats.noSpendDays).toBe(7);
    expect(stats.currentStreak).toBe(0);
  });

  it('오늘까지 이어지는 연속 기록을 따로 준다', () => {
    const stats = noSpendStats([entry({ occurredAt: at('2026-08-01') })], period, '2026-08-04');
    expect(stats.currentStreak).toBe(3);
  });

  it('같은 날 여러 번 써도 하루로 센다', () => {
    const stats = noSpendStats(
      [entry({ occurredAt: at('2026-08-01', 9) }), entry({ occurredAt: at('2026-08-01', 20) })],
      period,
      '2026-08-02',
    );
    expect(stats.noSpendDays).toBe(1);
  });

  it('수입·이체·통계제외는 지출로 세지 않는다', () => {
    const stats = noSpendStats(
      [
        entry({ occurredAt: at('2026-08-01'), kind: 'income' }),
        entry({ occurredAt: at('2026-08-02'), isExcluded: true }),
        entry({ occurredAt: at('2026-08-03'), isCancellation: true }),
      ],
      period,
      '2026-08-03',
    );
    expect(stats.noSpendDays).toBe(3);
  });

  it('기간 밖 거래는 무시한다', () => {
    const stats = noSpendStats([entry({ occurredAt: at('2026-07-31') })], period, '2026-08-02');
    expect(stats.noSpendDays).toBe(2);
  });

  it('KST 로 날짜를 가른다', () => {
    // UTC 2026-07-31 15:00 = KST 2026-08-01 00:00 → 기간 안
    const stats = noSpendStats(
      [entry({ occurredAt: '2026-07-31T15:00:00.000Z' })],
      period,
      '2026-08-01',
    );
    expect(stats.noSpendDays).toBe(0);
  });

  it('기간 시작 전이면 아무것도 세지 않는다', () => {
    expect(noSpendStats([], period, '2026-07-20')).toMatchObject({
      observedDays: 0,
      noSpendDays: 0,
    });
  });

  it('기간이 끝났으면 전체를 센다', () => {
    expect(noSpendStats([], period, '2026-09-15').observedDays).toBe(31);
  });
});

describe('spendingPatterns', () => {
  it('요일별로 나눈다 (KST 기준)', () => {
    // 2026-08-01 은 토요일
    const patterns = spendingPatterns([entry({ occurredAt: at('2026-08-01') })], period);
    const saturday = patterns.byWeekday.find((day) => day.weekday === 6);
    expect(saturday).toMatchObject({ name: '토', amount: 10_000, count: 1 });
  });

  it('일곱 요일을 모두 돌려준다', () => {
    expect(spendingPatterns([], period).byWeekday).toHaveLength(7);
  });

  it('자정~새벽 5시 지출을 따로 센다', () => {
    const patterns = spendingPatterns(
      [
        entry({ occurredAt: at('2026-08-01', 2), amount: 15_000 }),
        entry({ occurredAt: at('2026-08-02', 23), amount: 20_000 }),
      ],
      period,
    );
    expect(patterns.lateNightCount).toBe(1);
    expect(patterns.lateNightAmount).toBe(15_000);
    expect(patterns.totalAmount).toBe(35_000);
  });

  it('새벽 5시는 심야가 아니다 (경계)', () => {
    const patterns = spendingPatterns([entry({ occurredAt: at('2026-08-01', 5) })], period);
    expect(patterns.lateNightCount).toBe(0);
  });

  it('KST 로 시각을 센다 — UTC 로 세면 심야가 저녁으로 옮겨간다', () => {
    // UTC 2026-08-01 17:00 = KST 2026-08-02 02:00 → 심야
    const patterns = spendingPatterns([entry({ occurredAt: '2026-08-01T17:00:00.000Z' })], period);
    expect(patterns.lateNightCount).toBe(1);
  });

  it('기간 밖과 비지출 거래는 세지 않는다', () => {
    const patterns = spendingPatterns(
      [
        entry({ occurredAt: at('2026-07-31') }),
        entry({ occurredAt: at('2026-08-01'), kind: 'income' }),
        entry({ occurredAt: at('2026-08-01'), isExcluded: true }),
      ],
      period,
    );
    expect(patterns.totalCount).toBe(0);
  });
});
