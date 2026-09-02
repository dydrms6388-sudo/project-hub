/**
 * 투자 세금 계산 모듈 — 순수 함수 (UI/DOM 의존 없음).
 * 금액 단위: 원. 비율 단위: %.
 *
 * ⚠️ 참고용 근사 계산입니다. 세무 상담이 아니며 실제 세액은 세무 전문가 확인이 필요합니다.
 * 세법은 매년 바뀌므로 아래 TAX_PARAMS 를 연 1회 갱신하세요. "확인 필요" 표시 항목은
 * 시행 여부·수치가 바뀌었을 수 있으니 갱신 시 반드시 최신 소득세법·조특법을 확인합니다.
 */

/* ───────────────── 세법 파라미터 (연 1회 갱신) ───────────────── */

export const TAX_PARAMS = {
  /** 기준연도 — UI 에 "YYYY년 기준" 으로 표기 */
  baseYear: 2026,

  /** 해외주식 양도소득세 (소득세법 §94, §104) */
  overseas: {
    /** 양도소득세 20% + 지방소득세 2% = 22% */
    ratePct: 22,
    nationalPct: 20,
    localPct: 2,
    /** 연 250만원 기본공제 — 국내 과세대상 주식(대주주) 양도차익과 합산 1회 */
    basicDeduction: 2_500_000,
    /** 신고·납부 기간: 양도한 해의 다음 연도 5월 1일~31일 (확정신고) */
    filingPeriod: "다음 해 5월 1일 ~ 5월 31일",
    /** 같은 연도(1/1~12/31 결제일 기준) 안에서만 손익통산 — 이월공제 없음 */
    carryForward: false,
  },

  /** 이자·배당 원천징수 (소득세 14% + 지방소득세 1.4%) */
  withholding: { nationalPct: 14, localPct: 1.4, totalPct: 15.4 },

  /** 금융소득종합과세 (소득세법 §14, §17, §56, §62) */
  comprehensive: {
    /** 이자+배당 합계가 이 금액을 초과하면 초과분이 다른 종합소득과 합산 과세 */
    threshold: 20_000_000,
    /** 지방소득세 = 소득세의 10% */
    localSurtaxPct: 10,
    /** 배당가산(Gross-up)율 — 2024년 귀속분부터 10% (확인 필요: 개정 여부) */
    grossUpPct: 10,
    /** 종합소득세 누진세율표 (2023년 귀속분부터 적용, 확인 필요: 구간 개정 여부) */
    brackets: [
      { upTo: 14_000_000, ratePct: 6, deduction: 0 },
      { upTo: 50_000_000, ratePct: 15, deduction: 1_260_000 },
      { upTo: 88_000_000, ratePct: 24, deduction: 5_760_000 },
      { upTo: 150_000_000, ratePct: 35, deduction: 15_440_000 },
      { upTo: 300_000_000, ratePct: 38, deduction: 19_940_000 },
      { upTo: 500_000_000, ratePct: 40, deduction: 25_940_000 },
      { upTo: 1_000_000_000, ratePct: 42, deduction: 35_940_000 },
      { upTo: Number.POSITIVE_INFINITY, ratePct: 45, deduction: 65_940_000 },
    ],
  },

  /** ISA (조특법 §91의18) — 확인 필요: 한도 확대(연 4,000만·비과세 500만) 개정안 시행 여부 */
  isa: {
    /** 일반형 비과세 한도 */
    taxFreeGeneral: 2_000_000,
    /** 서민형·농어민형 비과세 한도 */
    taxFreeSeomin: 4_000_000,
    /** 비과세 한도 초과분 분리과세 세율 (9% + 지방소득세 0.9%) */
    excessRatePct: 9.9,
    /** 의무가입기간(년) — 미충족 해지 시 비과세 혜택 상실 */
    minYears: 3,
    /** 연 납입한도 */
    annualLimit: 20_000_000,
    /** 총 납입한도 */
    totalLimit: 100_000_000,
  },

  /** 연금저축·IRP (소득세법 §59의3, §129) */
  pension: {
    /** 연금저축 단독 세액공제 대상 납입 한도 */
    creditLimit: 6_000_000,
    /** IRP 합산 세액공제 대상 납입 한도 */
    creditLimitWithIrp: 9_000_000,
    /** 연금계좌 연 납입한도(연금저축+IRP 합산) */
    annualLimit: 18_000_000,
    /** 총급여 5,500만원(종합소득금액 4,500만원) 이하: 16.5% (15% + 지방 1.5%) */
    creditRateHighPct: 16.5,
    /** 초과: 13.2% (12% + 지방 1.2%) */
    creditRateLowPct: 13.2,
    /** 고율 공제 기준 총급여 */
    highRateSalaryLimit: 55_000_000,
    /** 55세 이후 연금 수령 시 연금소득세 (55~69세 5.5%, 70~79세 4.4%, 80세~ 3.3%) — 55~69세 가정 */
    pensionIncomeTaxPct: 5.5,
    /** 중도해지·연금 외 수령 시 기타소득세 (15% + 지방 1.5%) */
    earlyWithdrawalPct: 16.5,
    /** 연금 수령액이 이 금액을 넘으면 종합과세 또는 16.5% 분리과세 선택 (확인 필요) */
    pensionComprehensiveThreshold: 15_000_000,
  },

  /** 국내 상장주식 대주주 요건 (소득세법 시행령 §157) — 확인 필요: 기준 금액 개정 여부 */
  majorShareholder: {
    /** 종목당 보유 시가총액 기준 (직전 사업연도 말) — 2024년 귀속분부터 50억원 */
    valueThreshold: 5_000_000_000,
    /** 지분율 기준 (연중 어느 날이든 충족 시) */
    pctThreshold: { KOSPI: 1, KOSDAQ: 2, KONEX: 4 } as const,
    /** 대주주 양도소득세율: 과세표준 3억 이하 20%, 초과 25% (지방소득세 별도 10%) — 1년 미만 보유 30% */
    ratePctLow: 20,
    ratePctHigh: 25,
    rateBoundary: 300_000_000,
    /** 판정 기준일: 직전 사업연도 종료일(12월 결산 법인은 12월 31일 — 실제 주식 보유는 결제일 기준 T+2 고려) */
    referenceDate: "직전 사업연도 종료일(12월 결산 법인: 12월 31일)",
  },

  /**
   * 금융투자소득세 — 2025년 시행 예정이었으나 2024년 12월 폐지 법안이 통과된 것으로 알려져 있음.
   * 확인 필요: 재도입 논의 여부. 시행되면 이 모듈의 해외주식·대주주 계산 구조가 달라진다.
   */
  financialInvestmentIncomeTax: { status: "폐지(2024.12) — 재도입 여부 확인 필요" },
} as const;

