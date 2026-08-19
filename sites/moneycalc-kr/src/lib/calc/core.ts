import type { Bracket } from "@/data/rates-2026";

/** 산식 펼치기에 그대로 뿌리는 계산 단계 */
export type Step = {
  /** 단계 이름 */
  label: string;
  /** 숫자를 대입한 식 (예: "3,000,000 × 4.75%") */
  expr: string;
  /** 이 단계의 결과값 */
  value: number;
  /** 값의 단위 표기 방식 */
  unit?: "won" | "pct" | "num" | "day" | "month" | "year";
  /** 보충 설명 */
  hint?: string;
};

export const step = (
  label: string,
  expr: string,
  value: number,
  unit: Step["unit"] = "won",
  hint?: string,
): Step => ({ label, expr, value, unit, hint });

/** 초과누진세율 적용: 과세표준 × 세율 − 누진공제 */
export function progressive(base: number, brackets: Bracket[]): { tax: number; bracket: Bracket } {
  const b = brackets.find((x) => x.upTo === null || base <= x.upTo) ?? brackets[brackets.length - 1];
  return { tax: Math.max(0, base * b.rate - (b.deduction ?? 0)), bracket: b };
}

/** 구간 하한을 함께 돌려준다(근로소득공제처럼 "하한 초과분 × 요율" 구조에 필요) */
export function bracketOf(
  value: number,
  brackets: Bracket[],
): { bracket: Bracket; lower: number; index: number } {
  let lower = 0;
  for (let i = 0; i < brackets.length; i += 1) {
    const b = brackets[i];
    if (b.upTo === null || value <= b.upTo) return { bracket: b, lower, index: i };
    lower = b.upTo;
  }
  const last = brackets.length - 1;
  return { bracket: brackets[last], lower, index: last };
}
