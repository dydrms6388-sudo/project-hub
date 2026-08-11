/**
 * 공용 KST 달력 연산 테스트.
 *
 * 파서와 예산 엔진이 함께 딛고 선 바닥이라, 여기가 하루 밀리면 두 곳이 같이 틀린다.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  differenceInDays,
  differenceInMonths,
  formatPlainDate,
  isLeapYear,
  parsePlainDate,
  toPlainDate,
  weekdayOf,
  WEEKDAY_NAMES,
} from '../src/time.js';

describe('parsePlainDate / formatPlainDate', () => {
  it('왕복해도 그대로다', () => {
    expect(formatPlainDate(parsePlainDate('2026-08-11'))).toBe('2026-08-11');
  });

  it('한 자리 월·일을 0 으로 채운다', () => {
    expect(formatPlainDate({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
  });

  it('형식이 틀리면 거부한다', () => {
    expect(() => parsePlainDate('2026/08/11')).toThrow(RangeError);
    expect(() => parsePlainDate('2026-8-11')).toThrow(RangeError);
    expect(() => parsePlainDate('')).toThrow(RangeError);
  });

  it('존재하지 않는 날짜를 거부한다', () => {
    expect(() => parsePlainDate('2026-02-29')).toThrow(RangeError);
    expect(() => parsePlainDate('2026-04-31')).toThrow(RangeError);
    expect(() => parsePlainDate('2026-13-01')).toThrow(RangeError);
    expect(() => parsePlainDate('2026-00-01')).toThrow(RangeError);
  });

  it('윤년 2월 29일은 받아들인다', () => {
    expect(parsePlainDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('isLeapYear', () => {
  it('4로 나뉘면 윤년', () => {
    expect(isLeapYear(2028)).toBe(true);
  });

  it('100으로 나뉘면 평년', () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it('400으로 나뉘면 윤년', () => {
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe('addDays', () => {
  it('월을 넘어간다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('해를 넘어간다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('거꾸로도 간다', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('평년 2월을 건너뛴다', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('윤년 2월 29일을 지난다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('0 을 더하면 제자리다', () => {
    expect(addDays('2026-08-11', 0)).toBe('2026-08-11');
  });
});

describe('addMonths', () => {
  it('말일이 없는 달로 가면 말일로 맞춘다', () => {
    // 1/31 의 한 달 뒤는 3/3 이 아니라 2/28 이다
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('해를 넘어간다', () => {
    expect(addMonths('2026-12-25', 1)).toBe('2027-01-25');
    expect(addMonths('2026-01-25', -1)).toBe('2025-12-25');
  });

  it('열두 달이면 1년이다', () => {
    expect(addMonths('2026-08-11', 12)).toBe('2027-08-11');
  });

  it('여러 해를 건너뛴다', () => {
    expect(addMonths('2026-08-11', 30)).toBe('2029-02-11');
    expect(addMonths('2026-08-11', -20)).toBe('2024-12-11');
  });
});

describe('differenceInDays', () => {
  it('같은 날은 0 이다', () => {
    expect(differenceInDays('2026-08-11', '2026-08-11')).toBe(0);
  });

  it('과거로 가면 음수다', () => {
    expect(differenceInDays('2026-08-11', '2026-08-10')).toBe(-1);
  });

  it('평년 한 해는 365일이다', () => {
    expect(differenceInDays('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('윤년 한 해는 366일이다', () => {
    expect(differenceInDays('2028-01-01', '2029-01-01')).toBe(366);
  });

  it('2월을 지나는 구간을 정확히 센다', () => {
    expect(differenceInDays('2026-02-25', '2026-03-24')).toBe(27);
    expect(differenceInDays('2028-02-25', '2028-03-24')).toBe(28);
  });
});

describe('differenceInMonths', () => {
  it('날짜가 같으면 온전한 개월 수다', () => {
    expect(differenceInMonths('2026-08-11', '2027-08-11')).toBe(12);
  });

  it('날짜가 아직 안 지났으면 한 달 빼고 센다', () => {
    expect(differenceInMonths('2026-08-11', '2027-02-01')).toBe(5);
  });

  it('날짜가 지났으면 그대로 센다', () => {
    expect(differenceInMonths('2026-08-11', '2027-02-20')).toBe(6);
  });

  it('과거면 음수다', () => {
    expect(differenceInMonths('2026-08-11', '2026-01-01')).toBe(-8);
  });

  it('같은 달 안이면 0 이다', () => {
    expect(differenceInMonths('2026-08-11', '2026-08-31')).toBe(0);
  });
});

describe('weekdayOf', () => {
  it('요일을 KST 달력으로 센다', () => {
    // 2026-08-01 은 토요일
    expect(weekdayOf('2026-08-01')).toBe(6);
    expect(WEEKDAY_NAMES[weekdayOf('2026-08-01')]).toBe('토');
    expect(weekdayOf('2026-08-02')).toBe(0);
    expect(WEEKDAY_NAMES[weekdayOf('2026-08-02')]).toBe('일');
  });

  it('윤년 2월 29일도 정확하다', () => {
    // 2028-02-29 는 화요일
    expect(WEEKDAY_NAMES[weekdayOf('2028-02-29')]).toBe('화');
  });

  it('일주일 뒤는 같은 요일이다', () => {
    expect(weekdayOf(addDays('2026-08-01', 7))).toBe(weekdayOf('2026-08-01'));
  });
});

describe('toPlainDate — KST 경계', () => {
  it('UTC 15:00 은 KST 로 다음날이다', () => {
    expect(toPlainDate(new Date('2026-08-10T15:00:00Z'))).toBe('2026-08-11');
  });

  it('1분 전은 아직 그날이다', () => {
    expect(toPlainDate(new Date('2026-08-10T14:59:00Z'))).toBe('2026-08-10');
  });

  it('연말 경계에서 해가 바뀐다', () => {
    expect(toPlainDate(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });
});
