/**
 * 배당 현금흐름 설계 — 순수 함수 모듈 (UI/DOM 의존 없음).
 * 금액 단위: 원. 비율 단위: %.
 *
 * 예상 배당은 직전 배당(DPS) 기준 가정치이며 기업이 변경·중단할 수 있습니다.
 * 종목 조합은 사용자가 고른 조합의 계산 결과이며 특정 종목의 매매를 권유하지 않습니다.
 */

import type { DividendRow } from "@/lib/types";

/** 지급월 정보가 없을 때의 가정(국내 12월 결산 연배당 → 4월 지급) */
export const DEFAULT_ASSUMED_PAY_MONTHS: readonly number[] = [4];
/** 배당소득 원천징수 세율(소득세 14% + 지방소득세 1.4%) */
export const DIVIDEND_TAX_PCT = 15.4;

export const PLAN_LIMITS = {
  holdings: 30,
  shares: { min: 1, max: 100_000_000 },
  target: { min: 0, max: 1_000_000_000 },
  yield: { min: 0.1, max: 30 },
} as const;

export const DEFAULT_TARGET_MONTHLY = 1_000_000;
export const DEFAULT_YIELD_PCT = 4;
export const YIELD_CHIPS = [3, 4, 5, 6] as const;

export const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"] as const;

export interface PlanHolding {
  code: string;
  name: string;
  shares: number;
  dps: number | null;
  pay_months: number[] | null;
  price: number | null;
  dividend_yield: number | null;
}

export interface MonthItem {
  code: string;
  name: string;
  amount: number;
  /** 지급월 미확인 → 4월 가정으로 배치된 항목 */
  assumed: boolean;
}

export interface MonthCashflow {
  /** 1~12 */
  month: number;
  total: number;
  items: MonthItem[];
}

export interface CashflowResult {
  months: MonthCashflow[];
  /** 연 예상 배당 합계(세전) */
  annualTotal: number;
  /** 연 합계 ÷ 12 */
  averageMonthly: number;
  /** 배당이 0 인 달(1~12) */
  zeroMonths: number[];
  /** 배당이 있는 달 수 */
  payingMonths: number;
  /** 지급월 미확인으로 4월 가정이 적용된 종목 코드 */
  assumedCodes: string[];
  /** DPS 가 없거나 0 이어서 계산에서 빠진 종목 코드 */
  noDpsCodes: string[];
  /** 보유 평가금 합계(가격 있는 종목만) */
  holdingsValue: number;
  /** 가격이 없어 평가금에서 빠진 종목 수 */
  missingPriceCount: number;
}

