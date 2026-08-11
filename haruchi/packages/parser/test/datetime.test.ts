import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  isRealDate,
  kstStampDay,
  kstStampMinute,
  resolveKstDate,
  toKstParts,
} from '../src/lib/datetime.js';

/** KST 2026-08-20 12:00 */
const NOW = new Date('2026-08-20T03:00:00.000Z');

describe('toKstParts', () => {
  it('UTC 를 KST 달력 필드로 옮긴다', () => {
    expect(toKstParts(new Date('2026-08-11T03:30:00.000Z'))).toEqual({
      year: 2026,
      month: 8,
      day: 11,
      hour: 12,
      minute: 30,
    });
  });

  it('UTC 15:00 은 KST 로 다음날 00:00 이다', () => {
    expect(toKstParts(new Date('2026-08-10T15:00:00.000Z'))).toMatchObject({
      month: 8,
      day: 11,
      hour: 0,
    });
  });

  it('연말 경계에서 해가 바뀐다', () => {
    expect(toKstParts(new Date('2025-12-31T15:00:00.000Z'))).toMatchObject({
      year: 2026,
      month: 1,
      day: 1,
    });
  });
});

describe('daysInMonth / isRealDate', () => {
  it('윤년 2월은 29일이다', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('평년 2월은 28일이다', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('100으로 나뉘고 400으로 안 나뉘는 해는 평년이다', () => {
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it('존재하지 않는 날짜를 걸러낸다', () => {
    expect(isRealDate(2026, 2, 29)).toBe(false);
    expect(isRealDate(2026, 4, 31)).toBe(false);
    expect(isRealDate(2026, 13, 1)).toBe(false);
    expect(isRealDate(2026, 0, 1)).toBe(false);
    expect(isRealDate(2026, 8, 0)).toBe(false);
    expect(isRealDate(2026, 8, 11)).toBe(true);
  });
});

describe('resolveKstDate', () => {
  it('연도가 없으면 올해로 본다', () => {
    expect(resolveKstDate({ month: 8, day: 11, hour: 12, minute: 30, now: NOW })).toMatchObject({
      occurredAt: '2026-08-11T03:30:00.000Z',
      hasTime: true,
      plainDate: '2026-08-11',
    });
  });

  it('결과가 미래면 작년으로 보정한다', () => {
    expect(resolveKstDate({ month: 12, day: 25, hour: 18, minute: 0, now: NOW })).toMatchObject({
      plainDate: '2025-12-25',
    });
  });

  it('하루 정도의 미래는 올해로 남긴다 (발신·붙여넣기 시각 오차)', () => {
    expect(resolveKstDate({ month: 8, day: 20, hour: 23, minute: 59, now: NOW })).toMatchObject({
      plainDate: '2026-08-20',
    });
  });

  it('시각이 없으면 KST 00:00 으로 두고 hasTime=false', () => {
    expect(resolveKstDate({ month: 8, day: 11, now: NOW })).toMatchObject({
      occurredAt: '2026-08-10T15:00:00.000Z',
      hasTime: false,
    });
  });

  it('원문에 연도가 있으면 추정하지 않는다', () => {
    expect(
      resolveKstDate({ year: 2023, month: 8, day: 11, hour: 12, minute: 30, now: NOW }),
    ).toMatchObject({ plainDate: '2023-08-11' });
  });

  it('두 자리 연도는 2000년대로 읽는다', () => {
    expect(resolveKstDate({ year: 24, month: 2, day: 29, now: NOW })).toMatchObject({
      plainDate: '2024-02-29',
    });
  });

  it('평년 2월 29일은 추측하지 않고 실패시킨다', () => {
    expect(resolveKstDate({ month: 2, day: 29, hour: 12, minute: 0, now: NOW })).toBeNull();
  });

  it('불가능한 시각은 실패시킨다', () => {
    expect(resolveKstDate({ month: 8, day: 11, hour: 25, minute: 0, now: NOW })).toBeNull();
    expect(resolveKstDate({ month: 8, day: 11, hour: 12, minute: 60, now: NOW })).toBeNull();
  });

  it('숫자가 아닌 토큰은 실패시킨다', () => {
    expect(resolveKstDate({ month: Number.NaN, day: 11, now: NOW })).toBeNull();
  });

  it('윤년 안에서 지난 2월 29일은 정상으로 읽는다', () => {
    // KST 2024-06-01 기준 02/29 → 이미 지난 날짜이므로 2024-02-29
    const afterLeapDay = new Date('2024-06-01T03:00:00.000Z');
    expect(resolveKstDate({ month: 2, day: 29, now: afterLeapDay })).toMatchObject({
      plainDate: '2024-02-29',
    });
  });

  it('작년으로 보정하면 존재하지 않는 날짜가 되는 경우 실패시킨다', () => {
    // KST 2024-01-10 기준 02/29 는 미래 → 2023 으로 보정되지만 2023 은 평년이다.
    // 2024-02-29 로 밀어 넣으면 "미래 거래"를 만들어내므로 읽지 않는 편이 맞다.
    const beforeLeapDay = new Date('2024-01-10T03:00:00.000Z');
    expect(resolveKstDate({ month: 2, day: 29, now: beforeLeapDay })).toBeNull();
  });
});

describe('dedupe 용 시각 스탬프', () => {
  it('분 단위 스탬프는 KST 기준이다', () => {
    expect(kstStampMinute('2026-08-11T03:30:00.000Z')).toBe('202608111230');
  });

  it('일 단위 스탬프는 KST 기준이다', () => {
    expect(kstStampDay('2026-08-10T15:00:00.000Z')).toBe('20260811');
  });
});
