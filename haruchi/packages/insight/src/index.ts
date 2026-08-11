/**
 * @haruchi/insight — 리포트·인사이트 생성 (스펙 4-5).
 *
 * 규칙 기반으로만 만든다. LLM 으로 "당신은 커피를 많이 마시네요" 같은 문장을
 * 지어내지 않는다. 숫자가 스스로 말하게 한다.
 *
 * 순수 TypeScript. I/O 없음, 시계 읽지 않음.
 */
import { elapsedDaysIn, type CategoryTotal, type FiscalPeriod } from '@haruchi/budget';
import { differenceInDays, type PlainDate } from '@haruchi/schema';
import { compareCategories } from './compare.js';
import { noSpendStats, spendingPatterns } from './patterns.js';
import {
  DEFAULT_SUBSCRIPTION_CATEGORIES,
  detectRecurring,
  findDormantSubscriptions,
} from './recurring.js';
import type { Insight, InsightEntry, InsightKind, RecurringCandidate } from './types.js';

/**
 * 이 날짜가 지나야 인사이트를 보여준다 (스펙 4-5).
 * 월초 사흘 치 데이터로 만든 "인사이트"는 인사이트가 아니라 착각이다.
 */
export const MIN_ELAPSED_DAYS = 8;

/** 무지출일을 말할 만한 최소치 */
const MIN_NO_SPEND_DAYS = 3;
/** 심야 지출을 말할 만한 최소 건수와 비중 */
const MIN_LATE_NIGHT_COUNT = 3;
const MIN_LATE_NIGHT_PERCENT = 15;

export interface BuildInsightsInput {
  /** 이번 회계월 거래 */
  entries: readonly InsightEntry[];
  /** 정기결제 탐지에 쓸 더 긴 기간의 거래 (기본값: entries) */
  history?: readonly InsightEntry[];
  period: FiscalPeriod;
  today: PlainDate;
  /** 이번 회계월 카테고리별 지출 */
  currentTotals: readonly CategoryTotal[];
  /** 지난 회계월 카테고리별 지출 */
  previousTotals?: readonly CategoryTotal[];
  /** 이미 사용자가 확인한 정기결제. 같은 말을 반복하지 않는다. */
  knownRecurring?: readonly string[];
  /** 미사용 의심을 적용할 카테고리. 기본값은 구독뿐이다. */
  subscriptionCategories?: readonly string[];
  /** 카테고리 표시 이름. 없으면 키를 그대로 쓴다. */
  categoryNames?: Readonly<Record<string, string>>;
}

/** 종류별 노출 우선순위. 클수록 위에 온다. */
const PRIORITY: Record<InsightKind, number> = {
  dormant_subscription: 5,
  category_increase: 4,
  late_night_spending: 3,
  recurring_detected: 2,
  category_decrease: 1,
  no_spend_streak: 0,
};

