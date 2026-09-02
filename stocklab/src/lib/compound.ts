/**
 * 복리 계산기 — 순수 함수 모듈 (UI/DOM 의존 없음, 테스트 가능).
 * 금액 단위: 원. 비율 단위: %.
 *
 * 주의: 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다.
 * 세금·수수료·물가는 옵션을 켠 경우에만 단순 반영합니다.
 */

export type Compounding = "monthly" | "yearly";
export type ContributionTiming = "begin" | "end";

export interface CompoundInput {
  /** 최초 원금(거치금) */
  principal: number;
  /** 월 적립액 */
  monthly: number;
  /** 연 수익률(%) — 음수 허용 */
  annualRatePct: number;
  /** 기간(년) */
  years: number;
  /** 복리 주기 */
  compounding: Compounding;
  /** 적립 시점: 기초(begin) / 기말(end) */
  contributionTiming: ContributionTiming;
  /** 연 물가상승률(%) — 실질가치 계산용, 미지정 시 미반영 */
  inflationPct?: number;
  /** 이자(수익)에 대한 세율(%) — 예: 이자소득세 15.4. 미지정 시 미반영 */
  taxRatePct?: number;
}

export interface YearRow {
  year: number;
  /** 누적 투자원금(원금 + 적립액 합계) */
  invested: number;
  /** 누적 이자(수익), 세전 */
  interest: number;
  /** 세전 잔액 */
  balance: number;
  /** 물가 반영 실질가치(세후 기준). 물가 미지정 시 afterTaxBalance 와 동일 */
  realBalance: number;
  /** 세후 잔액. 세율 미지정 시 balance 와 동일 */
  afterTaxBalance: number;
}

export interface CompoundTotals {
  invested: number;
  interest: number;
  balance: number;
  tax: number;
  afterTaxBalance: number;
  realBalance: number;
  /** 총 투자원금 대비 세전 이자 비율(%) */
  interestRatioPct: number;
  /** 원금 대비 배수(세전) */
  multiple: number;
}

export interface CompoundResult {
  input: CompoundInput;
  rows: YearRow[];
  totals: CompoundTotals;
}

export const LIMITS = {
  principal: { min: 0, max: 1e11 },
  monthly: { min: 0, max: 1e9 },
  rate: { min: -50, max: 100 },
  years: { min: 1, max: 60 },
  inflation: { min: 0, max: 30 },
  tax: { min: 0, max: 60 },
} as const;

export const DEFAULT_INPUT: CompoundInput = {
  principal: 10_000_000,
  monthly: 300_000,
  annualRatePct: 7,
  years: 20,
  compounding: "monthly",
  contributionTiming: "end",
};

/** 국내 이자·배당소득 원천징수 세율(소득세 14% + 지방소득세 1.4%) */
export const KR_INTEREST_TAX_PCT = 15.4;

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" ? Number(v.replace(/[,\s_]/g, "")) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 입력값을 허용 범위로 정규화(clamp). UI/URL 어디서 오든 이 함수를 거친다. */
export function normalizeInput(raw: Partial<CompoundInput>): CompoundInput {
  const out: CompoundInput = {
    principal: Math.round(clamp(raw.principal, LIMITS.principal.min, LIMITS.principal.max, DEFAULT_INPUT.principal)),
    monthly: Math.round(clamp(raw.monthly, LIMITS.monthly.min, LIMITS.monthly.max, DEFAULT_INPUT.monthly)),
    annualRatePct: clamp(raw.annualRatePct, LIMITS.rate.min, LIMITS.rate.max, DEFAULT_INPUT.annualRatePct),
    years: Math.round(clamp(raw.years, LIMITS.years.min, LIMITS.years.max, DEFAULT_INPUT.years)),
    compounding: raw.compounding === "yearly" ? "yearly" : "monthly",
    contributionTiming: raw.contributionTiming === "begin" ? "begin" : "end",
  };
  if (raw.inflationPct !== undefined && Number.isFinite(raw.inflationPct) && raw.inflationPct > 0) {
    out.inflationPct = clamp(raw.inflationPct, LIMITS.inflation.min, LIMITS.inflation.max, 0);
  }
  if (raw.taxRatePct !== undefined && Number.isFinite(raw.taxRatePct) && raw.taxRatePct > 0) {
    out.taxRatePct = clamp(raw.taxRatePct, LIMITS.tax.min, LIMITS.tax.max, 0);
  }
  return out;
}