/** pay_months 정규화: 1~12 정수, 중복 제거, 오름차순. 비어 있으면 가정값 + assumed=true */
export function effectivePayMonths(payMonths: number[] | null | undefined): { months: number[]; assumed: boolean } {
  const cleaned = [...new Set((payMonths ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (cleaned.length === 0) return { months: [...DEFAULT_ASSUMED_PAY_MONTHS], assumed: true };
  return { months: cleaned, assumed: false };
}

/** 지급월 라벨: [4] → "연 1회(4월)", [4,5,8,11] → "분기(4·5·8·11월)" */
export function describePayMonths(payMonths: number[] | null | undefined): string {
  const { months, assumed } = effectivePayMonths(payMonths);
  if (assumed) return "지급월 미확인 (4월 가정)";
  const list = months.map((m) => `${m}`).join("·");
  const freq = months.length >= 12 ? "월배당" : months.length === 4 ? "분기" : months.length === 2 ? "반기" : months.length === 1 ? "연 1회" : `연 ${months.length}회`;
  return `${freq}(${list}월)`;
}

/**
 * 12개월 예상 배당 현금흐름.
 * 연간 DPS × 보유 수량을 지급월 수로 균등 분할해 각 지급월에 배치한다
 * (연배당 = 전액, 반기 = 1/2, 분기 = 1/4, 월배당 = 1/12).
 */
export function monthlyCashflow(holdings: readonly PlanHolding[]): CashflowResult {
  const months: MonthCashflow[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, items: [] }));
  const assumedCodes: string[] = [];
  const noDpsCodes: string[] = [];
  let holdingsValue = 0;
  let missingPriceCount = 0;

  for (const h of holdings) {
    const shares = Math.max(0, Math.floor(h.shares));
    if (h.price !== null && h.price > 0) holdingsValue += h.price * shares;
    else missingPriceCount += 1;
    if (h.dps === null || !(h.dps > 0) || shares <= 0) {
      noDpsCodes.push(h.code);
      continue;
    }
    const { months: pm, assumed } = effectivePayMonths(h.pay_months);
    if (assumed) assumedCodes.push(h.code);
    const per = (h.dps * shares) / pm.length;
    for (const m of pm) {
      const slot = months[m - 1];
      if (!slot) continue;
      slot.items.push({ code: h.code, name: h.name, amount: per, assumed });
      slot.total += per;
    }
  }
  for (const m of months) m.items.sort((a, b) => b.amount - a.amount);

  const annualTotal = months.reduce((s, m) => s + m.total, 0);
  const zeroMonths = months.filter((m) => m.total <= 0).map((m) => m.month);
  return {
    months,
    annualTotal,
    averageMonthly: annualTotal / 12,
    zeroMonths,
    payingMonths: 12 - zeroMonths.length,
    assumedCodes,
    noDpsCodes,
    holdingsValue,
    missingPriceCount,
  };
}

/** 목표 월 배당액을 받기 위해 필요한 투자금 = 목표 × 12 ÷ 배당수익률. 수익률 ≤ 0 이면 null */
export function requiredInvestment(targetMonthly: number, yieldPct: number): number | null {
  if (!Number.isFinite(targetMonthly) || targetMonthly <= 0) return 0;
  if (!Number.isFinite(yieldPct) || yieldPct <= 0) return null;
  return (targetMonthly * 12) / (yieldPct / 100);
}

/** 현재 조합의 가중 배당수익률(%) = Σ(DPS×수량) ÷ Σ(가격×수량). 계산 가능한 종목이 없으면 null */
export function weightedYieldPct(holdings: readonly PlanHolding[]): number | null {
  let div = 0;
  let value = 0;
  for (const h of holdings) {
    if (h.price === null || !(h.price > 0) || h.shares <= 0) continue;
    value += h.price * h.shares;
    div += (h.dps ?? 0) * h.shares;
  }
  if (value <= 0) return null;
  return (div / value) * 100;
}

/** 세후 금액(원천징수 15.4% 단순 적용) */
export function afterTax(amount: number, taxPct: number = DIVIDEND_TAX_PCT): number {
  return amount * (1 - taxPct / 100);
}

/** DividendRow + 수량 → PlanHolding */
export function toPlanHolding(row: DividendRow, shares: number): PlanHolding {
  return {
    code: row.code,
    name: row.name,
    shares,
    dps: row.dps,
    pay_months: row.pay_months,
    price: row.price,
    dividend_yield: row.dividend_yield,
  };
}

/* ───────────────── URL 파라미터 ───────────────── */

export interface HoldingParam { code: string; shares: number }
export type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** "005930:10,000660:5" → [{code, shares}] (검증·중복 제거·최대 30개) */
export function parseHoldingsParam(raw: string | undefined): HoldingParam[] {
  if (!raw) return [];
  const out: HoldingParam[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const [codeRaw, sharesRaw] = part.trim().split(":");
    const code = (codeRaw ?? "").trim();
    if (!/^\d{6}$/.test(code) || seen.has(code)) continue;
    const n = Math.floor(Number(sharesRaw ?? "1"));
    const shares = Number.isFinite(n) ? Math.min(PLAN_LIMITS.shares.max, Math.max(PLAN_LIMITS.shares.min, n)) : 1;
    seen.add(code);
    out.push({ code, shares });
    if (out.length >= PLAN_LIMITS.holdings) break;
  }
  return out;
}

export function encodeHoldingsParam(holdings: readonly HoldingParam[]): string {
  return holdings.map((h) => `${h.code}:${Math.floor(h.shares)}`).join(",");
}

export interface PlannerParams {
  holdings: HoldingParam[];
  targetMonthly: number;
  yieldPct: number;
}

function clamp(v: string | undefined, min: number, max: number, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** URL → 플래너 입력. 키: h(보유), t(목표 월 배당), y(가정 배당수익률 %) */
export function parsePlannerParams(sp: SearchParamsLike): PlannerParams {
  return {
    holdings: parseHoldingsParam(first(sp.h)),
    targetMonthly: Math.round(clamp(first(sp.t), PLAN_LIMITS.target.min, PLAN_LIMITS.target.max, DEFAULT_TARGET_MONTHLY)),
    yieldPct: Math.round(clamp(first(sp.y), PLAN_LIMITS.yield.min, PLAN_LIMITS.yield.max, DEFAULT_YIELD_PCT) * 100) / 100,
  };
}

/** 플래너 입력 → 쿼리 문자열(선행 ? 없음). 보유가 없고 값이 기본값이면 빈 문자열 */
export function encodePlannerParams(p: PlannerParams): string {
  const q = new URLSearchParams();
  if (p.holdings.length) q.set("h", encodeHoldingsParam(p.holdings));
  if (p.holdings.length || p.targetMonthly !== DEFAULT_TARGET_MONTHLY) q.set("t", String(Math.round(p.targetMonthly)));
  if (p.holdings.length || p.yieldPct !== DEFAULT_YIELD_PCT) q.set("y", String(Math.round(p.yieldPct * 100) / 100));
  return q.toString();
}