export type Market = keyof typeof TAX_PARAMS.majorShareholder.pctThreshold;

/* ───────────────── 공통 헬퍼 ───────────────── */

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" ? Number(v.replace(/[,\s_]/g, "")) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round0(n: number): number {
  return Math.round(n);
}

/**
 * 종합소득세 누진세율표로 산출세액(국세, 지방세 제외) 계산.
 * 불변식: progressiveTax(0) = 0, 단조 증가, 구간 경계에서 연속(누진공제 방식).
 */
export function progressiveTax(taxable: number): number {
  if (!Number.isFinite(taxable) || taxable <= 0) return 0;
  const brackets = TAX_PARAMS.comprehensive.brackets;
  const b = brackets.find((x) => taxable <= x.upTo) ?? brackets[brackets.length - 1];
  if (!b) return 0;
  return Math.max(0, taxable * (b.ratePct / 100) - b.deduction);
}

/** 과세표준이 속한 구간의 한계세율(%) — 국세 기준 */
export function marginalRatePct(taxable: number): number {
  const brackets = TAX_PARAMS.comprehensive.brackets;
  const b = brackets.find((x) => taxable <= x.upTo) ?? brackets[brackets.length - 1];
  return b ? b.ratePct : 0;
}

/* ───────────────── ① 해외주식 양도세 손익통산 ───────────────── */

export interface GainRow {
  name: string;
  /** 실현(또는 미실현) 손익, 원. 손실은 음수 */
  gain: number;
}

export interface OverseasInput {
  realized: GainRow[];
  unrealized: GainRow[];
}

export interface WhatIfLoss extends GainRow {
  /** 이 종목만 추가로 실현했을 때의 과세표준 */
  newTaxable: number;
  /** 이 종목만 추가로 실현했을 때 줄어드는 세액(22%) */
  saving: number;
}

