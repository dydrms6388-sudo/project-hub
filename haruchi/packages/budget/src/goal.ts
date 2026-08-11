/**
 * 절약 목표 역산 (스펙 4-4 항목 3).
 *
 * "목표를 달성하려면 어느 카테고리를 얼마 줄여야 하는가"에 답한다.
 * 답이 "불가능"일 때 그렇게 말하는 것이 이 함수의 절반이다.
 * 거짓 희망을 주는 UI 는 만들지 않는다.
 */
import { addMonths, differenceInMonths, type PlainDate } from '@haruchi/schema';

export interface CategorySpending {
  /** 시스템 카테고리 슬러그 또는 원장 카테고리 id */
  category: string;
  /** 표시용 이름 */
  name: string;
  /** 최근 3개월 평균 월 지출 (원, 양수) */
  current: number;
  /** 고정비는 삭감 대상에서 뺀다. 월세를 30% 깎으라는 제안은 무의미하다. */
  isFixed: boolean;
}

export interface Cut {
  category: string;
  name: string;
  current: number;
  /** 이만큼까지 줄이자는 제안 */
  suggested: number;
  /** 줄이는 금액 */
  cut: number;
}

export interface CutPlan {
  cuts: Cut[];
  totalCut: number;
}

/** 카테고리당 삭감 상한 비율. 이보다 크게 제안하면 아무도 따르지 않는다. */
export const DEFAULT_MAX_CUT_RATIO = 0.3;

/**
 * 지출이 큰 변동비부터 필요한 만큼 깎아 배분한다.
 *
 * 카테고리마다 상한이 있어서(기본 30%) 한 곳에 몰아넣지 않는다.
 * 내림을 쓴다 — 상한을 넘는 제안을 하지 않기 위해서다.
 */
export function allocateCuts(
  categories: readonly CategorySpending[],
  need: number,
  maxRatio: number = DEFAULT_MAX_CUT_RATIO,
): CutPlan {
  if (need <= 0) return { cuts: [], totalCut: 0 };

  const candidates = categories
    .filter((category) => !category.isFixed && category.current > 0)
    .slice()
    .sort((a, b) => b.current - a.current || a.category.localeCompare(b.category));

  const cuts: Cut[] = [];
  let remaining = need;
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const capacity = Math.floor(candidate.current * maxRatio);
    const cut = Math.min(capacity, remaining);
    if (cut <= 0) continue;
    cuts.push({
      category: candidate.category,
      name: candidate.name,
      current: candidate.current,
      suggested: candidate.current - cut,
      cut,
    });
    remaining -= cut;
  }

  return { cuts, totalCut: cuts.reduce((sum, cut) => sum + cut.cut, 0) };
}

/** 변동비를 상한까지 전부 깎았을 때 만들 수 있는 최대 금액 */
export function maxCutCapacity(
  categories: readonly CategorySpending[],
  maxRatio: number = DEFAULT_MAX_CUT_RATIO,
): number {
  return categories
    .filter((category) => !category.isFixed && category.current > 0)
    .reduce((sum, category) => sum + Math.floor(category.current * maxRatio), 0);
}

export interface GoalPlanInput {
  /** 목표 금액 (원) */
  target: number;
  /** 이미 모은 금액 (원) */
  saved: number;
  targetDate: PlainDate;
  today: PlainDate;
  /** 최근 월 평균 흑자 (수입 - 지출). 음수일 수 있다. */
  recentMonthlySurplus: number;
  categorySpending: readonly CategorySpending[];
  maxCutRatio?: number;
}

export interface AlternativeDeadline {
  /** 오늘로부터 몇 개월 */
  months: number;
  targetDate: PlainDate;
  requiredMonthly: number;
}

export interface GoalPlan {
  /** 지출 조정만으로 달성 가능한가 */
  feasible: boolean;
  /** 이미 목표를 채웠는가 */
  alreadyAchieved: boolean;
  monthsLeft: number;
  /** 매달 필요한 금액 */
  requiredMonthly: number;
  /** 지금 흑자로 부족한 금액 */
  gap: number;
  cuts: Cut[];
  totalCut: number;
  /** 삭감을 최대로 해도 모자라는 금액 */
  shortfall: number;
  /**
   * 기한 안에 불가능할 때 제시할 대안 기한.
   * 지출을 최대로 조정해도 영영 못 모으는 목표라면 null 이다.
   * 없는 희망을 만들어 보여주지 않는다.
   */
  alternative: AlternativeDeadline | null;
}

export function goalPlan(input: GoalPlanInput): GoalPlan {
  const maxRatio = input.maxCutRatio ?? DEFAULT_MAX_CUT_RATIO;
  const need = input.target - input.saved;

  if (need <= 0) {
    return {
      feasible: true,
      alreadyAchieved: true,
      monthsLeft: 0,
      requiredMonthly: 0,
      gap: 0,
      cuts: [],
      totalCut: 0,
      shortfall: 0,
      alternative: null,
    };
  }

  const monthsLeft = Math.max(1, differenceInMonths(input.today, input.targetDate));
  // 올림한다. 내림하면 마지막 달에 모자란다.
  const requiredMonthly = Math.ceil(need / monthsLeft);
  const gap = requiredMonthly - input.recentMonthlySurplus;

  if (gap <= 0) {
    return {
      feasible: true,
      alreadyAchieved: false,
      monthsLeft,
      requiredMonthly,
      gap,
      cuts: [],
      totalCut: 0,
      shortfall: 0,
      alternative: null,
    };
  }

  const plan = allocateCuts(input.categorySpending, gap, maxRatio);
  const feasible = plan.totalCut >= gap;
  const shortfall = Math.max(0, gap - plan.totalCut);

  return {
    feasible,
    alreadyAchieved: false,
    monthsLeft,
    requiredMonthly,
    gap,
    cuts: plan.cuts,
    totalCut: plan.totalCut,
    shortfall,
    alternative: feasible
      ? null
      : findAlternativeDeadline(need, input, maxRatio, monthsLeft),
  };
}

/**
 * "기한을 N개월 늦추면 가능해요" 를 계산한다.
 *
 * 흑자에 최대 삭감분을 더한 것이 매달 모을 수 있는 상한이다.
 * 그게 0 이하라면 기한을 아무리 늘려도 못 모은다 — 그때는 null 을 돌려주고,
 * UI 가 "지출 조정만으로는 어렵다"고 솔직하게 말하게 한다.
 */
function findAlternativeDeadline(
  need: number,
  input: GoalPlanInput,
  maxRatio: number,
  monthsLeft: number,
): AlternativeDeadline | null {
  const capacity = maxCutCapacity(input.categorySpending, maxRatio);
  const maxMonthly = input.recentMonthlySurplus + capacity;
  if (maxMonthly <= 0) return null;

  const months = Math.ceil(need / maxMonthly);
  if (months <= monthsLeft) return null;

  return {
    months,
    targetDate: addMonths(input.today, months),
    requiredMonthly: Math.ceil(need / months),
  };
}
