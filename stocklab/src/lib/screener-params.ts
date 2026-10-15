import type { DividendFilters, Market, ValueFilters } from "@/lib/types";
import { clampNum } from "@/lib/format";

/** Next 15 `searchParams` 형태 (await 이후) */
export type SearchParams = Record<string, string | string[] | undefined>;

/* ───────────────────────── 기본값 / 입력 범위 ───────────────────────── */

export const VALUE_DEFAULTS: ValueFilters = {
  perMax: 10,
  pbrMax: 1,
  roeMin: 10,
  debtMax: 150,
  market: "ALL",
  sort: "per",
};

export const DIVIDEND_DEFAULTS: DividendFilters = {
  yieldMin: 4,
  yearsMin: 3,
  payoutMax: 0, // 0 = 무제한
  market: "ALL",
  sort: "dividend_yield",
};

export interface NumLimit { min: number; max: number; step: number }

export const VALUE_LIMITS: Record<"perMax" | "pbrMax" | "roeMin" | "debtMax", NumLimit> = {
  perMax: { min: 0.5, max: 200, step: 0.5 },
  pbrMax: { min: 0.1, max: 50, step: 0.1 },
  roeMin: { min: -100, max: 100, step: 0.5 },
  debtMax: { min: 0, max: 5000, step: 10 },
};

export const DIVIDEND_LIMITS: Record<"yieldMin" | "yearsMin" | "payoutMax", NumLimit> = {
  yieldMin: { min: 0, max: 50, step: 0.1 },
  yearsMin: { min: 0, max: 50, step: 1 },
  payoutMax: { min: 0, max: 300, step: 5 },
};

export const VALUE_SORTS: { value: ValueFilters["sort"]; label: string }[] = [
  { value: "per", label: "PER 낮은 순" },
  { value: "pbr", label: "PBR 낮은 순" },
  { value: "roe", label: "ROE 높은 순" },
  { value: "market_cap", label: "시가총액 큰 순" },
];

export const DIVIDEND_SORTS: { value: DividendFilters["sort"]; label: string }[] = [
  { value: "dividend_yield", label: "배당수익률 높은 순" },
  { value: "consecutive_years", label: "연속배당연수 긴 순" },
  { value: "market_cap", label: "시가총액 큰 순" },
];

export const MARKETS: { value: Market | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "KOSPI", label: "코스피" },
  { value: "KOSDAQ", label: "코스닥" },
];

/* ───────────────────────── 파싱 ───────────────────────── */

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseMarket(v: string | undefined): Market | "ALL" {
  return v === "KOSPI" || v === "KOSDAQ" ? v : "ALL";
}

function num(sp: SearchParams, key: string, lim: NumLimit, fallback: number): number {
  const raw = first(sp[key]);
  if (raw === undefined || raw === "") return fallback;
  return clampNum(raw, lim.min, lim.max, fallback);
}

/** `run=1` 일 때만 실제 스크리닝을 실행(사용량 소비). 첫 방문은 폼만 노출. */
export function isRun(sp: SearchParams): boolean {
  return first(sp.run) === "1";
}

export function parseValueFilters(sp: SearchParams): ValueFilters {
  const sortRaw = first(sp.sort);
  const sort = VALUE_SORTS.some((s) => s.value === sortRaw) ? (sortRaw as ValueFilters["sort"]) : VALUE_DEFAULTS.sort;
  return {
    perMax: num(sp, "perMax", VALUE_LIMITS.perMax, VALUE_DEFAULTS.perMax),
    pbrMax: num(sp, "pbrMax", VALUE_LIMITS.pbrMax, VALUE_DEFAULTS.pbrMax),
    roeMin: num(sp, "roeMin", VALUE_LIMITS.roeMin, VALUE_DEFAULTS.roeMin),
    debtMax: num(sp, "debtMax", VALUE_LIMITS.debtMax, VALUE_DEFAULTS.debtMax),
    market: parseMarket(first(sp.market)),
    sort,
  };
}

export function parseDividendFilters(sp: SearchParams): DividendFilters {
  const sortRaw = first(sp.sort);
  const sort = DIVIDEND_SORTS.some((s) => s.value === sortRaw) ? (sortRaw as DividendFilters["sort"]) : DIVIDEND_DEFAULTS.sort;
  return {
    yieldMin: num(sp, "yieldMin", DIVIDEND_LIMITS.yieldMin, DIVIDEND_DEFAULTS.yieldMin),
    yearsMin: Math.round(num(sp, "yearsMin", DIVIDEND_LIMITS.yearsMin, DIVIDEND_DEFAULTS.yearsMin)),
    payoutMax: num(sp, "payoutMax", DIVIDEND_LIMITS.payoutMax, DIVIDEND_DEFAULTS.payoutMax),
    market: parseMarket(first(sp.market)),
    sort,
  };
}

/* ───────────────────────── 공유 URL ───────────────────────── */

function build(entries: Record<string, string | number>, run: boolean): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) q.set(k, String(v));
  if (run) q.set("run", "1");
  return q.toString();
}