export interface OverseasResult {
  realizedNet: number;
  realizedGainTotal: number;
  realizedLossTotal: number;
  deduction: number;
  /** max(0, 순손익 − 기본공제) */
  taxable: number;
  tax: number;
  taxNational: number;
  taxLocal: number;
  /** 세금 없이 추가로 실현할 수 있는 이익 여유분 = max(0, 기본공제 − 순손익) */
  gainRoom: number;
  /** 미실현 손실 종목별 what-if */
  whatIfLosses: WhatIfLoss[];
  /** 과세표준을 0 으로 만드는 계산상 손실 실현 조합(그리디). 손실 종목이 없거나 과세표준이 0 이면 null */
  offsetSet: { rows: GainRow[]; totalLoss: number; newTaxable: number; saving: number; fullyOffset: boolean } | null;
  /** 기본공제 여유분 안에 들어가는 미실현 이익 종목(작은 것부터 누적) */
  gainsWithinRoom: GainRow[];
  filingPeriod: string;
}

export const OVERSEAS_LIMITS = { gain: { min: -1e12, max: 1e12 }, maxRows: 30, nameMax: 24 } as const;

export function normalizeRows(rows: GainRow[]): GainRow[] {
  return rows
    .slice(0, OVERSEAS_LIMITS.maxRows)
    .map((r) => ({ name: String(r.name ?? "").slice(0, OVERSEAS_LIMITS.nameMax), gain: round0(clamp(r.gain, OVERSEAS_LIMITS.gain.min, OVERSEAS_LIMITS.gain.max, 0)) }));
}

/**
 * 해외주식 양도세 손익통산.
 * 불변식:
 *  - taxable = max(0, Σ실현손익 − 기본공제), tax = taxable × 22%
 *  - 손실 종목 what-if 절세액은 항상 0 ≤ saving ≤ tax
 *  - offsetSet 이 fullyOffset 이면 newTaxable = 0 이고 saving = tax
 *  - gainRoom > 0 이면 taxable = 0
 */
export function overseasCapitalGainsTax(input: OverseasInput): OverseasResult {
  const P = TAX_PARAMS.overseas;
  const realized = normalizeRows(input.realized);
  const unrealized = normalizeRows(input.unrealized);
  const rate = P.ratePct / 100;

  const realizedGainTotal = realized.filter((r) => r.gain > 0).reduce((s, r) => s + r.gain, 0);
  const realizedLossTotal = realized.filter((r) => r.gain < 0).reduce((s, r) => s + r.gain, 0);
  const realizedNet = realizedGainTotal + realizedLossTotal;
  const taxableOf = (net: number) => Math.max(0, net - P.basicDeduction);
  const taxable = taxableOf(realizedNet);
  const tax = round0(taxable * rate);

  const whatIfLosses: WhatIfLoss[] = unrealized
    .filter((r) => r.gain < 0)
    .map((r) => {
      const newTaxable = taxableOf(realizedNet + r.gain);
      return { ...r, newTaxable, saving: round0((taxable - newTaxable) * rate) };
    })
    .sort((a, b) => b.saving - a.saving);

  // 그리디: 큰 손실부터 담아 과세표준을 0 으로, 그 뒤 불필요한 항목 제거(작은 것부터)
  let offsetSet: OverseasResult["offsetSet"] = null;
  if (taxable > 0 && whatIfLosses.length > 0) {
    const sorted = [...unrealized.filter((r) => r.gain < 0)].sort((a, b) => a.gain - b.gain);
    const chosen: GainRow[] = [];
    let remaining = taxable;
    for (const r of sorted) {
      if (remaining <= 0) break;
      chosen.push(r);
      remaining += r.gain;
    }
    if (remaining <= 0) {
      for (let i = chosen.length - 1; i >= 0; i--) {
        const c = chosen[i];
        if (!c) continue;
        if (remaining - c.gain <= 0) {
          chosen.splice(i, 1);
          remaining -= c.gain;
        }
      }
    }
    const totalLoss = chosen.reduce((s, r) => s + r.gain, 0);
    const newTaxable = taxableOf(realizedNet + totalLoss);
    offsetSet = { rows: chosen, totalLoss, newTaxable, saving: round0((taxable - newTaxable) * rate), fullyOffset: newTaxable === 0 };
  }

  const gainRoom = Math.max(0, P.basicDeduction - realizedNet);
  const gainsWithinRoom: GainRow[] = [];
  if (gainRoom > 0) {
    let acc = 0;
    for (const r of [...unrealized.filter((r) => r.gain > 0)].sort((a, b) => a.gain - b.gain)) {
      if (acc + r.gain <= gainRoom) {
        gainsWithinRoom.push(r);
        acc += r.gain;
      }
    }
  }

  return {
    realizedNet,
    realizedGainTotal,
    realizedLossTotal,
    deduction: P.basicDeduction,
    taxable,
    tax,
    taxNational: round0(taxable * (P.nationalPct / 100)),
    taxLocal: round0(taxable * (P.localPct / 100)),
    gainRoom,
    whatIfLosses,
    offsetSet,
    gainsWithinRoom,
    filingPeriod: P.filingPeriod,
  };
}

