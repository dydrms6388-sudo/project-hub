import { describe, expect, it } from 'vitest';
import {
  elapsedDaysIn,
  getFiscalPeriod,
  getFiscalPeriodAt,
  nextFiscalPeriod,
  periodContains,
  previousFiscalPeriod,
  remainingDaysIn,
} from '../src/index.js';

describe('getFiscalPeriod — 시작일 1일 (기본)', () => {
  it('달력 월과 같다', () => {
    expect(getFiscalPeriod('2026-08-11', 1)).toMatchObject({
      start: '2026-08-01',
      end: '2026-08-31',
      year: 2026,
      month: 8,
      key: '2026-08',
      label: '8월',
      totalDays: 31,
    });
  });

  it('30일인 달', () => {
    expect(getFiscalPeriod('2026-04-15', 1)).toMatchObject({
      start: '2026-04-01',
      end: '2026-04-30',
      totalDays: 30,
    });
  });

  it('평년 2월은 28일', () => {
    expect(getFiscalPeriod('2026-02-10', 1)).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
      totalDays: 28,
    });
  });

  it('윤년 2월은 29일', () => {
    expect(getFiscalPeriod('2028-02-10', 1)).toMatchObject({
      start: '2028-02-01',
      end: '2028-02-29',
      totalDays: 29,
    });
  });

  it('월 첫날과 마지막날 모두 같은 기간에 든다', () => {
    expect(getFiscalPeriod('2026-08-01', 1).key).toBe('2026-08');
    expect(getFiscalPeriod('2026-08-31', 1).key).toBe('2026-08');
  });
});

describe('getFiscalPeriod — 시작일 25일 (월급날 기준)', () => {
  it('스펙 예시: 8월은 7/25~8/24 다', () => {
    expect(getFiscalPeriod('2026-08-11', 25)).toMatchObject({
      start: '2026-07-25',
      end: '2026-08-24',
      year: 2026,
      month: 8,
      label: '8월',
      totalDays: 31,
    });
  });

  it('시작일 당일은 새 기간의 첫날이다', () => {
    expect(getFiscalPeriod('2026-08-25', 25)).toMatchObject({
      start: '2026-08-25',
      end: '2026-09-24',
      label: '9월',
    });
  });

  it('시작일 하루 전은 아직 이전 기간이다', () => {
    expect(getFiscalPeriod('2026-08-24', 25)).toMatchObject({
      start: '2026-07-25',
      end: '2026-08-24',
      label: '8월',
    });
  });

  it('연말을 넘어가면 해가 바뀐다', () => {
    expect(getFiscalPeriod('2026-12-30', 25)).toMatchObject({
      start: '2026-12-25',
      end: '2027-01-24',
      year: 2027,
      month: 1,
      label: '1월',
    });
  });

  it('연초는 작년 12월에서 시작한다', () => {
    expect(getFiscalPeriod('2027-01-05', 25)).toMatchObject({
      start: '2026-12-25',
      end: '2027-01-24',
    });
  });

  it('2월을 지나는 기간은 28일이다 (평년)', () => {
    expect(getFiscalPeriod('2026-02-25', 25)).toMatchObject({
      start: '2026-02-25',
      end: '2026-03-24',
      totalDays: 28,
    });
  });

  it('윤년 2월을 지나는 기간은 29일이다', () => {
    expect(getFiscalPeriod('2028-02-25', 25)).toMatchObject({
      start: '2028-02-25',
      end: '2028-03-24',
      totalDays: 29,
    });
  });

  it('1월 25일 시작 기간은 2월 24일에 끝난다', () => {
    expect(getFiscalPeriod('2026-02-01', 25)).toMatchObject({
      start: '2026-01-25',
      end: '2026-02-24',
      totalDays: 31,
    });
  });
});

describe('getFiscalPeriod — 시작일 28일 (허용 상한)', () => {
  it('평년 2월에서도 기간이 깨지지 않는다', () => {
    expect(getFiscalPeriod('2026-03-01', 28)).toMatchObject({
      start: '2026-02-28',
      end: '2026-03-27',
    });
  });

  it('1월 28일 → 2월 27일', () => {
    expect(getFiscalPeriod('2026-02-01', 28)).toMatchObject({
      start: '2026-01-28',
      end: '2026-02-27',
    });
  });
});

