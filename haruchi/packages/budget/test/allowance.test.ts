import { describe, expect, it } from 'vitest';
import { burnRate, dailyAllowance, getFiscalPeriod } from '../src/index.js';

/** 7/25 ~ 8/24, 31일 */
const period = getFiscalPeriod('2026-08-11', 25);

describe('dailyAllowance', () => {
  it('남은 예산을 남은 일수로 나눈다', () => {
    // 8/11 기준 남은 일수 14일, 남은 예산 336,000 → 24,000
    const result = dailyAllowance({
      budget: 1_000_000,
      spent: 664_000,
      today: '2026-08-11',
      period,
    });
    expect(result).toEqual({
      amount: 24_000,
      remaining: 336_000,
      remainingDays: 14,
      isOver: false,
    });
  });

  it('나누어떨어지지 않으면 내림한다 — 올림하면 월말에 예산을 넘긴다', () => {
    const result = dailyAllowance({ budget: 100, spent: 0, today: '2026-08-24', period });
    expect(result.remainingDays).toBe(1);
    expect(result.amount).toBe(100);

    const spread = dailyAllowance({ budget: 100, spent: 0, today: '2026-08-22', period });
    expect(spread.remainingDays).toBe(3);
    expect(spread.amount).toBe(33); // 33.33 → 33
  });

  it('내림한 금액을 남은 일수만큼 써도 예산을 넘지 않는다', () => {
    for (const budget of [100, 999, 12_345, 1_000_001]) {
      const result = dailyAllowance({ budget, spent: 0, today: '2026-07-25', period });
      expect(result.amount * result.remainingDays).toBeLessThanOrEqual(budget);
    }
  });

  it('예산을 넘기면 음수로 알린다', () => {
    const result = dailyAllowance({
      budget: 1_000_000,
      spent: 1_140_000,
      today: '2026-08-11',
      period,
    });
    expect(result.isOver).toBe(true);
    expect(result.remaining).toBe(-140_000);
    expect(result.amount).toBe(-10_000);
  });

  it('첫날에는 예산 전체를 총일수로 나눈다', () => {
    const result = dailyAllowance({ budget: 3_100_000, spent: 0, today: '2026-07-25', period });
    expect(result.remainingDays).toBe(31);
    expect(result.amount).toBe(100_000);
  });

  it('기간이 지난 뒤에도 0 으로 나누지 않는다', () => {
    const result = dailyAllowance({ budget: 100, spent: 50, today: '2026-09-30', period });
    expect(result.remainingDays).toBe(1);
    expect(Number.isFinite(result.amount)).toBe(true);
  });

  it('결과는 언제나 정수다', () => {
    for (const spent of [0, 1, 7, 99_999, 664_321]) {
      const result = dailyAllowance({ budget: 1_000_000, spent, today: '2026-08-11', period });
      expect(Number.isInteger(result.amount)).toBe(true);
    }
  });
});

describe('burnRate — 고정비 분리', () => {
  const base = { budget: 3_100_000, today: '2026-08-04', period } as const; // 11일 경과

  it('변동비만 비율로 늘리고 고정비는 금액 그대로 더한다', () => {
    // 변동비 110,000 / 11일 = 하루 10,000 → 31일 310,000. 고정비 500,000 은 그대로.
    const result = burnRate({ ...base, variableSpent: 110_000, fixedSpent: 500_000 });
    expect(result.elapsedDays).toBe(11);
    expect(result.variablePerDay).toBe(10_000);
    expect(result.projected).toBe(810_000);
  });

  it('월초 월세를 비율로 늘리지 않는다 — 이게 "월말 예상 800만원" 헛소리의 원인이다', () => {
    const wrong = burnRate({ ...base, variableSpent: 110_000 + 500_000, fixedSpent: 0 });
    const right = burnRate({ ...base, variableSpent: 110_000, fixedSpent: 500_000 });

    // 고정비를 변동비에 섞으면 예상치가 90만원 넘게 부풀어 오른다.
    // 월세 50만원이 "하루 45,455원씩 쓰는 중"으로 둔갑하기 때문이다.
    expect(wrong.projected).toBe(1_719_091); // round(610,000 × 31 ÷ 11)
    expect(right.projected).toBe(810_000);
    expect(wrong.projected - right.projected).toBe(909_091);
  });

  it('예산 대비 95% 이하면 ok', () => {
    expect(burnRate({ ...base, variableSpent: 1_000_000, fixedSpent: 0 }).status).toBe('ok');
  });

  it('95% 초과 105% 이하면 tight', () => {
    // 3,100,000 의 100% 가 되도록: 하루 100,000 × 31일
    const result = burnRate({ ...base, variableSpent: 1_100_000, fixedSpent: 0 });
    expect(result.projected).toBe(3_100_000);
    expect(result.status).toBe('tight');
  });

  it('105% 를 넘으면 over', () => {
    const result = burnRate({ ...base, variableSpent: 1_200_000, fixedSpent: 0 });
    expect(result.status).toBe('over');
  });

  it('경계값에서 흔들리지 않는다', () => {
    // 정확히 95% → tight 가 아니라 ok (초과해야 tight)
    const at95 = burnRate({ ...base, variableSpent: 0, fixedSpent: 2_945_000 });
    expect(at95.projected).toBe(2_945_000);
    expect(at95.status).toBe('ok');

    // 정확히 105% → over 가 아니라 tight
    const at105 = burnRate({ ...base, variableSpent: 0, fixedSpent: 3_255_000 });
    expect(at105.status).toBe('tight');
  });

  it('아직 안 나간 고정비를 알려주면 예상치에 더한다', () => {
    const result = burnRate({
      ...base,
      variableSpent: 110_000,
      fixedSpent: 0,
      expectedRemainingFixed: 500_000,
    });
    expect(result.projected).toBe(810_000);
  });

  it('첫날에도 0 으로 나누지 않는다', () => {
    const result = burnRate({
      ...base,
      today: '2026-07-25',
      variableSpent: 10_000,
      fixedSpent: 0,
    });
    expect(result.elapsedDays).toBe(1);
    expect(result.projected).toBe(310_000);
  });

  it('기간 시작 전이어도 경과일을 1 로 잡는다', () => {
    const result = burnRate({ ...base, today: '2026-07-01', variableSpent: 0, fixedSpent: 0 });
    expect(result.elapsedDays).toBe(1);
    expect(result.projected).toBe(0);
  });

  it('예산이 0 이면 쓴 게 있을 때만 over 다', () => {
    expect(burnRate({ ...base, budget: 0, variableSpent: 0, fixedSpent: 0 }).status).toBe('ok');
    expect(burnRate({ ...base, budget: 0, variableSpent: 1_000, fixedSpent: 0 }).status).toBe('over');
  });

  it('예상치는 언제나 정수다', () => {
    for (const spent of [1, 7, 3_333, 999_999]) {
      const result = burnRate({ ...base, variableSpent: spent, fixedSpent: 0 });
      expect(Number.isInteger(result.projected)).toBe(true);
    }
  });

  it('큰 금액에서도 정밀도가 깨지지 않는다', () => {
    const result = burnRate({ ...base, variableSpent: 1_000_000_000, fixedSpent: 0 });
    expect(Number.isSafeInteger(result.projected)).toBe(true);
    expect(result.projected).toBe(Math.round((1_000_000_000 * 31) / 11));
  });
});