/** URL: r=이름:손익,이름:손익 (실현) / u=... (미실현). 이름은 encodeURIComponent, 손익은 정수 원 */
export function encodeRows(rows: GainRow[]): string {
  return normalizeRows(rows)
    .filter((r) => r.name.trim() !== "" || r.gain !== 0)
    .map((r) => `${encodeURIComponent(r.name)}:${r.gain}`)
    .join(",");
}

export function decodeRows(s: string | undefined): GainRow[] {
  if (!s) return [];
  const out: GainRow[] = [];
  for (const part of s.split(",")) {
    if (!part) continue;
    const idx = part.lastIndexOf(":");
    const rawName = idx >= 0 ? part.slice(0, idx) : part;
    const rawGain = idx >= 0 ? part.slice(idx + 1) : "0";
    let name = rawName;
    try { name = decodeURIComponent(rawName); } catch { /* 잘못된 인코딩은 원문 유지 */ }
    out.push({ name, gain: Number(rawGain) });
  }
  return normalizeRows(out);
}

/* ───────────────── ② 금융소득종합과세 경계 ───────────────── */

export interface FinIncomeInput {
  /** 연간 배당소득(세전) */
  dividend: number;
  /** 연간 이자소득(세전) */
  interest: number;
  /** 근로·사업 등 다른 종합소득의 과세표준(각종 공제 후) */
  otherIncome: number;
}

export interface FinIncomeResult {
  input: FinIncomeInput;
  financialTotal: number;
  threshold: number;
  /** 경계까지 남은 금액(음수면 초과) */
  room: number;
  excess: number;
  isComprehensive: boolean;
  /** 원천징수만 부담하는 경우의 세액(15.4%) */
  withholdingTax: number;
  /** 다른 종합소득에 대한 세액(국세) — 비교 기준선 */
  otherIncomeTax: number;
  comprehensive: {
    /** 초과분 중 배당 부분에 대한 배당가산액 */
    grossUp: number;
    /** 종합소득 과세표준 = 다른 소득 + 초과분 + 배당가산 */
    taxableBase: number;
    /** 종합과세 방식 산출세액(배당세액공제 반영, 국세) */
    methodA: number;
    /** 비교과세(분리과세 방식) 산출세액(국세) */
    methodB: number;
    /** max(A, B) */
    chosenNational: number;
    marginalRatePct: number;
  } | null;
  /** 원천징수 대비 추가 부담 세액(지방소득세 포함). 종합과세 대상이 아니면 0 */
  additionalTax: number;
  /** 초과분 1원당 추가 세부담(%) — 초과분이 0 이면 null */
  effectiveExtraRatePct: number | null;
}

export const FIN_LIMITS = { amount: { min: 0, max: 1e11 } } as const;

export function normalizeFinIncome(raw: Partial<FinIncomeInput>): FinIncomeInput {
  return {
    dividend: round0(clamp(raw.dividend, FIN_LIMITS.amount.min, FIN_LIMITS.amount.max, 0)),
    interest: round0(clamp(raw.interest, FIN_LIMITS.amount.min, FIN_LIMITS.amount.max, 0)),
    otherIncome: round0(clamp(raw.otherIncome, FIN_LIMITS.amount.min, FIN_LIMITS.amount.max, 0)),
  };
}

/**
 * 금융소득종합과세 근사 계산.
 * - 2,000만원 이하: 15.4% 원천징수로 종결.
 * - 초과 시 초과분이 다른 종합소득과 합산. 기준금액(2,000만원)은 14% 로 과세.
 * - 비교과세: 종합과세 방식(A)과 분리과세 방식(B) 중 큰 세액 → 최소 원천징수 세액은 항상 부담.
 * - 배당가산(gross-up)과 배당세액공제는 "초과분이 배당으로 우선 구성"된다고 보고 근사
 *   (실제로는 이자 → 가산 대상 아닌 배당 → 가산 대상 배당 순으로 기준금액을 채움).
 * 불변식: additionalTax ≥ 0, financialTotal ≤ threshold 이면 additionalTax = 0.
 */