describe('getFiscalPeriod — 잘못된 입력', () => {
  it('29일 이상은 거부한다 — 없는 달이 생긴다', () => {
    expect(() => getFiscalPeriod('2026-08-11', 29)).toThrow(RangeError);
    expect(() => getFiscalPeriod('2026-08-11', 31)).toThrow(RangeError);
  });

  it('0 이하와 정수가 아닌 값도 거부한다', () => {
    expect(() => getFiscalPeriod('2026-08-11', 0)).toThrow(RangeError);
    expect(() => getFiscalPeriod('2026-08-11', 1.5)).toThrow(RangeError);
  });

  it('존재하지 않는 날짜는 거부한다', () => {
    expect(() => getFiscalPeriod('2026-02-29', 1)).toThrow(RangeError);
  });

  it('형식이 틀린 날짜는 거부한다', () => {
    expect(() => getFiscalPeriod('2026/08/11', 1)).toThrow(RangeError);
  });
});

describe('getFiscalPeriodAt — KST 경계', () => {
  it('UTC 15:00 은 KST 로 다음날이라 기간이 넘어간다', () => {
    // KST 2026-08-25 00:00 = UTC 2026-08-24 15:00
    expect(getFiscalPeriodAt(new Date('2026-08-24T15:00:00Z'), 25).start).toBe('2026-08-25');
    // 1분 전은 아직 KST 8/24
    expect(getFiscalPeriodAt(new Date('2026-08-24T14:59:00Z'), 25).start).toBe('2026-07-25');
  });
});

describe('기간 이동', () => {
  const august = getFiscalPeriod('2026-08-11', 25);

  it('다음 기간은 이어 붙는다', () => {
    const next = nextFiscalPeriod(august, 25);
    expect(next.start).toBe('2026-08-25');
    expect(next.label).toBe('9월');
  });

  it('이전 기간도 이어 붙는다', () => {
    const previous = previousFiscalPeriod(august, 25);
    expect(previous.end).toBe('2026-07-24');
    expect(previous.label).toBe('7월');
  });

  it('앞뒤로 갔다 오면 제자리다', () => {
    expect(previousFiscalPeriod(nextFiscalPeriod(august, 25), 25)).toEqual(august);
  });

  it('열두 번 넘기면 1년 뒤 같은 달이다', () => {
    let period = august;
    for (let i = 0; i < 12; i++) period = nextFiscalPeriod(period, 25);
    expect(period).toMatchObject({ year: 2027, month: 8, start: '2027-07-25' });
  });
});

describe('경과일 / 남은일', () => {
  const period = getFiscalPeriod('2026-08-11', 25); // 7/25 ~ 8/24, 31일

  it('첫날은 1일 경과, 31일 남음', () => {
    expect(elapsedDaysIn(period, '2026-07-25')).toBe(1);
    expect(remainingDaysIn(period, '2026-07-25')).toBe(31);
  });

  it('마지막날은 31일 경과, 1일 남음', () => {
    expect(elapsedDaysIn(period, '2026-08-24')).toBe(31);
    expect(remainingDaysIn(period, '2026-08-24')).toBe(1);
  });

  it('경과일 + 남은일 = 총일수 + 1 (당일이 양쪽에 들어간다)', () => {
    expect(elapsedDaysIn(period, '2026-08-11') + remainingDaysIn(period, '2026-08-11')).toBe(
      period.totalDays + 1,
    );
  });

  it('기간 이전이면 경과 0, 남은 일수는 전체', () => {
    expect(elapsedDaysIn(period, '2026-07-01')).toBe(0);
    expect(remainingDaysIn(period, '2026-07-01')).toBe(31);
  });

  it('기간이 지났으면 남은 일수는 1 로 잡는다 — 0 으로 나누지 않기 위해서다', () => {
    expect(elapsedDaysIn(period, '2026-09-01')).toBe(31);
    expect(remainingDaysIn(period, '2026-09-01')).toBe(1);
  });
});

describe('periodContains', () => {
  const period = getFiscalPeriod('2026-08-11', 25);

  it('양 끝을 포함한다', () => {
    expect(periodContains(period, '2026-07-25')).toBe(true);
    expect(periodContains(period, '2026-08-24')).toBe(true);
  });

  it('하루 밖은 제외한다', () => {
    expect(periodContains(period, '2026-07-24')).toBe(false);
    expect(periodContains(period, '2026-08-25')).toBe(false);
  });
});
