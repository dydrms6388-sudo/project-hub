/**
 * 회계월 집계.
 *
 * 대시보드가 쓰는 모든 숫자가 여기서 나온다. 취소·이체·통계제외를 어떻게
 * 다루는지가 전부 이 파일 안에 있어서, 어긋나면 한 곳만 고치면 된다.
 */
import { signedAmount, toPlainDate, type TransactionKind } from '@haruchi/schema';
import { periodContains, type FiscalPeriod } from './fiscal.js';

export interface SpendingEntry {
  /** UTC ISO */
  occurredAt: string;
  /** 양의 정수 */
  amount: number;
  kind: TransactionKind;
  isCancellation: boolean;
  /** 통계 제외 (내 계좌 간 이체 등) */
  isExcluded: boolean;
  /** 고정비 카테고리인지 */
  isFixed: boolean;
  categoryKey: string | null;
}

export interface CategoryTotal {
  categoryKey: string | null;
  amount: number;
  isFixed: boolean;
}

export interface SpendingSummary {
  /** 지출 합계 (양수). 취소는 차감되어 있다. */
  totalSpent: number;
  /** 고정비 지출 */
  fixedSpent: number;
  /** 변동비 지출 — burn rate 는 이것만 본다 */
  variableSpent: number;
  /** 수입 합계 (양수) */
  totalIncome: number;
  /** 카테고리별 지출, 큰 순 */
  byCategory: CategoryTotal[];
  /** 집계에 들어간 거래 수 */
  counted: number;
}

/**
 * 회계월 안의 거래만 집계한다.
 *
 * - 이체는 세지 않는다. 내 계좌 간 이동이라 소비가 아니다.
 * - 통계 제외 표시된 거래는 뺀다.
 * - 취소는 같은 카테고리에서 금액을 차감한다 (signedAmount 가 부호를 정의한다).
 */
export function summarizeSpending(
  entries: readonly SpendingEntry[],
  period: FiscalPeriod,
): SpendingSummary {
  let totalSpent = 0;
  let fixedSpent = 0;
  let totalIncome = 0;
  let counted = 0;
  const byCategory = new Map<string, CategoryTotal>();

  for (const entry of entries) {
    if (entry.isExcluded) continue;
    if (entry.kind === 'transfer') continue;
    if (!periodContains(period, toPlainDate(new Date(entry.occurredAt)))) continue;

    counted += 1;
    const signed = signedAmount(entry);

    if (entry.kind === 'income') {
      totalIncome += signed;
      continue;
    }

    // 지출은 signedAmount 가 음수로 준다. 표시용으로는 양수를 쓴다.
    const spent = -signed;
    totalSpent += spent;
    if (entry.isFixed) fixedSpent += spent;

    const key = entry.categoryKey ?? '';
    const bucket = byCategory.get(key);
    if (bucket) bucket.amount += spent;
    else
      byCategory.set(key, {
        categoryKey: entry.categoryKey,
        amount: spent,
        isFixed: entry.isFixed,
      });
  }

  return {
    totalSpent,
    fixedSpent,
    variableSpent: totalSpent - fixedSpent,
    totalIncome,
    byCategory: [...byCategory.values()].sort(
      (a, b) => b.amount - a.amount || (a.categoryKey ?? '').localeCompare(b.categoryKey ?? ''),
    ),
    counted,
  };
}