export function comprehensiveFinancialIncomeTax(raw: Partial<FinIncomeInput>): FinIncomeResult {
  const input = normalizeFinIncome(raw);
  const P = TAX_PARAMS.comprehensive;
  const W = TAX_PARAMS.withholding;
  const financialTotal = input.dividend + input.interest;
  const room = P.threshold - financialTotal;
  const excess = Math.max(0, -room);
  const withholdingTax = round0(financialTotal * (W.totalPct / 100));
  const otherIncomeTax = progressiveTax(input.otherIncome);

  if (excess <= 0) {
    return { input, financialTotal, threshold: P.threshold, room, excess: 0, isComprehensive: false, withholdingTax, otherIncomeTax, comprehensive: null, additionalTax: 0, effectiveExtraRatePct: null };
  }

  const excessDividend = Math.min(input.dividend, excess);
  const grossUp = excessDividend * (P.grossUpPct / 100);
  const taxableBase = input.otherIncome + excess + grossUp;
  const baseTax = P.threshold * (W.nationalPct / 100);
  const methodAPre = baseTax + progressiveTax(taxableBase);
  const methodB = financialTotal * (W.nationalPct / 100) + otherIncomeTax;
  // 배당세액공제 한도 = A(공제 전) − B → A(공제 후) ≥ B
  const methodA = Math.max(methodB, methodAPre - grossUp);
  const chosenNational = Math.max(methodA, methodB);
  const baselineNational = financialTotal * (W.nationalPct / 100) + otherIncomeTax;
  const additionalNational = Math.max(0, chosenNational - baselineNational);
  const additionalTax = round0(additionalNational * (1 + P.localSurtaxPct / 100));

  return {
    input,
    financialTotal,
    threshold: P.threshold,
    room,
    excess,
    isComprehensive: true,
    withholdingTax,
    otherIncomeTax,
    comprehensive: { grossUp: round0(grossUp), taxableBase: round0(taxableBase), methodA: round0(methodA), methodB: round0(methodB), chosenNational: round0(chosenNational), marginalRatePct: marginalRatePct(taxableBase) },
    additionalTax,
    effectiveExtraRatePct: excess > 0 ? (additionalTax / excess) * 100 : null,
  };
}

/** 월 배당 X 원이면 연 배당 12X — 경계와 비교할 때 쓰는 단순 환산 */
export function monthlyToAnnual(monthly: number): number {
  return round0(clamp(monthly, 0, 1e10, 0) * 12);
}

/* ───────────────── ③ ISA vs 일반계좌 vs 연금저축 ───────────────── */

export interface IsaInput {
  /** 연 납입액(원). 매년 초 납입 가정 */
  annualContribution: number;
  years: number;
  expectedReturnPct: number;
  /** 수익 중 과세 대상(배당·이자·국내상장 해외ETF 매매차익 등) 비율 %. 나머지는 국내 상장주식 매매차익(소액주주 비과세) 가정 */
  taxableSharePct: number;
  /** ISA 서민형 여부 */
  seomin: boolean;
  /** 연금저축 세액공제율 16.5% 적용(총급여 5,500만원 이하) 여부 */
  highCreditRate: boolean;
}

export type AccountKey = "general" | "isa" | "pension";

export interface AccountRow {
  key: AccountKey;
  label: string;
  /** 실제 납입 총액(계좌별 한도로 잘린 값) */
  contributed: number;
  /** 세전 만기 평가액 */
  grossBalance: number;
  /** 보유 중 매년 낸 세금 합계 */
  taxDuring: number;
  /** 만기(수령) 시 세금 */
  taxAtEnd: number;
  /** 세액공제 환급 누계(재투자 성장분 포함) */
  credit: number;
  /** 세후 자산 = 세전 평가액 − 세금 + 세액공제 */
  afterTax: number;
  /** 총 세부담(음수면 환급이 더 큼) */
  netTax: number;
  notes: string[];
}

export interface IsaResult {
  input: IsaInput;
  rows: AccountRow[];
}

export const ISA_LIMITS = { contribution: { min: 0, max: 1e9 }, years: { min: 1, max: 40 }, rate: { min: -20, max: 30 }, share: { min: 0, max: 100 } } as const;

export const ISA_DEFAULT: IsaInput = { annualContribution: 12_000_000, years: 5, expectedReturnPct: 6, taxableSharePct: 60, seomin: false, highCreditRate: true };

