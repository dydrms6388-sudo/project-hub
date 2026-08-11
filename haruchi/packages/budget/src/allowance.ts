/**
 * 하루 가용액과 소비 속도 (스펙 4-4 항목 1·2).
 *
 * 이 두 숫자가 대시보드의 전부다. 1원이라도 틀리면 사용자는 앱을 지운다.
 * 전부 정수 연산이고, 나눗셈은 곱셈을 먼저 해서 정밀도 손실을 줄인다.
 */
import type { PlainDate } from '@haruchi/schema';
import { elapsedDaysIn, remainingDaysIn, type FiscalPeriod } from './fiscal.js';

export interface DailyAllowanceInput {
  /** 이 회계월의 총예산 (원) */
  budget: number;
  /** 이 회계월에 이미 쓴 돈 (원, 양수) */
  spent: number;
  today: PlainDate;
  period: FiscalPeriod;
}

export interface DailyAllowance {
  /** 오늘 쓸 수 있는 돈. 예산을 넘겼으면 음수다. */
  amount: number;
  /** 남은 예산 */
  remaining: number;
  /** 오늘 포함 남은 일수 */
  remainingDays: number;
  isOver: boolean;
}

/**
 * 남은 예산을 남은 일수로 나눈다.
 *
 * 내림을 쓴다. 올림하면 매일 조금씩 더 써도 된다고 말하는 셈이고, 월말에
 * 예산을 넘긴다. 사용자에게 불리한 쪽이 아니라 안전한 쪽으로 반올림한다.
 */
export function dailyAllowance(input: DailyAllowanceInput): DailyAllowance {
  const remaining = input.budget - input.spent;
  const remainingDays = remainingDaysIn(input.period, input.today);
  return {
    amount: Math.floor(remaining / remainingDays),
    remaining,
    remainingDays,
    isOver: remaining < 0,
  };
}

export type BurnStatus = 'ok' | 'tight' | 'over';

export interface BurnRateInput {
  /** 변동비 지출 (원, 양수). 고정비는 여기 넣지 않는다. */
  variableSpent: number;
  /** 이미 결제된 고정비 (원, 양수) */
  fixedSpent: number;
  /**
   * 아직 결제되지 않았지만 이번 달에 나갈 고정비.
   * 정기결제 탐지(Phase 4)가 채워줄 자리다. 지금은 0 이라 예상치가 보수적으로
   * 낮게 나온다 — 없는 값을 지어내는 것보다 낫다.
   */
  expectedRemainingFixed?: number;
  budget: number;
  today: PlainDate;
  period: FiscalPeriod;
}

export interface BurnRate {
  /** 이 속도면 월말에 이만큼 쓴다 */
  projected: number;
  status: BurnStatus;
  elapsedDays: number;
  /** 변동비만 본 하루 평균 */
  variablePerDay: number;
}

/**
 * 소비 속도로 월말 지출을 추정한다.
 *
 * 고정비를 속도 계산에 넣으면 안 된다. 월세가 1일에 빠져나가면 "하루 평균"이
 * 폭등해서 "월말 예상 800만원" 같은 헛소리가 나온다. 고정비는 비율이 아니라
 * 금액 그대로 더한다.
 */
export function burnRate(input: BurnRateInput): BurnRate {
  const elapsedDays = Math.max(1, elapsedDaysIn(input.period, input.today));
  const totalDays = input.period.totalDays;
  const expectedRemainingFixed = input.expectedRemainingFixed ?? 0;

  // 곱셈을 먼저 해서 나눗셈 한 번으로 끝낸다. 원 단위 정수 범위에서 안전하다.
  const projectedVariable = Math.round((input.variableSpent * totalDays) / elapsedDays);
  const projected = projectedVariable + input.fixedSpent + expectedRemainingFixed;

  return {
    projected,
    status: classify(projected, input.budget),
    elapsedDays,
    variablePerDay: Math.round(input.variableSpent / elapsedDays),
  };
}

/**
 * 예산 대비 5% 를 경계로 삼는다.
 * 예산이 0 이하면 비교할 기준이 없다 — 쓴 게 있으면 초과로 본다.
 */
function classify(projected: number, budget: number): BurnStatus {
  if (budget <= 0) return projected > 0 ? 'over' : 'ok';
  if (projected * 100 > budget * 105) return 'over';
  if (projected * 100 > budget * 95) return 'tight';
  return 'ok';
}
