import sample from "../../../data/sample-stocks.json";
import type {
  DailyPick, Dividend, DividendFilters, DividendRow, Financial, ScreenRow, Stock, UsageResult, ValueFilters,
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
      dividend.push({ ...s, price: f?.price ?? null, market_cap: f?.market_cap ?? null, dps: d.dps, dividend_yield: d.dividend_yield, payout_ratio: d.payout_ratio, consecutive_years: d.consecutive_years, ex_dividend_date: d.ex_dividend_date, as_of: d.as_of });
    }
  }
  return { value, dividend };
}
const joined = joinRows();

export const sampleSource: DataSource = {
  mode: "sample",
  async dataAsOf() { return file.as_of; },
  async listStocks() { return file.stocks; },
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