export function normalizeIsaInput(raw: Partial<IsaInput>): IsaInput {
  return {
    annualContribution: round0(clamp(raw.annualContribution, ISA_LIMITS.contribution.min, ISA_LIMITS.contribution.max, ISA_DEFAULT.annualContribution)),
    years: round0(clamp(raw.years, ISA_LIMITS.years.min, ISA_LIMITS.years.max, ISA_DEFAULT.years)),
    expectedReturnPct: clamp(raw.expectedReturnPct, ISA_LIMITS.rate.min, ISA_LIMITS.rate.max, ISA_DEFAULT.expectedReturnPct),
    taxableSharePct: clamp(raw.taxableSharePct, ISA_LIMITS.share.min, ISA_LIMITS.share.max, ISA_DEFAULT.taxableSharePct),
    seomin: raw.seomin ?? ISA_DEFAULT.seomin,
    highCreditRate: raw.highCreditRate ?? ISA_DEFAULT.highCreditRate,
  };
}

/**
 * 세 계좌를 같은 수익률·같은 기간으로 굴린 세후 자산 비교 (연 1회 복리, 연초 납입).
 * - 일반계좌: 매년 수익 × 과세비율 × 15.4% 를 그 해에 납부(배당 수령 시 원천징수 근사). 손실 연도는 세금 0.
 * - ISA: 납입 한도(연 2,000만·총 1억) 적용. 만기까지 비과세 → 만기 시 과세 대상 수익 합계에서 비과세 한도 차감 후 9.9%.
 *        의무기간(3년) 미만이면 혜택 없이 일반계좌와 같은 15.4% 적용 가정.
 * - 연금저축: 납입 한도(연 1,800만) 적용, 세액공제 대상 600만 × 13.2%/16.5% 를 매년 환급 → 환급액은 일반계좌 규칙으로 재투자.
 *        만기 시 잔액 전체에 연금소득세 5.5%(55세 이후 연금 수령 가정).
 * 불변식: 수익률 0, 과세비율 0 이면 일반계좌·ISA 세후자산 = 납입총액.
 */
