/**
 * 무지출일과 지출 패턴 (스펙 4-5).
 *
 * 요일별·시간대별 패턴은 "실제로 유용한 것"만 남긴다. 모든 요일의 합계를
 * 나열하는 것은 인사이트가 아니라 표다.
 */
import { periodContains, type FiscalPeriod } from '@haruchi/budget';
import {
  WEEKDAY_NAMES,
  addDays,
  differenceInDays,
  toKstParts,
  toPlainDate,
  weekdayOf,
  type PlainDate,
} from '@haruchi/schema';
import type { InsightEntry, NoSpendStats, SpendingPatterns } from './types.js';

/** 심야로 보는 시간대 (KST). 편의점·배달 심야 지출을 잡는다. */
export const LATE_NIGHT_START_HOUR = 0;
export const LATE_NIGHT_END_HOUR = 5;

function isCountableExpense(entry: InsightEntry): boolean {
  return !entry.isExcluded && entry.kind === 'expense' && !entry.isCancellation;
}

/**
 * 무지출일 집계.
 *
 * 아직 오지 않은 날을 무지출일로 세지 않는다. 월초에 "무지출 25일!" 이라고
 * 말하면 그건 거짓말이다.
 */
export function noSpendStats(
  entries: readonly InsightEntry[],
  period: FiscalPeriod,
  today: PlainDate,
): NoSpendStats {
  const lastDay = today < period.end ? today : period.end;
  if (lastDay < period.start) {
    return { noSpendDays: 0, longestStreak: 0, currentStreak: 0, observedDays: 0 };
  }

  const spentOn = new Set<PlainDate>();
  for (const entry of entries) {
    if (!isCountableExpense(entry)) continue;
    const date = toPlainDate(new Date(entry.occurredAt));
    if (!periodContains(period, date)) continue;
    if (date > lastDay) continue;
    spentOn.add(date);
  }

  const observedDays = differenceInDays(period.start, lastDay) + 1;
  let noSpendDays = 0;
  let longestStreak = 0;
  let currentStreak = 0;

  let cursor = period.start;
  for (let i = 0; i < observedDays; i++) {
    if (spentOn.has(cursor)) {
      currentStreak = 0;
    } else {
      noSpendDays += 1;
      currentStreak += 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    }
    cursor = addDays(cursor, 1);
  }

  return { noSpendDays, longestStreak, currentStreak, observedDays };
}

/**
 * 요일·시간대 지출 패턴.
 * 요일과 시각은 반드시 KST 로 계산한다 — UTC 로 세면 심야 지출이 저녁으로 옮겨간다.
 */
export function spendingPatterns(
  entries: readonly InsightEntry[],
  period: FiscalPeriod,
): SpendingPatterns {
  const byWeekday = WEEKDAY_NAMES.map((name, weekday) => ({
    weekday,
    name,
    amount: 0,
    count: 0,
  }));

  let lateNightAmount = 0;
  let lateNightCount = 0;
  let totalAmount = 0;
  let totalCount = 0;

  for (const entry of entries) {
    if (!isCountableExpense(entry)) continue;
    const instant = new Date(entry.occurredAt);
    const date = toPlainDate(instant);
    if (!periodContains(period, date)) continue;

    const bucket = byWeekday[weekdayOf(date)];
    if (bucket) {
      bucket.amount += entry.amount;
      bucket.count += 1;
    }

    totalAmount += entry.amount;
    totalCount += 1;

    const { hour } = toKstParts(instant);
    if (hour >= LATE_NIGHT_START_HOUR && hour < LATE_NIGHT_END_HOUR) {
      lateNightAmount += entry.amount;
      lateNightCount += 1;
    }
  }

  return { byWeekday, lateNightAmount, lateNightCount, totalAmount, totalCount };
}
