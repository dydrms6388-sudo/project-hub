import type { SpendingEntry } from '@haruchi/budget';
import type { PlainDate } from '@haruchi/schema';

/** 인사이트 계산에 쓰는 거래. 예산 집계 입력에 상호명이 더해진 형태다. */
export interface InsightEntry extends SpendingEntry {
  merchantNormalized: string;
}

export type InsightKind =
  | 'category_increase'
  | 'category_decrease'
  | 'recurring_detected'
  | 'dormant_subscription'
  | 'no_spend_streak'
  | 'late_night_spending';

/**
 * 인사이트는 구조화된 사실이다.
 *
 * headline 은 고정된 템플릿으로 만든다. LLM 으로 "당신은 커피를 많이 마시네요"
 * 같은 문장을 지어내지 않는다 (스펙 4-5). 숫자가 스스로 말하게 한다.
 */
export interface Insight {
  kind: InsightKind;
  /** 결정적 템플릿으로 만든 한 줄 */
  headline: string;
  /** 정렬용. 클수록 먼저 보여준다. */
  weight: number;
  categoryKey?: string | null;
  merchantNormalized?: string;
  amount?: number;
  /** 증감 비율. 이전 기간이 0 이면 null (비율을 말할 수 없다). */
  changeRatio?: number | null;
  days?: number;
  count?: number;
}

export interface RecurringCandidate {
  merchantNormalized: string;
  /** 대표 금액 (관측값의 중앙값) */
  amount: number;
  /** 결제 간격 (일). 관측 간격의 중앙값. */
  intervalDays: number;
  /** 다음 결제 예상일 */
  nextExpectedOn: PlainDate;
  firstSeen: PlainDate;
  lastSeen: PlainDate;
  occurrences: number;
  /** 0.50 ~ 0.95. DB 는 numeric(3,2) 라 소수점 둘째 자리까지만 쓴다. */
  confidence: number;
  categoryKey: string | null;
}

export interface CategoryChange {
  categoryKey: string | null;
  current: number;
  previous: number;
  /** 현재 - 이전. 양수면 늘어난 것. */
  change: number;
  /** 이전이 0 이면 null */
  changeRatio: number | null;
}

export interface NoSpendStats {
  /** 무지출일 수 (오늘까지) */
  noSpendDays: number;
  /** 최장 연속 무지출일 */
  longestStreak: number;
  /** 현재 이어지고 있는 연속 무지출일 */
  currentStreak: number;
  /** 집계 대상이 된 날 수 */
  observedDays: number;
}

export interface WeekdayTotal {
  /** 0=일 … 6=토 */
  weekday: number;
  name: string;
  amount: number;
  count: number;
}

export interface SpendingPatterns {
  byWeekday: WeekdayTotal[];
  /** 00:00~04:59 KST 지출 */
  lateNightAmount: number;
  lateNightCount: number;
  totalAmount: number;
  totalCount: number;
}