/**
 * 연도별 시뮬레이션.
 * - monthly: 월 이율 r/12 로 매월 복리. 적립 시점이 begin 이면 입금 후 이자, end 면 이자 후 입금.
 * - yearly : 연 1회 복리. begin 이면 해당 연도 적립액 전체가 연초에 들어가 1년 이자를 받고,
 *            end 면 연말에 들어가 그 해 이자를 받지 않는다.
 * - 세금   : 누적 이자(세전)에 세율을 곱해 일괄 공제한 단순 계산(연도별 과세 이연·분리과세 등 미반영).
 * - 물가   : 세후 잔액 / (1+물가)^년 = 현재 구매력 기준 실질가치.
 */
export function simulate(rawInput: Partial<CompoundInput>): CompoundResult {
  const input = normalizeInput(rawInput);
  const { principal, monthly, annualRatePct, years, compounding, contributionTiming } = input;
  const r = annualRatePct / 100;
  const infl = (input.inflationPct ?? 0) / 100;
  const tax = (input.taxRatePct ?? 0) / 100;

  const rows: YearRow[] = [];
  let balance = principal;
  let invested = principal;

  for (let y = 1; y <= years; y++) {
    if (compounding === "monthly") {
      const mr = r / 12;
      for (let m = 0; m < 12; m++) {
        if (contributionTiming === "begin") {
          balance += monthly;
          balance *= 1 + mr;
        } else {
          balance *= 1 + mr;
          balance += monthly;
        }
      }
    } else {
      const yearly = monthly * 12;
      if (contributionTiming === "begin") {
        balance = (balance + yearly) * (1 + r);
      } else {
        balance = balance * (1 + r) + yearly;
      }
    }
    invested += monthly * 12;
    const interest = balance - invested;
    const afterTaxBalance = interest > 0 ? invested + interest * (1 - tax) : balance;
    const realBalance = infl > 0 ? afterTaxBalance / Math.pow(1 + infl, y) : afterTaxBalance;
    rows.push({
      year: y,
      invested: round0(invested),
      interest: round0(interest),
      balance: round0(balance),
      afterTaxBalance: round0(afterTaxBalance),
      realBalance: round0(realBalance),
    });
  }

  const last = rows[rows.length - 1];
  const totals: CompoundTotals = last
    ? {
        invested: last.invested,
        interest: last.interest,
        balance: last.balance,
        tax: round0(last.balance - last.afterTaxBalance),
        afterTaxBalance: last.afterTaxBalance,
        realBalance: last.realBalance,
        interestRatioPct: last.invested > 0 ? (last.interest / last.invested) * 100 : 0,
        multiple: last.invested > 0 ? last.balance / last.invested : 0,
      }
    : { invested: principal, interest: 0, balance: principal, tax: 0, afterTaxBalance: principal, realBalance: principal, interestRatioPct: 0, multiple: 1 };

  return { input, rows, totals };
}

function round0(n: number): number {
  return Math.round(n);
}

/** 72의 법칙: 자산이 2배가 되는 데 걸리는 대략적인 연수 (수익률 ≤ 0 이면 null) */
export function ruleOf72(annualRatePct: number): number | null {
  if (!Number.isFinite(annualRatePct) || annualRatePct <= 0) return null;
  return 72 / annualRatePct;
}

/** 정확한 2배 도달 연수: ln2 / ln(1+r) */
export function exactDoublingYears(annualRatePct: number): number | null {
  if (!Number.isFinite(annualRatePct) || annualRatePct <= 0) return null;
  return Math.log(2) / Math.log(1 + annualRatePct / 100);
}

