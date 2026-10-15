/**
 * 적립식(DCA) 타임머신 — 순수 함수 모듈 (UI/DOM 의존 없음).
 * 입력은 실제(또는 샘플 모드에서는 합성) 종가 시계열이며, 결과는 과거 데이터 기준 계산값입니다.
 * 미래 수익을 보장하지 않습니다. 배당 재투자·수수료·세금은 반영하지 않으며 소수점 매수를 가정합니다.
 */

import type { PricePoint } from "@/lib/types";

export const BUY_DAYS = [1, 15, 25] as const;
export type BuyDay = (typeof BUY_DAYS)[number];

export const DCA_LIMITS = {
  monthly: { min: 10_000, max: 1_000_000_000 },
  minStartDate: "1990-01-01",
  /** 시뮬레이션에 필요한 최소 매수 횟수 */
  minBuys: 3,
  /** API 응답·차트용 최대 점 수 */
  maxPoints: 1600,
} as const;

export const MONTHLY_CHIPS = [100_000, 300_000, 500_000, 1_000_000] as const;
export const YEARS_AGO_CHIPS = [1, 3, 5, 10, 15, 20] as const;

export interface DcaInput {
  /** 월 적립액(원) */
  monthly: number;
  /** 시작일 YYYY-MM-DD */
  startDate: string;
  /** 매수 기준일(1/15/25). 해당 일 이후 첫 거래일에 매수 */
  dayOfMonth: BuyDay;
  /** 거치식 비교 표시 여부(같은 총 투자금을 시작일에 일시 매수) */
  lumpSum: boolean;
}

export interface DcaPoint {
  date: string;
  invested: number;
  value: number;
  lumpValue: number;
}

export interface MonthMark { date: string; pct: number }

export interface DcaTotals {
  invested: number;
  finalValue: number;
  /** (평가금 − 투자금) ÷ 투자금 × 100 */
  returnPct: number;
  /** 연환산 수익률(내부수익률·IRR 기준, %). 기간 6개월 미만이면 null */
  cagr: number | null;
  /** 평가금 기준 고점 대비 최대 하락률(%, 음수). 적립금 유입 포함 */
  maxDrawdownPct: number;
  /** 평가손익률(평가금÷투자금−1)이 가장 낮았던 월말 */
  worstMonth: MonthMark | null;
  /** 적립금 유입을 제외한 월간 평가금 변동률이 가장 높았던 월 */
  bestMonth: MonthMark | null;
  /** 월말 기준 평가금 < 투자금 이었던 달의 비율(%) */
  monthsUnderwaterPct: number;
  buys: number;
  shares: number;
  avgCost: number;
  firstBuyDate: string;
  lastDate: string;
  /** 첫 매수 ~ 마지막 데이터 사이 연수 */
  years: number;
}

export interface LumpTotals {
  invested: number;
  finalValue: number;
  returnPct: number;
  cagr: number | null;
  maxDrawdownPct: number;
}

export interface DcaResult {
  input: DcaInput;
  series: DcaPoint[];
  totals: DcaTotals;
  /** 거치식 비교(옵션 꺼져 있으면 null) */
  lump: LumpTotals | null;
  /** 요청 시작일보다 데이터가 늦게 시작하면 true */
  startClamped: boolean;
  /** 연환산 변동성(%) — 일간 로그수익률 표준편차 × √252 */
  annualizedVolPct: number | null;
}

/* ───────────────── 날짜 유틸(UTC 기준 문자열 연산) ───────────────── */

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function yearsBetween(a: string, b: string): number {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / (365.25 * 86_400_000);
}

/** 오늘(KST 기준 YYYY-MM-DD)에서 N년 전 같은 달 1일 */
export function yearsAgoDate(todayKst: string, years: number): string {
  const y = Number(todayKst.slice(0, 4)) - years;
  return `${y}-${todayKst.slice(5, 7)}-01`;
}