/** ValueFilters → 쿼리스트링 (`?` 제외). run=true 면 실행 플래그 포함 */
export function valueToSearchParams(f: ValueFilters, run = true): string {
  return build({ perMax: f.perMax, pbrMax: f.pbrMax, roeMin: f.roeMin, debtMax: f.debtMax, market: f.market, sort: f.sort }, run);
}

export function dividendToSearchParams(f: DividendFilters, run = true): string {
  return build({ yieldMin: f.yieldMin, yearsMin: f.yearsMin, payoutMax: f.payoutMax, market: f.market, sort: f.sort }, run);
}

/** 범용 — 페이지 종류에 맞는 함수로 위임 */
export function toSearchParams(kind: "value", f: ValueFilters, run?: boolean): string;
export function toSearchParams(kind: "dividend", f: DividendFilters, run?: boolean): string;
export function toSearchParams(kind: "value" | "dividend", f: ValueFilters | DividendFilters, run = true): string {
  return kind === "value" ? valueToSearchParams(f as ValueFilters, run) : dividendToSearchParams(f as DividendFilters, run);
}

export const VALUE_PATH = "/screener/value";
export const DIVIDEND_PATH = "/screener/dividend";

export function valueHref(f: ValueFilters, run = true): string {
  return `${VALUE_PATH}?${valueToSearchParams(f, run)}`;
}
export function dividendHref(f: DividendFilters, run = true): string {
  return `${DIVIDEND_PATH}?${dividendToSearchParams(f, run)}`;
}

/* ───────────────────────── 프리셋 ───────────────────────── */

export interface Preset<T> {
  key: string;
  label: string;
  description: string;
  filters: T;
}

export const VALUE_PRESETS: Preset<ValueFilters>[] = [
  {
    key: "basic",
    label: "저평가 기본",
    description: "PER 10배 이하 · PBR 1배 이하 · ROE 10% 이상 · 부채비율 150% 이하",
    filters: { ...VALUE_DEFAULTS },
  },
  {
    key: "graham",
    label: "그레이엄 스타일",
    description: "PER 10배 이하 · PBR 1배 이하 · 부채비율 100% 이하 · 흑자(ROE 0% 이상)",
    filters: { perMax: 10, pbrMax: 1, roeMin: 0, debtMax: 100, market: "ALL", sort: "pbr" },
  },
  {
    key: "quality-low-pbr",
    label: "우량 저PBR",
    description: "PBR 0.8배 이하 · ROE 8% 이상 · 부채비율 100% 이하 · PER 15배 이하",
    filters: { perMax: 15, pbrMax: 0.8, roeMin: 8, debtMax: 100, market: "ALL", sort: "roe" },
  },
];

export const DIVIDEND_PRESETS: Preset<DividendFilters>[] = [
  {
    key: "basic",
    label: "고배당 기본",
    description: "배당수익률 4% 이상 · 연속배당 3년 이상 · 배당성향 제한 없음",
    filters: { ...DIVIDEND_DEFAULTS },
  },
  {
    key: "aristocrat",
    label: "배당 귀족",
    description: "연속배당 5년 이상 · 배당수익률 3% 이상 · 배당성향 70% 이하",
    filters: { yieldMin: 3, yearsMin: 5, payoutMax: 70, market: "ALL", sort: "consecutive_years" },
  },
  {
    key: "stable",
    label: "안정 배당",
    description: "연속배당 7년 이상 · 배당수익률 2.5% 이상 · 배당성향 60% 이하 · 시총 큰 순",
    filters: { yieldMin: 2.5, yearsMin: 7, payoutMax: 60, market: "ALL", sort: "market_cap" },
  },
];

/** 현재 필터가 어떤 프리셋과 정확히 일치하면 그 key 를 돌려준다 (활성 표시용) */
export function matchValuePreset(f: ValueFilters): string | null {
  return VALUE_PRESETS.find((p) => valueToSearchParams(p.filters, false) === valueToSearchParams(f, false))?.key ?? null;
}
export function matchDividendPreset(f: DividendFilters): string | null {
  return DIVIDEND_PRESETS.find((p) => dividendToSearchParams(p.filters, false) === dividendToSearchParams(f, false))?.key ?? null;
}

/** 필터를 사람이 읽는 한 줄로 (요약/미리보기용) */
export function describeValueFilters(f: ValueFilters): string {
  const m = MARKETS.find((x) => x.value === f.market)?.label ?? "전체";
  return `PER ${f.perMax}배 이하 · PBR ${f.pbrMax}배 이하 · ROE ${f.roeMin}% 이상 · 부채비율 ${f.debtMax}% 이하 · 시장 ${m}`;
}
export function describeDividendFilters(f: DividendFilters): string {
  const m = MARKETS.find((x) => x.value === f.market)?.label ?? "전체";
  const payout = f.payoutMax > 0 ? `배당성향 ${f.payoutMax}% 이하` : "배당성향 제한 없음";
  return `배당수익률 ${f.yieldMin}% 이상 · 연속배당 ${f.yearsMin}년 이상 · ${payout} · 시장 ${m}`;
}
