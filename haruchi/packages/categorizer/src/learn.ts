/**
 * 교정 학습 루프 (스펙 4-3 "최우선 구현").
 *
 * 사용자가 카테고리를 한 번 고치면 다시는 같은 가맹점을 고치지 않아도 되어야 한다.
 * 그러려면 (1) 즉시 규칙을 만들고 (2) 과거 거래도 함께 바꿔줘야 한다.
 */
import type { NewUserRule } from './types.js';

/** 사용자 교정 규칙의 기본 우선순위. 시드/전역 규칙(100)보다 먼저 평가된다. */
export const CORRECTION_PRIORITY = 50;

/** 상호명 끝에 붙는 지점 표기 */
const BRANCH_SUFFIX = /(\d+호점|본점|직영점|지점|점)$/;

/**
 * 교정 즉시 만들 규칙.
 *
 * 정규화된 상호명 전체를 contains 패턴으로 쓴다. 넓게 잡으면 엉뚱한 가맹점까지
 * 끌려오고, 잘못 끌려온 분류는 사용자가 다시 고쳐야 한다. 좁게 시작하고
 * 넓히는 것은 사용자가 선택하게 한다 (suggestBroaderPattern).
 */
export function buildCorrectionRule(input: {
  merchantNormalized: string;
  categoryId: string;
  pattern?: string;
}): NewUserRule | null {
  const pattern = (input.pattern ?? input.merchantNormalized).trim();
  if (pattern.length === 0) return null;
  return {
    matchType: 'contains',
    pattern,
    categoryId: input.categoryId,
    priority: CORRECTION_PRIORITY,
    createdFrom: 'user_correction',
  };
}

/**
 * "스타벅스 전체에 적용할까요?" 를 제안할 수 있는 더 넓은 패턴.
 * 지점 표기를 떼어낸 결과가 원본과 다를 때만 의미가 있다.
 * 자동으로 적용하지 않는다 — 사용자가 명시적으로 고르게 한다.
 */
export function suggestBroaderPattern(merchantNormalized: string): string | null {
  const trimmed = merchantNormalized.replace(BRANCH_SUFFIX, '').trim();
  if (trimmed.length < 2) return null;
  if (trimmed === merchantNormalized) return null;
  return trimmed;
}

export interface HasMerchant {
  merchantNormalized: string | null;
}

/**
 * "같은 가맹점 과거 거래 N건도 함께 변경할까요?" 에 쓸 목록.
 * 기본 체크된 채로 제안되므로, 넓게 잡으면 사용자가 모르는 사이에 과거가 바뀐다.
 * 정확히 같은 정규화 상호명만 고른다.
 */
export function findSameMerchant<T extends HasMerchant>(
  merchantNormalized: string,
  transactions: readonly T[],
): T[] {
  if (merchantNormalized.length === 0) return [];
  return transactions.filter((tx) => tx.merchantNormalized === merchantNormalized);
}