/** 첫 인덱스 i with hist[i].trade_date >= date (오름차순 가정) */
function lowerBound(hist: readonly PricePoint[], date: string): number {
  let lo = 0;
  let hi = hist.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const p = hist[mid];
    if (p && p.trade_date < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/* ───────────────── 다운샘플 ───────────────── */

/**
 * 긴 시계열을 매월 1·15·25일 이후 첫 거래일 + 월말 + 처음/끝 으로 축약한다.
 * (매수일 후보를 모두 남기므로 simulateDca 의 매수 가격이 원본과 동일)
 */
export function downsampleHistory(hist: readonly PricePoint[], max: number = DCA_LIMITS.maxPoints): { points: PricePoint[]; downsampled: boolean } {
  if (hist.length <= max) return { points: [...hist], downsampled: false };
  const keep = new Set<number>();
  let curYm = "";
  let f15 = false;
  let f25 = false;
  for (let i = 0; i < hist.length; i++) {
    const p = hist[i];
    if (!p) continue;
    const ym = p.trade_date.slice(0, 7);
    const day = Number(p.trade_date.slice(8, 10));
    if (ym !== curYm) {
      curYm = ym;
      f15 = false;
      f25 = false;
      keep.add(i);
      if (i > 0) keep.add(i - 1);
    }
    if (day >= 15 && !f15) { f15 = true; keep.add(i); }
    if (day >= 25 && !f25) { f25 = true; keep.add(i); }
  }
  keep.add(hist.length - 1);
  const points = [...keep].sort((a, b) => a - b).map((i) => hist[i]).filter((p): p is PricePoint => p !== undefined);
  return { points, downsampled: true };
}

/* ───────────────── 통계 ───────────────── */

/** 연환산 변동성(%) — 일간(또는 점 간) 로그수익률 표준편차 × √(연간 점 수) */
export function annualizedVol(hist: readonly PricePoint[]): number | null {
  if (hist.length < 20) return null;
  const rets: number[] = [];
  for (let i = 1; i < hist.length; i++) {
    const a = hist[i - 1];
    const b = hist[i];
    if (!a || !b || a.close <= 0 || b.close <= 0) continue;
    rets.push(Math.log(b.close / a.close));
  }
  if (rets.length < 10) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const firstP = hist[0];
  const lastP = hist[hist.length - 1];
  if (!firstP || !lastP) return null;
  const years = Math.max(yearsBetween(firstP.trade_date, lastP.trade_date), 1 / 365);
  const perYear = rets.length / years;
  return Math.sqrt(variance) * Math.sqrt(perYear) * 100;
}

/** 시계열의 고점 대비 최대 하락률(%, 음수 또는 0) 과 그 날짜 */
function maxDrawdown(values: readonly { date: string; v: number }[]): { pct: number; date: string | null } {
  let peak = -Infinity;
  let worst = 0;
  let worstDate: string | null = null;
  for (const p of values) {
    if (p.v > peak) peak = p.v;
    if (peak > 0) {
      const dd = (p.v / peak - 1) * 100;
      if (dd < worst) { worst = dd; worstDate = p.date; }
    }
  }
  return { pct: worst, date: worstDate };
}

/** 연 IRR(%) — 현금흐름: 각 매수일 −monthly, 종료일 +finalValue. 이분 탐색 */
function annualIrr(buys: readonly { t: number; amount: number }[], finalValue: number, T: number): number | null {
  if (buys.length === 0 || T <= 0 || finalValue <= 0) return null;
  const f = (r: number) => finalValue - buys.reduce((s, b) => s + b.amount * Math.pow(1 + r, T - b.t), 0);
  let lo = -0.99;
  let hi = 10;
  if (f(lo) < 0 || f(hi) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/* ───────────────── 시뮬레이션 ───────────────── */

export function normalizeDcaInput(raw: Partial<DcaInput>, todayKst: string): DcaInput {
  const monthly = Number.isFinite(raw.monthly) ? Math.round(Math.min(DCA_LIMITS.monthly.max, Math.max(DCA_LIMITS.monthly.min, raw.monthly ?? 0))) : 300_000;
  const fallbackStart = yearsAgoDate(todayKst, 5);
  let startDate = raw.startDate && isValidDateString(raw.startDate) ? raw.startDate : fallbackStart;
  if (startDate < DCA_LIMITS.minStartDate) startDate = DCA_LIMITS.minStartDate;
  if (startDate > todayKst) startDate = fallbackStart;
  const dayOfMonth: BuyDay = raw.dayOfMonth === 15 || raw.dayOfMonth === 25 ? raw.dayOfMonth : 1;
  return { monthly, startDate, dayOfMonth, lumpSum: raw.lumpSum === true };
}

/**
 * 적립식 시뮬레이션. hist 는 오름차순 종가. 매달 dayOfMonth 이후 첫 거래일 종가로 monthly 원 매수(소수점 허용).
 * 데이터가 부족(매수 3회 미만)하면 null.
 */
export function simulateDca(histIn: readonly PricePoint[], input: DcaInput): DcaResult | null {
  const hist = histIn.filter((p) => p.close > 0 && p.trade_date >= input.startDate);
  const n = hist.length;
  const first = hist[0];
  const last = hist[n - 1];
  if (!first || !last || n < 2) return null;

  // 매수일 결정
  const buyIdx: number[] = [];
  let y = Number(input.startDate.slice(0, 4));
  let m = Number(input.startDate.slice(5, 7));
  let prev = -1;
  for (let guard = 0; guard < 1200; guard++) {
    const target = `${y}-${pad2(m)}-${pad2(Math.min(input.dayOfMonth, daysInMonth(y, m)))}`;
    if (target > last.trade_date) break;
    const idx = lowerBound(hist, target);
    if (idx >= n) break;
    if (idx !== prev) { buyIdx.push(idx); prev = idx; }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  if (buyIdx.length < DCA_LIMITS.minBuys) return null;

  const firstBuy = buyIdx[0];
  const firstBuyPoint = firstBuy !== undefined ? hist[firstBuy] : undefined;
  if (firstBuy === undefined || !firstBuyPoint) return null;

  const totalInvested = input.monthly * buyIdx.length;
  const lumpShares = totalInvested / firstBuyPoint.close;

  // 시계열 순회
  const series: DcaPoint[] = [];
  let shares = 0;
  let invested = 0;
  let bi = 0;
  const buys: { t: number; amount: number }[] = [];
  for (let i = firstBuy; i < n; i++) {
    const p = hist[i];
    if (!p) continue;
    while (bi < buyIdx.length && buyIdx[bi] === i) {
      shares += input.monthly / p.close;
      invested += input.monthly;
      buys.push({ t: yearsBetween(firstBuyPoint.trade_date, p.trade_date), amount: input.monthly });
      bi += 1;
    }
    series.push({ date: p.trade_date, invested, value: shares * p.close, lumpValue: lumpShares * p.close });
  }
  const lastPt = series[series.length - 1];
  if (!lastPt) return null;

  // 월말 통계
  const monthEnds: DcaPoint[] = [];
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    const next = series[i + 1];
    if (cur && (!next || next.date.slice(0, 7) !== cur.date.slice(0, 7))) monthEnds.push(cur);
  }
  let worstMonth: MonthMark | null = null;
  let bestMonth: MonthMark | null = null;
  let underwater = 0;
  for (let i = 0; i < monthEnds.length; i++) {
    const me = monthEnds[i];
    if (!me || me.invested <= 0) continue;
    const pnl = (me.value / me.invested - 1) * 100;
    if (me.value < me.invested) underwater += 1;
    if (!worstMonth || pnl < worstMonth.pct) worstMonth = { date: me.date, pct: pnl };
    const pm = monthEnds[i - 1];
    if (pm && pm.value > 0) {
      const contrib = me.invested - pm.invested;
      const r = ((me.value - contrib) / pm.value - 1) * 100;
      if (!bestMonth || r > bestMonth.pct) bestMonth = { date: me.date, pct: r };
    }
  }

  const years = Math.max(yearsBetween(firstBuyPoint.trade_date, lastPt.date), 1 / 365);
  const dd = maxDrawdown(series.map((s) => ({ date: s.date, v: s.value })));
  const cagr = years >= 0.5 ? annualIrr(buys, lastPt.value, years) : null;

  const totals: DcaTotals = {
    invested: lastPt.invested,
    finalValue: lastPt.value,
    returnPct: lastPt.invested > 0 ? (lastPt.value / lastPt.invested - 1) * 100 : 0,
    cagr,
    maxDrawdownPct: dd.pct,
    worstMonth,
    bestMonth,
    monthsUnderwaterPct: monthEnds.length ? (underwater / monthEnds.length) * 100 : 0,
    buys: buyIdx.length,
    shares,
    avgCost: shares > 0 ? lastPt.invested / shares : 0,
    firstBuyDate: firstBuyPoint.trade_date,
    lastDate: lastPt.date,
    years,
  };

  let lump: LumpTotals | null = null;
  if (input.lumpSum) {
    const lumpDd = maxDrawdown(series.map((s) => ({ date: s.date, v: s.lumpValue })));
    const finalValue = lastPt.lumpValue;
    lump = {
      invested: totalInvested,
      finalValue,
      returnPct: (finalValue / totalInvested - 1) * 100,
      cagr: years >= 0.5 && finalValue > 0 ? (Math.pow(finalValue / totalInvested, 1 / years) - 1) * 100 : null,
      maxDrawdownPct: lumpDd.pct,
    };
  }

  return {
    input,
    series,
    totals,
    lump,
    startClamped: firstBuyPoint.trade_date.slice(0, 7) !== input.startDate.slice(0, 7),
    annualizedVolPct: annualizedVol(hist.slice(firstBuy)),
  };
}

/* ───────────────── URL 파라미터 ───────────────── */

export type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export interface DcaParams { code: string | null; input: DcaInput }

/** URL → 입력. 키: c(종목코드) m(월 적립액) s(시작일) d(매수일 1|15|25) l(거치식 비교 1) */
export function parseDcaParams(sp: SearchParamsLike, todayKst: string): DcaParams {
  const c = first(sp.c);
  const code = c && /^\d{6}$/.test(c) ? c : null;
  const d = Number(first(sp.d));
  const input = normalizeDcaInput({
    monthly: first(sp.m) !== undefined ? Number(first(sp.m)) : undefined,
    startDate: first(sp.s),
    dayOfMonth: d === 15 || d === 25 ? d : 1,
    lumpSum: first(sp.l) === "1",
  }, todayKst);
  return { code, input };
}

export function encodeDcaParams(code: string | null, input: DcaInput): string {
  const q = new URLSearchParams();
  if (code) q.set("c", code);
  q.set("m", String(Math.round(input.monthly)));
  q.set("s", input.startDate);
  if (input.dayOfMonth !== 1) q.set("d", String(input.dayOfMonth));
  if (input.lumpSum) q.set("l", "1");
  return q.toString();
}