/**
 * 역산: 목표 금액(세전 잔액)에 도달하기 위해 필요한 월 적립액.
 * simulate 와 동일한 규칙을 쓰기 위해 이분 탐색으로 구한다 (단조 증가 보장).
 * 원금만으로 이미 목표를 넘으면 0. 도달 불가능(월 적립 상한 초과)이면 null.
 */
export function requiredMonthly(
  target: number,
  years: number,
  annualRatePct: number,
  opts: { principal?: number; compounding?: Compounding; contributionTiming?: ContributionTiming } = {},
): number | null {
  if (!Number.isFinite(target) || target <= 0) return 0;
  const base: Partial<CompoundInput> = {
    principal: opts.principal ?? 0,
    annualRatePct,
    years,
    compounding: opts.compounding ?? "monthly",
    contributionTiming: opts.contributionTiming ?? "end",
  };
  const at = (m: number) => simulate({ ...base, monthly: m }).totals.balance;
  if (at(0) >= target) return 0;
  let lo = 0;
  let hi: number = LIMITS.monthly.max;
  if (at(hi) < target) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= target) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}

/* ───────────────── URL 파라미터 ───────────────── */

export type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * URL → 입력값. 키: p(원금) m(월 적립) r(수익률) y(년) c(m|y 복리주기) t(b|e 적립시점) i(물가%) x(세율%)
 * 평문 쿼리(base64 아님) — 공유·SEO 친화적. 모든 값은 clamp 된다.
 */
export function decodeParams(sp: SearchParamsLike): CompoundInput {
  const raw: Partial<CompoundInput> = {};
  const p = first(sp.p); if (p !== undefined) raw.principal = Number(p);
  const m = first(sp.m); if (m !== undefined) raw.monthly = Number(m);
  const r = first(sp.r); if (r !== undefined) raw.annualRatePct = Number(r);
  const y = first(sp.y); if (y !== undefined) raw.years = Number(y);
  const c = first(sp.c); if (c === "y" || c === "yearly") raw.compounding = "yearly"; else if (c === "m" || c === "monthly") raw.compounding = "monthly";
  const t = first(sp.t); if (t === "b" || t === "begin") raw.contributionTiming = "begin"; else if (t === "e" || t === "end") raw.contributionTiming = "end";
  const i = first(sp.i); if (i !== undefined) raw.inflationPct = Number(i);
  const x = first(sp.x); if (x !== undefined) raw.taxRatePct = Number(x);
  return normalizeInput(raw);
}

/** 입력값 → 쿼리 문자열(선행 ? 없음). 기본값과 같은 옵션은 생략해 URL 을 짧게 유지한다. */
export function encodeParams(input: CompoundInput): string {
  const n = normalizeInput(input);
  const q = new URLSearchParams();
  q.set("p", String(n.principal));
  q.set("m", String(n.monthly));
  q.set("r", trimNum(n.annualRatePct));
  q.set("y", String(n.years));
  if (n.compounding === "yearly") q.set("c", "y");
  if (n.contributionTiming === "begin") q.set("t", "b");
  if (n.inflationPct !== undefined && n.inflationPct > 0) q.set("i", trimNum(n.inflationPct));
  if (n.taxRatePct !== undefined && n.taxRatePct > 0) q.set("x", trimNum(n.taxRatePct));
  return q.toString();
}

function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** 두 입력이 URL 기준으로 동일한지 */
export function sameParams(a: CompoundInput, b: CompoundInput): boolean {
  return encodeParams(a) === encodeParams(b);
}

/* ───────────────── 표기 헬퍼 ───────────────── */

/** 원 → "1억 2,345만원" / "300만원" / "5,000원" (만 미만은 원 단위). 음수 처리 포함 */
export function fmtManWon(n: number): string {
  if (!Number.isFinite(n)) return "–";
  const sign = n < 0 ? "-" : "";
  const v = Math.round(Math.abs(n));
  if (v < 10_000) return `${sign}${v.toLocaleString("ko-KR")}원`;
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return `${sign}${parts.join(" ")}원`;
}

/** 원 → "12,345,678원" */
export function fmtWonFull(n: number): string {
  if (!Number.isFinite(n)) return "–";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}