export function buildInsights(input: BuildInsightsInput): Insight[] {
  // 데이터 없이 억지 인사이트를 만들지 않는다.
  if (elapsedDaysIn(input.period, input.today) < MIN_ELAPSED_DAYS) return [];
  if (input.entries.length === 0) return [];

  const names = input.categoryNames ?? {};
  const label = (key: string | null): string => (key === null ? '미분류' : (names[key] ?? key));

  const insights: Insight[] = [];

  // 1. 전월 대비 카테고리 증감
  if (input.previousTotals) {
    for (const change of compareCategories(input.currentTotals, input.previousTotals)) {
      const increased = change.change > 0;
      insights.push({
        kind: increased ? 'category_increase' : 'category_decrease',
        headline: `${label(change.categoryKey)}이(가) 지난달보다 ${formatWon(Math.abs(change.change))} ${
          increased ? '늘었어요' : '줄었어요'
        }${formatRatio(change.changeRatio)}`,
        weight: Math.abs(change.change),
        categoryKey: change.categoryKey,
        amount: change.change,
        changeRatio: change.changeRatio,
      });
    }
  }

  // 2. 정기결제 탐지 + 미사용 의심 구독
  const history = input.history ?? input.entries;
  const known = new Set(input.knownRecurring ?? []);
  const recurring = detectRecurring(history);
  const dormant = new Set(
    findDormantSubscriptions(
      recurring,
      history,
      input.today,
      input.subscriptionCategories ?? DEFAULT_SUBSCRIPTION_CATEGORIES,
    ).map((candidate) => candidate.merchantNormalized),
  );

  for (const candidate of recurring) {
    if (dormant.has(candidate.merchantNormalized)) {
      const months = Math.floor(differenceInDays(candidate.firstSeen, input.today) / 30);
      insights.push({
        kind: 'dormant_subscription',
        // "안 쓰고 있다"고 단정하지 않는다. 확인은 사용자 몫이다.
        headline: `${candidate.merchantNormalized} ${formatWon(candidate.amount)}을(를) ${months}개월째 내고 있는데, 그동안 같은 분야 지출이 이것뿐이에요`,
        weight: candidate.amount * 12,
        merchantNormalized: candidate.merchantNormalized,
        categoryKey: candidate.categoryKey,
        amount: candidate.amount,
        count: candidate.occurrences,
      });
      continue;
    }
    if (known.has(candidate.merchantNormalized)) continue;
    insights.push({
      kind: 'recurring_detected',
      headline: `${candidate.merchantNormalized} ${formatWon(candidate.amount)}이(가) ${candidate.intervalDays}일마다 나가고 있어요`,
      weight: candidate.amount,
      merchantNormalized: candidate.merchantNormalized,
      categoryKey: candidate.categoryKey,
      amount: candidate.amount,
      count: candidate.occurrences,
    });
  }

  // 3. 무지출일
  const noSpend = noSpendStats(input.entries, input.period, input.today);
  if (noSpend.noSpendDays >= MIN_NO_SPEND_DAYS) {
    insights.push({
      kind: 'no_spend_streak',
      headline: `${noSpend.observedDays}일 중 ${noSpend.noSpendDays}일은 한 푼도 안 썼어요. 최장 연속 ${noSpend.longestStreak}일이에요`,
      weight: noSpend.noSpendDays,
      days: noSpend.noSpendDays,
      count: noSpend.longestStreak,
    });
  }

  // 4. 심야 지출
  const patterns = spendingPatterns(input.entries, input.period);
  if (
    patterns.lateNightCount >= MIN_LATE_NIGHT_COUNT &&
    patterns.lateNightAmount * 100 >= patterns.totalAmount * MIN_LATE_NIGHT_PERCENT
  ) {
    const percent = Math.round((patterns.lateNightAmount * 100) / patterns.totalAmount);
    insights.push({
      kind: 'late_night_spending',
      headline: `자정~새벽 5시 사이에 ${patterns.lateNightCount}번, ${formatWon(patterns.lateNightAmount)}을(를) 썼어요. 이번 달 지출의 ${percent}%예요`,
      weight: patterns.lateNightAmount,
      amount: patterns.lateNightAmount,
      count: patterns.lateNightCount,
    });
  }

  return insights.sort(
    (a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || b.weight - a.weight || a.headline.localeCompare(b.headline),
  );
}

/**
 * 천 단위 구분. Intl 에 의존하지 않는다 — 런타임의 ICU 유무에 따라
 * 결과가 달라지면 안 되기 때문이다.
 */
export function formatWon(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(amount));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

function formatRatio(ratio: number | null): string {
  // 이전 기간이 0 이면 비율을 말할 수 없다. "무한 % 증가" 같은 표기를 만들지 않는다.
  if (ratio === null) return '';
  const percent = Math.round(Math.abs(ratio) * 100);
  return ` (${ratio > 0 ? '+' : '-'}${percent}%)`;
}

export {
  MAX_CHANGES,
  MIN_CHANGE_AMOUNT,
  MIN_CHANGE_RATIO,
  compareCategories,
} from './compare.js';
export {
  LATE_NIGHT_END_HOUR,
  LATE_NIGHT_START_HOUR,
  noSpendStats,
  spendingPatterns,
} from './patterns.js';
export {
  AMOUNT_TOLERANCE_PERCENT,
  DEFAULT_SUBSCRIPTION_CATEGORIES,
  DORMANT_MIN_AGE_DAYS,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS,
  MIN_OCCURRENCES,
  detectRecurring,
  findDormantSubscriptions,
  isSimilarAmount,
} from './recurring.js';
export type {
  CategoryChange,
  Insight,
  InsightEntry,
  InsightKind,
  NoSpendStats,
  RecurringCandidate,
  SpendingPatterns,
  WeekdayTotal,
} from './types.js';