export function isaComparison(raw: Partial<IsaInput>): IsaResult {
  const input = normalizeIsaInput(raw);
  const r = input.expectedReturnPct / 100;
  const share = input.taxableSharePct / 100;
  const W = TAX_PARAMS.withholding.totalPct / 100;
  const I = TAX_PARAMS.isa;
  const PN = TAX_PARAMS.pension;

  // 일반계좌
  let gBal = 0, gContrib = 0, gTax = 0;
  for (let y = 0; y < input.years; y++) {
    gBal += input.annualContribution; gContrib += input.annualContribution;
    const gain = gBal * r;
    const tax = gain > 0 ? gain * share * W : 0;
    gBal += gain - tax; gTax += tax;
  }
  const general: AccountRow = {
    key: "general", label: "일반 위탁계좌", contributed: round0(gContrib), grossBalance: round0(gBal + gTax), taxDuring: round0(gTax), taxAtEnd: 0, credit: 0,
    afterTax: round0(gBal), netTax: round0(gTax),
    notes: ["배당·이자 수령 시 15.4% 원천징수를 매년 차감", "국내 상장주식 매매차익은 소액주주 비과세 가정", "출금·해지 제한 없음"],
  };

  // ISA
  const isaAnnual = Math.min(input.annualContribution, I.annualLimit);
  let iBal = 0, iContrib = 0, iTaxableIncome = 0;
  for (let y = 0; y < input.years; y++) {
    const c = Math.min(isaAnnual, Math.max(0, I.totalLimit - iContrib));
    iBal += c; iContrib += c;
    const gain = iBal * r;
    iBal += gain;
    iTaxableIncome += gain * share; // 손익통산: 손실 연도는 음수로 상쇄
  }
  const taxFree = input.seomin ? I.taxFreeSeomin : I.taxFreeGeneral;
  const isaNotes: string[] = [`의무가입 ${I.minYears}년 · 연 ${I.annualLimit / 10_000}만원 · 총 ${I.totalLimit / 100_000_000}억원 한도`, `비과세 ${taxFree / 10_000}만원 초과분 9.9% 분리과세(금융소득종합과세 미포함)`, "중도 인출은 납입 원금 범위에서만 가능"];
  let iTax: number;
  if (input.years < I.minYears) {
    iTax = Math.max(0, iTaxableIncome) * W;
    isaNotes.unshift(`기간이 의무가입 ${I.minYears}년 미만 → 비과세 혜택 없이 15.4% 적용 가정`);
  } else {
    iTax = Math.max(0, Math.max(0, iTaxableIncome) - taxFree) * (I.excessRatePct / 100);
  }
  if (isaAnnual < input.annualContribution) isaNotes.unshift(`연 납입 한도 초과분(${round0((input.annualContribution - isaAnnual) / 10_000).toLocaleString("ko-KR")}만원)은 계산에서 제외`);
  const isa: AccountRow = {
    key: "isa", label: input.seomin ? "ISA(서민형)" : "ISA(일반형)", contributed: round0(iContrib), grossBalance: round0(iBal), taxDuring: 0, taxAtEnd: round0(iTax), credit: 0,
    afterTax: round0(iBal - iTax), netTax: round0(iTax), notes: isaNotes,
  };

  // 연금저축
  const pnAnnual = Math.min(input.annualContribution, PN.annualLimit);
  const creditRate = (input.highCreditRate ? PN.creditRateHighPct : PN.creditRateLowPct) / 100;
  let pBal = 0, pContrib = 0, creditBal = 0, creditSum = 0;
  for (let y = 0; y < input.years; y++) {
    pBal += pnAnnual; pContrib += pnAnnual;
    const credit = Math.min(pnAnnual, PN.creditLimit) * creditRate;
    creditSum += credit;
    creditBal += credit;
    const cg = creditBal * r;
    creditBal += cg - (cg > 0 ? cg * share * W : 0);
    pBal += pBal * r;
  }
  const pTax = pBal * (PN.pensionIncomeTaxPct / 100);
  const pensionNotes: string[] = [
    `세액공제 대상 연 ${PN.creditLimit / 10_000}만원(IRP 합산 ${PN.creditLimitWithIrp / 10_000}만원) × ${input.highCreditRate ? PN.creditRateHighPct : PN.creditRateLowPct}% 환급, 환급액은 일반계좌로 재투자 가정`,
    `55세 이후 연금 수령 시 연금소득세 ${PN.pensionIncomeTaxPct}% 가정(연 ${PN.pensionComprehensiveThreshold / 10_000}만원 초과 수령 시 별도 과세)`,
    `중도해지·일시금 수령 시 기타소득세 ${PN.earlyWithdrawalPct}% — 55세 전 유동성 제약`,
  ];
  if (pnAnnual < input.annualContribution) pensionNotes.unshift(`연 납입 한도(${PN.annualLimit / 10_000}만원) 초과분은 계산에서 제외`);
  const pension: AccountRow = {
    key: "pension", label: "연금저축", contributed: round0(pContrib), grossBalance: round0(pBal), taxDuring: 0, taxAtEnd: round0(pTax), credit: round0(creditBal),
    afterTax: round0(pBal - pTax + creditBal), netTax: round0(pTax - creditSum), notes: pensionNotes,
  };

  return { input, rows: [general, isa, pension] };
}

/* ───────────────── ④ 대주주 요건 ───────────────── */

export interface MajorInput {
  market: Market;
  /** 종목 보유 시가총액(원) — 직전 사업연도 말 기준 */
  holdingValue: number;
  /** 지분율(%) */
  sharesPct: number;
}

export interface MajorResult {
  input: MajorInput;
  isMajor: boolean;
  byValue: boolean;
  byPct: boolean;
  valueThreshold: number;
  pctThreshold: number;
  /** 보유액 기준까지 여유분(음수면 초과) */
  valueRoom: number;
  /** 지분율 기준까지 여유분(%p, 음수면 초과) */
  pctRoom: number;
  referenceDate: string;
}

export const MAJOR_LIMITS = { value: { min: 0, max: 1e14 }, pct: { min: 0, max: 100 } } as const;

export function normalizeMajorInput(raw: Partial<MajorInput>): MajorInput {
  const market: Market = raw.market === "KOSDAQ" || raw.market === "KONEX" ? raw.market : "KOSPI";
  return {
    market,
    holdingValue: round0(clamp(raw.holdingValue, MAJOR_LIMITS.value.min, MAJOR_LIMITS.value.max, 0)),
    sharesPct: clamp(raw.sharesPct, MAJOR_LIMITS.pct.min, MAJOR_LIMITS.pct.max, 0),
  };
}

