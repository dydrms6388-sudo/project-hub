import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyPick, DividendFilters, DividendRow, PricePoint, ScreenRow, Stock, UsageResult, ValueFilters,
} from "@/lib/types";
import type { DataSource } from "./source";
import { nextKstMidnightIso } from "@/lib/kst";
import { applyDividendFilters, applyValueFilters } from "./filters";

/**
 * Supabase 소스. 읽기는 anon 키(RLS: 공개 데이터 select 허용),
 * 쓰기(usage_limits / daily_picks)는 서버 전용 service role 키.
 * 뷰: v_screen_value, v_screen_dividend (supabase/migrations 참고)
 */
export function createSupabaseSource(url: string, anonKey: string, serviceKey?: string): DataSource {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const admin: SupabaseClient = serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : anon;

  async function fetchAllValue(): Promise<ScreenRow[]> {
    const { data, error } = await anon.from("v_screen_value").select("*");
    if (error) throw new Error(`v_screen_value: ${error.message}`);
    return (data ?? []) as ScreenRow[];
  }
  async function fetchAllDividend(): Promise<DividendRow[]> {
    const { data, error } = await anon.from("v_screen_dividend").select("*");
    if (error) throw new Error(`v_screen_dividend: ${error.message}`);
    return (data ?? []) as DividendRow[];
  }

  return {
    mode: "supabase",
    async dataAsOf() {
      const { data } = await anon.from("financials").select("as_of").order("as_of", { ascending: false }).limit(1).maybeSingle();
      return (data?.as_of as string | undefined) ?? null;
    },
    async listStocks() {
      const { data, error } = await anon.from("stocks").select("code,name,market,sector").eq("is_active", true).order("code");
      if (error) throw new Error(`stocks: ${error.message}`);
      return (data ?? []) as Stock[];
    },
    async getStock(code) {
      const { data } = await anon.from("stocks").select("code,name,market,sector").eq("code", code).maybeSingle();
      return (data as Stock | null) ?? null;
    },
    async searchStocks(query, limit) {
      const q = query.trim();
      if (!q) return [];
      const { data, error } = await anon.from("stocks").select("code,name,market,sector").eq("is_active", true)
        .or(`code.ilike.${q}%,name.ilike.%${q.replace(/[%_,()]/g, "")}%`).limit(limit);
      if (error) throw new Error(`searchStocks: ${error.message}`);
      return (data ?? []) as Stock[];
    },
    async getScreenRow(code) {
      const { data } = await anon.from("v_screen_value").select("*").eq("code", code).maybeSingle();
      return (data as ScreenRow | null) ?? null;
    },
    async getDividendRow(code) {
      const { data } = await anon.from("v_screen_dividend").select("*").eq("code", code).maybeSingle();
      return (data as DividendRow | null) ?? null;
    },
    async getPriceHistory(code, fromDate) {
      const { data, error } = await anon.from("daily_prices").select("trade_date,close").eq("code", code)
        .gte("trade_date", fromDate).order("trade_date", { ascending: true }).limit(10000);
      if (error) throw new Error(`daily_prices: ${error.message}`);
      return ((data ?? []) as { trade_date: string; close: number | null }[])
        .filter((p): p is { trade_date: string; close: number } => p.close !== null)
        .map((p) => ({ trade_date: p.trade_date, close: Number(p.close) }));
    },
    allScreenRows: fetchAllValue,
    allDividendRows: fetchAllDividend,
    async screenValue(filters: ValueFilters, limit: number) {
      // 1차 필터는 DB에서, 정렬/최종 필터는 공유 함수로 (전 종목 ~2,700행 규모 → 서버 후처리 부담 낮음)
      let q = anon.from("v_screen_value").select("*")
        .gt("per", 0).lte("per", filters.perMax)
        .gt("pbr", 0).lte("pbr", filters.pbrMax)
        .gte("roe", filters.roeMin).lte("debt_ratio", filters.debtMax);
      if (filters.market !== "ALL") q = q.eq("market", filters.market);
      const { data, error } = await q.limit(2000);
      if (error) throw new Error(`screenValue: ${error.message}`);
      return applyValueFilters((data ?? []) as ScreenRow[], filters).slice(0, limit);
    },
    async screenDividend(filters: DividendFilters, limit: number) {
      let q = anon.from("v_screen_dividend").select("*")
        .gte("dividend_yield", filters.yieldMin).gte("consecutive_years", filters.yearsMin);
      if (filters.payoutMax > 0) q = q.lte("payout_ratio", filters.payoutMax);
      if (filters.market !== "ALL") q = q.eq("market", filters.market);
      const { data, error } = await q.limit(2000);
      if (error) throw new Error(`screenDividend: ${error.message}`);
      return applyDividendFilters((data ?? []) as DividendRow[], filters).slice(0, limit);
    },
    async getPick(pickDate) {
      const { data } = await anon.from("daily_picks").select("*").eq("pick_date", pickDate).maybeSingle();
      return (data as DailyPick | null) ?? null;
    },
    async getLatestPick() {
      const { data } = await anon.from("daily_picks").select("*").order("pick_date", { ascending: false }).limit(1).maybeSingle();
      return (data as DailyPick | null) ?? null;
    },
    async savePick(pick) {
      const { error } = await admin.from("daily_picks").upsert(pick, { onConflict: "pick_date" });
      if (error) throw new Error(`savePick: ${error.message}`);
    },
    async consumeUsage(key, feature, limit, dateKst): Promise<UsageResult> {
      const { data, error } = await admin.rpc("consume_usage", { p_key: key, p_feature: feature, p_date: dateKst });
      if (error) throw new Error(`consume_usage: ${error.message}`);
      const used = Number(data ?? 0);
      return { allowed: used <= limit, used: Math.min(used, limit), limit, remaining: Math.max(0, limit - used), resetsAt: nextKstMidnightIso() };
    },
  };
}
