import type { DividendFilters, DividendRow, ScreenRow, ValueFilters } from "@/lib/types";

/** 순수 함수 필터 — sample 소스와 supabase 소스 후처리(정렬 등)에서 공유 */
export function applyValueFilters(rows: ScreenRow[], f: ValueFilters): ScreenRow[] {
  const out = rows.filter((r) => {
    if (f.market !== "ALL" && r.market !== f.market) return false;
    if (r.per === null || r.per <= 0 || r.per > f.perMax) return false;
    if (r.pbr === null || r.pbr <= 0 || r.pbr > f.pbrMax) return false;
    if (r.roe === null || r.roe < f.roeMin) return false;
    if (r.debt_ratio === null || r.debt_ratio > f.debtMax) return false;
    return true;
  });
  return sortRows(out, f.sort, f.sort === "roe" || f.sort === "market_cap" ? "desc" : "asc");
}

export function applyDividendFilters(rows: DividendRow[], f: DividendFilters): DividendRow[] {
  const out = rows.filter((r) => {
    if (f.market !== "ALL" && r.market !== f.market) return false;
    if (r.dividend_yield === null || r.dividend_yield < f.yieldMin) return false;
    if (r.consecutive_years < f.yearsMin) return false;
    if (f.payoutMax > 0 && (r.payout_ratio === null || r.payout_ratio > f.payoutMax)) return false;
    return true;
  });
  return sortRows(out, f.sort, "desc");
}

function sortRows<T extends object>(rows: T[], key: string, dir: "asc" | "desc"): T[] {
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]; const bv = (b as Record<string, unknown>)[key];
    const an = typeof av === "number" ? av : Number.POSITIVE_INFINITY;
    const bn = typeof bv === "number" ? bv : Number.POSITIVE_INFINITY;
    return dir === "asc" ? an - bn : bn - an;
  });
}
