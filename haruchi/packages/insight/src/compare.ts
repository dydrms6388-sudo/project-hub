/**
 * 전월 대비 카테고리 증감 (스펙 4-5).
 *
 * 증감액 5만원 이상 & 20% 이상일 때만 말한다. 그보다 작은 변화는 노이즈고,
 * 노이즈를 인사이트라고 보여주면 사용자는 인사이트 영역 전체를 무시하게 된다.
 */
import type { CategoryTotal } from '@haruchi/budget';
import type { CategoryChange } from './types.js';

/** 이 금액 미만의 변화는 말하지 않는다 */
export const MIN_CHANGE_AMOUNT = 50_000;
/** 이 비율 미만의 변화는 말하지 않는다 */
export const MIN_CHANGE_RATIO = 0.2;
/** 상위 몇 개까지 */
export const MAX_CHANGES = 3;

/**
 * 두 기간의 카테고리별 지출을 비교한다.
 *
 * 이전 기간에 없던 카테고리는 비율을 말할 수 없으므로 changeRatio 가 null 이다.
 * 이때는 금액 기준만 적용한다 — "무한 % 증가" 같은 표기를 만들지 않는다.
 */
export function compareCategories(
  current: readonly CategoryTotal[],
  previous: readonly CategoryTotal[],
  options: { minAmount?: number; minRatio?: number; limit?: number } = {},
): CategoryChange[] {
  const minAmount = options.minAmount ?? MIN_CHANGE_AMOUNT;
  const minRatio = options.minRatio ?? MIN_CHANGE_RATIO;
  const limit = options.limit ?? MAX_CHANGES;

  const previousByKey = new Map(previous.map((total) => [total.categoryKey ?? '', total.amount]));
  const currentByKey = new Map(current.map((total) => [total.categoryKey ?? '', total.amount]));
  const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);

  const changes: CategoryChange[] = [];
  for (const key of keys) {
    const currentAmount = currentByKey.get(key) ?? 0;
    const previousAmount = previousByKey.get(key) ?? 0;
    const change = currentAmount - previousAmount;
    if (Math.abs(change) < minAmount) continue;

    const changeRatio = previousAmount === 0 ? null : change / previousAmount;
    // 비율을 말할 수 있는 경우에만 비율 기준을 적용한다.
    if (changeRatio !== null && Math.abs(changeRatio) < minRatio) continue;

    changes.push({
      categoryKey: key === '' ? null : key,
      current: currentAmount,
      previous: previousAmount,
      change,
      changeRatio,
    });
  }

  return changes
    .sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        (a.categoryKey ?? '').localeCompare(b.categoryKey ?? ''),
    )
    .slice(0, limit);
}