/**
 * 대주주 여부 = 보유액 ≥ 50억 OR 지분율 ≥ 시장별 기준.
 * 불변식: 두 입력이 모두 0 이면 isMajor = false, valueRoom = 50억, pctRoom = 기준 지분율.
 */
export function majorShareholderCheck(raw: Partial<MajorInput>): MajorResult {
  const input = normalizeMajorInput(raw);
  const P = TAX_PARAMS.majorShareholder;
  const pctThreshold = P.pctThreshold[input.market];
  const byValue = input.holdingValue >= P.valueThreshold;
  const byPct = input.sharesPct >= pctThreshold;
  return {
    input,
    isMajor: byValue || byPct,
    byValue,
    byPct,
    valueThreshold: P.valueThreshold,
    pctThreshold,
    valueRoom: P.valueThreshold - input.holdingValue,
    pctRoom: pctThreshold - input.sharesPct,
    referenceDate: P.referenceDate,
  };
}

/* ───────────────── URL 파라미터 ───────────────── */

export type SearchParamsLike = Record<string, string | string[] | undefined>;

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** 해외주식: r(실현) u(미실현) */
export function decodeOverseasParams(sp: SearchParamsLike): OverseasInput {
  return { realized: decodeRows(firstParam(sp.r)), unrealized: decodeRows(firstParam(sp.u)) };
}
export function encodeOverseasParams(input: OverseasInput): string {
  const q = new URLSearchParams();
  const r = encodeRows(input.realized); if (r) q.set("r", r);
  const u = encodeRows(input.unrealized); if (u) q.set("u", u);
  return q.toString();
}

/** 금융소득: d(배당) i(이자) o(다른 종합소득 과세표준) */
export function decodeFinParams(sp: SearchParamsLike): FinIncomeInput {
  return normalizeFinIncome({ dividend: Number(firstParam(sp.d) ?? 0), interest: Number(firstParam(sp.i) ?? 0), otherIncome: Number(firstParam(sp.o) ?? 0) });
}
export function encodeFinParams(input: FinIncomeInput): string {
  const n = normalizeFinIncome(input);
  const q = new URLSearchParams();
  q.set("d", String(n.dividend)); q.set("i", String(n.interest)); q.set("o", String(n.otherIncome));
  return q.toString();
}

/** ISA: c(연 납입) y(년) r(수익률) x(과세비율) s(서민형 1) h(고율공제 0) */
export function decodeIsaParams(sp: SearchParamsLike): IsaInput {
  const raw: Partial<IsaInput> = {};
  const c = firstParam(sp.c); if (c !== undefined) raw.annualContribution = Number(c);
  const y = firstParam(sp.y); if (y !== undefined) raw.years = Number(y);
  const r = firstParam(sp.r); if (r !== undefined) raw.expectedReturnPct = Number(r);
  const x = firstParam(sp.x); if (x !== undefined) raw.taxableSharePct = Number(x);
  const s = firstParam(sp.s); if (s !== undefined) raw.seomin = s === "1";
  const h = firstParam(sp.h); if (h !== undefined) raw.highCreditRate = h !== "0";
  return normalizeIsaInput(raw);
}
export function encodeIsaParams(input: IsaInput): string {
  const n = normalizeIsaInput(input);
  const q = new URLSearchParams();
  q.set("c", String(n.annualContribution)); q.set("y", String(n.years)); q.set("r", String(Math.round(n.expectedReturnPct * 100) / 100)); q.set("x", String(Math.round(n.taxableSharePct)));
  if (n.seomin) q.set("s", "1");
  if (!n.highCreditRate) q.set("h", "0");
  return q.toString();
}

/** 대주주: mk(시장) v(보유액) p(지분율) */
export function decodeMajorParams(sp: SearchParamsLike): MajorInput {
  const mk = firstParam(sp.mk);
  return normalizeMajorInput({ market: mk as Market, holdingValue: Number(firstParam(sp.v) ?? 0), sharesPct: Number(firstParam(sp.p) ?? 0) });
}
export function encodeMajorParams(input: MajorInput): string {
  const n = normalizeMajorInput(input);
  const q = new URLSearchParams();
  q.set("mk", n.market); q.set("v", String(n.holdingValue)); q.set("p", String(Math.round(n.sharesPct * 1000) / 1000));
  return q.toString();
}

export function hasAnyParam(sp: SearchParamsLike, keys: readonly string[]): boolean {
  return keys.some((k) => sp[k] !== undefined);
}
