import sample from "../../../data/sample-stocks.json";
import type {
  DailyPick, Dividend, DividendFilters, DividendRow, Financial, PricePoint, ScreenRow, Stock, UsageResult, ValueFilters,
} from "@/lib/types";
import type { DataSource } from "./source";
import { nextKstMidnightIso } from "@/lib/kst";
import { applyDividendFilters, applyValueFilters } from "./filters";

interface SampleFile { as_of: string; stocks: Stock[]; financials: Financial[]; dividends: Dividend[] }
const file = sample as unknown as SampleFile;

// 인스턴스 메모리(서버리스에선 콜드스타트마다 초기화) — 샘플 모드 전용
const picks = new Map<string, DailyPick>();
const usage = new Map<string, number>();

function joinRows(): { value: ScreenRow[]; dividend: DividendRow[] } {
  const fin = new Map(file.financials.map((f) => [f.code, f]));
  const div = new Map(file.dividends.map((d) => [d.code, d]));
  const value: ScreenRow[] = [];
  const dividend: DividendRow[] = [];
  for (const s of file.stocks) {
    const f = fin.get(s.code);
    const d = div.get(s.code);
    if (f) {
      value.push({ ...s, price: f.price, market_cap: f.market_cap, per: f.per, pbr: f.pbr, roe: f.roe, debt_ratio: f.debt_ratio, dividend_yield: d?.dividend_yield ?? null, as_of: f.as_of });
    }
    if (d) {
      dividend.push({ ...s, price: f?.price ?? null, market_cap: f?.market_cap ?? null, dps: d.dps, dividend_yield: d.dividend_yield, payout_ratio: d.payout_ratio, consecutive_years: d.consecutive_years, ex_dividend_date: d.ex_dividend_date, pay_months: d.pay_months ?? null, as_of: d.as_of });
    }
  }
  return { value, dividend };
}
const joined = joinRows();
const valueByCode = new Map(joined.value.map((r) => [r.code, r]));
const dividendByCode = new Map(joined.dividend.map((r) => [r.code, r]));
const priceCache = new Map<string, PricePoint[]>();

// mulberry32 — 종목코드 시드로 결정적 합성 시계열(GBM). 실제 시세 아님.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r: () => number) { const u = Math.max(r(), 1e-12); const v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** 현재가(as_of)에서 과거로 거꾸로 걷는 GBM — 마지막 점이 현재 샘플 가격과 일치 */
function synthHistory(code: string, sector: string | null, endPrice: number, asOf: string): PricePoint[] {
  const r = rng(Number.parseInt(code, 10) || 1);
  const vol = /바이오|2차전지|게임|엔터/.test(sector ?? "") ? 0.45 : /금융|보험|통신|유틸리티|담배/.test(sector ?? "") ? 0.18 : 0.28;
  const drift = 0.06; // 연 6% 가정
  const dt = 1 / 252, sd = vol * Math.sqrt(dt), mu = (drift - (vol * vol) / 2) * dt;
  const end = new Date(`${asOf}T00:00:00Z`);
  const start = Date.UTC(end.getUTCFullYear() - 20, 0, 1);
  const out: PricePoint[] = [];
  let p = endPrice;
  for (let t = end.getTime(); t >= start; t -= 86400000) {
    const d = new Date(t); const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.push({ trade_date: d.toISOString().slice(0, 10), close: Math.max(100, Math.round(p / 10) * 10) });
    p = p / Math.exp(mu + sd * gauss(r)); // 역방향
  }
  return out.reverse();
}

export const sampleSource: DataSource = {
  mode: "sample",
  async dataAsOf() { return file.as_of; },
  async listStocks() { return file.stocks; },
  async getStock(code) { return file.stocks.find((s) => s.code === code) ?? null; },
  async searchStocks(query, limit) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return file.stocks.filter((s) => s.code.startsWith(q) || s.name.toLowerCase().includes(q)).slice(0, limit);
  },
  async getScreenRow(code) { return valueByCode.get(code) ?? null; },
  async getDividendRow(code) { return dividendByCode.get(code) ?? null; },
  async getPriceHistory(code, fromDate) {
    let hist = priceCache.get(code);
    if (!hist) {
      const row = valueByCode.get(code); const st = file.stocks.find((s) => s.code === code);
      if (!row || !st || row.price === null) return [];
      hist = synthHistory(code, st.sector, row.price, row.as_of);
      priceCache.set(code, hist);
    }
    return hist.filter((p) => p.trade_date >= fromDate);
  },
  async allScreenRows() { return joined.value; },
  async allDividendRows() { return joined.dividend; },
  async screenValue(filters: ValueFilters, limit: number) {
    return applyValueFilters(joined.value, filters).slice(0, limit);
  },
  async screenDividend(filters: DividendFilters, limit: number) {
    return applyDividendFilters(joined.dividend, filters).slice(0, limit);
  },
  async getPick(pickDate) { return picks.get(pickDate) ?? null; },
  async getLatestPick() {
    const dates = [...picks.keys()].sort();
    const last = dates[dates.length - 1];
    return last ? picks.get(last) ?? null : null;
  },
  async savePick(pick) { picks.set(pick.pick_date, pick); },
  async consumeUsage(key, feature, limit, dateKst): Promise<UsageResult> {
    const k = `${dateKst}:${feature}:${key}`;
    const used = (usage.get(k) ?? 0) + 1;
    usage.set(k, used);
    return { allowed: used <= limit, used: Math.min(used, limit), limit, remaining: Math.max(0, limit - used), resetsAt: nextKstMidnightIso() };
  },
};
