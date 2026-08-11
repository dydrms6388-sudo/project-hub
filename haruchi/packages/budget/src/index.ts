/**
 * @haruchi/budget — 예산·목표 계산 엔진 (스펙 4-4).
 *
 * 순수 TypeScript, 전부 순수 함수. React/Next/Supabase 에 의존하지 않고 I/O 도 없다.
 * "지금"은 언제나 인자로 받는다 — 시스템 시계도 타임존도 읽지 않는다.
 *
 * 이 계산이 제품의 핵심 가치다. 금액은 전부 원 단위 정수이고,
 * 반올림은 언제나 사용자에게 안전한 쪽으로 한다.
 */
export {
  assertStartDay,
  elapsedDaysIn,
  getFiscalPeriod,
  getFiscalPeriodAt,
  nextFiscalPeriod,
  periodContains,
  previousFiscalPeriod,
  remainingDaysIn,
  type FiscalPeriod,
} from './fiscal.js';

export {
  burnRate,
  dailyAllowance,
  type BurnRate,
  type BurnRateInput,
  type BurnStatus,
  type DailyAllowance,
  type DailyAllowanceInput,
} from './allowance.js';

export {
  DEFAULT_MAX_CUT_RATIO,
  allocateCuts,
  goalPlan,
  maxCutCapacity,
  type AlternativeDeadline,
  type CategorySpending,
  type Cut,
  type CutPlan,
  type GoalPlan,
  type GoalPlanInput,
} from './goal.js';

export {
  summarizeSpending,
  type CategoryTotal,
  type SpendingEntry,
  type SpendingSummary,
} from './spending.js';
