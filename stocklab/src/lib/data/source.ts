import type {
  DailyPick,
  PricePoint,
  DataMode,
  DividendFilters,
  DividendRow,
  ScreenRow,
  Stock,
  UsageResult,
  ValueFilters,
} from "@/lib/types";

/**
 * 데이터 소스 추상화.
 * - supabase: 운영 (일배치 적재된 financials/dividends/daily_picks)
 * - sample:   Supabase env 미설정 시 자동 폴백. data/sample-stocks.json 의 합성 데이터.
 *             화면에 "샘플 데이터" 배너를 반드시 노출한다 (실제 시세 아님).
 */
export interface DataSource {
  readonly mode: DataMode;
  dataAsOf(): Promise<string | null>;
  listStocks(): Promise<Stock[]>;
  getStock(code: string): Promise<Stock | null>;
  /** 종목명/코드 부분 일치 검색 */
  searchStocks(query: string, limit: number): Promise<Stock[]>;
  getScreenRow(code: string): Promise<ScreenRow | null>;
  getDividendRow(code: string): Promise<DividendRow | null>;
  /** 종가 시계열(오름차순). fromDate 이후. 샘플 모드는 시드 기반 합성 시계열 */
  getPriceHistory(code: string, fromDate: string): Promise<PricePoint[]>;
  screenValue(filters: ValueFilters, limit: number): Promise<ScreenRow[]>;
  screenDividend(filters: DividendFilters, limit: number): Promise<DividendRow[]>;
  /** 모든 종목의 스크리닝용 전체 행(전략 선정에 사용) */
  allScreenRows(): Promise<ScreenRow[]>;
  allDividendRows(): Promise<DividendRow[]>;
  getPick(pickDate: string): Promise<DailyPick | null>;
  getLatestPick(): Promise<DailyPick | null>;
  savePick(pick: DailyPick): Promise<void>;
  /** 비로그인 일일 조회 제한 — key = hash(ip + 쿠키 uid) */
  consumeUsage(key: string, feature: string, limit: number, dateKst: string): Promise<UsageResult>;
}
