/**
 * 회계월 (스펙 4-4 항목 4).
 *
 * 월급날이 25일이면 "8월"은 7/25~8/24 다. 모든 집계가 이 기준을 따라야 한다.
 * 그래서 기간을 만드는 입구를 getFiscalPeriod 하나로 좁히고, 다른 함수들은
 * FiscalPeriod 를 인자로 받게 했다. 달력 계산이 여기저기 흩어지면 어느 한 곳이
 * 하루 밀려도 아무도 모른다.
 */
import {
  addDays,
  addMonths,
  differenceInDays,
  formatPlainDate,
  parsePlainDate,
  toPlainDate,
  type PlainDate,
} from '@haruchi/schema';

export interface FiscalPeriod {
  /** 시작일 (포함) */
  start: PlainDate;
  /** 종료일 (포함) */
  end: PlainDate;
  /** 이 기간을 부르는 이름의 연도·월. 종료일이 속한 달을 쓴다. */
  year: number;
  month: number;
  /** "2026-08" */
  key: string;
  /** "8월" */
  label: string;
  totalDays: number;
}

/**
 * 회계월 시작일은 1~28 만 허용한다.
 * 29~31 은 없는 달이 생겨 기간이 조용히 어긋난다 (DB 도 같은 제약을 건다).
 */
export function assertStartDay(startDay: number): void {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
    throw new RangeError(`회계월 시작일은 1~28 사이의 정수여야 합니다: ${startDay}`);
  }
}

/** 이 날짜가 속한 회계월. */
export function getFiscalPeriod(date: PlainDate, startDay: number): FiscalPeriod {
  assertStartDay(startDay);
  const { year, month, day } = parsePlainDate(date);

  const anchor = formatPlainDate({ year, month, day: startDay });
  // 시작일 전이라면 아직 지난달 회계월 안에 있다.
  const start = day >= startDay ? anchor : addMonths(anchor, -1);
  const end = addDays(addMonths(start, 1), -1);
  const endParts = parsePlainDate(end);

  return {
    start,
    end,
    year: endParts.year,
    month: endParts.month,
    key: `${endParts.year}-${String(endParts.month).padStart(2, '0')}`,
    label: `${endParts.month}월`,
    totalDays: differenceInDays(start, end) + 1,
  };
}

/** UTC 시각으로부터 회계월을 구한다. KST 날짜로 옮긴 뒤 계산한다. */
export function getFiscalPeriodAt(instant: Date, startDay: number): FiscalPeriod {
  return getFiscalPeriod(toPlainDate(instant), startDay);
}

/** 회계월 스위처용. 한 달 앞/뒤 기간. */
export function nextFiscalPeriod(period: FiscalPeriod, startDay: number): FiscalPeriod {
  return getFiscalPeriod(addDays(period.end, 1), startDay);
}

export function previousFiscalPeriod(period: FiscalPeriod, startDay: number): FiscalPeriod {
  return getFiscalPeriod(addDays(period.start, -1), startDay);
}

export function periodContains(period: FiscalPeriod, date: PlainDate): boolean {
  return date >= period.start && date <= period.end;
}

/**
 * 기간 안에서 오늘까지 지난 일수 (당일 포함).
 * 기간 밖이면 양 끝으로 잘라낸다 — 지난 달을 볼 때도 계산이 성립해야 한다.
 */
export function elapsedDaysIn(period: FiscalPeriod, today: PlainDate): number {
  if (today < period.start) return 0;
  if (today > period.end) return period.totalDays;
  return differenceInDays(period.start, today) + 1;
}

/**
 * 오늘 포함 남은 일수. 최소 1 이다.
 * 0 이 되면 하루 가용액 계산에서 0 으로 나누게 된다.
 */
export function remainingDaysIn(period: FiscalPeriod, today: PlainDate): number {
  if (today > period.end) return 1;
  const from = today < period.start ? period.start : today;
  return Math.max(1, differenceInDays(from, period.end) + 1);
}
