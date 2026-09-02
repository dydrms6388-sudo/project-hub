/** 공통 도메인 타입 — DB(supabase/migrations) 컬럼명과 1:1 대응(snake_case). */

export type Market = "KOSPI" | "KOSDAQ";

export interface Stock {
  code: string; // 6자리 종목코드
  name: string;
  market: Market;
  sector: string | null;
}

/** financials: 종목별 최신 재무 스냅샷(일배치 갱신) */
export interface Financial {
  code: string;
  fiscal_year: number;
  price: number | null; // 지연 시세(전일 종가 기준)
  market_cap: number | null; // 억원
  per: number | null;
  pbr: number | null;
  roe: number | null; // %
  debt_ratio: number | null; // 부채비율 %
  eps: number | null;
  bps: number | null;
  revenue: number | null; // 억원
  operating_income: number | null; // 억원
  net_income: number | null; // 억원
  as_of: string; // YYYY-MM-DD (데이터 기준일)
}

/** dividends: 종목별 배당 요약 */
export interface Dividend {
  code: string;
  fiscal_year: number;
  dps: number | null; // 주당배당금(원)
  dividend_yield: number | null; // %
  payout_ratio: number | null; // 배당성향 %
  consecutive_years: number; // 연속 배당 연수
  ex_dividend_date: string | null; // YYYY-MM-DD
  pay_months: number[] | null; // 배당 지급 예상 월(1~12). 예: 연배당 [4], 분기배당 [4,5,8,11]
  as_of: string;
}

/** daily_prices 의 종가 시계열 한 점 */
export interface PricePoint {
  trade_date: string; // YYYY-MM-DD
  close: number;
}

export interface ScreenRow extends Stock {
  price: number | null;
  market_cap: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  debt_ratio: number | null;
  dividend_yield: number | null;
  as_of: string;
}

export interface DividendRow extends Stock {
  price: number | null;
  market_cap: number | null;
  dps: number | null;
  dividend_yield: number | null;
  payout_ratio: number | null;
  consecutive_years: number;
  ex_dividend_date: string | null;
  pay_months: number[] | null;
  as_of: string;
}

export interface ValueFilters {
  perMax: number; // 0 < PER <= perMax
  pbrMax: number; // 0 < PBR <= pbrMax
  roeMin: number; // ROE >= roeMin
  debtMax: number; // 부채비율 <= debtMax
  market: Market | "ALL";
  sort: "per" | "pbr" | "roe" | "market_cap";
}

export interface DividendFilters {
  yieldMin: number; // 배당수익률 >= yieldMin
  yearsMin: number; // 연속배당연수 >= yearsMin
  payoutMax: number; // 배당성향 <= payoutMax (0 = 무제한)
  market: Market | "ALL";
  sort: "dividend_yield" | "consecutive_years" | "market_cap";
}

/** daily_picks: 매일 06:00 KST 기본 전략으로 선정된 "조건 충족 종목" 1개 */
export interface DailyPick {
  pick_date: string; // YYYY-MM-DD (KST)
  code: string;
  name: string;
  market: Market;
  strategy_key: string; // 예: "low-pbr-high-roe"
  strategy_label: string; // 예: "저PBR + 고ROE"
  conditions: string[]; // 충족 조건 설명 문장
  metrics: Record<string, number | string | null>;
  data_as_of: string;
}

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string; // ISO — 다음 KST 00:00
}

export type DataMode = "supabase" | "sample";
