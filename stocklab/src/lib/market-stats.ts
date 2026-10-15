import { isNum, median } from "@/lib/factcheck";
import type { DividendRow, ScreenRow } from "@/lib/types";

/**
 * 시장 온도계 — 전 종목 스냅샷을 시장(전체/코스피/코스닥)별 분포 숫자로 집계한다.
 * 감정·방향 표현(공포·탐욕·바닥·고점 등)은 만들지 않으며, 중앙값·비중·가중 배수만 계산한다.
 * 순수 함수(입출력만). I/O 없음, 입력 배열을 변경하지 않는다.
 */

export type MarketKey = "ALL" | "KOSPI" | "KOSDAQ";

export const MARKET_KEYS: readonly MarketKey[] = ["ALL", "KOSPI", "KOSDAQ"] as const;

export const MARKET_KEY_LABEL: Record<MarketKey, string> = {
  ALL: "전체",
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
};

/** 비중 계산 임계값 (화면에 그대로 공개) */
export const MARKET_THRESHOLDS = {
  perUnder: 10,
  pbrUnder: 1,
  roeOver: 10,
  yieldOver: 3,
} as const;

export interface SectorStat {
  sector: string;
  count: number;
  medianPer: number | null;
  medianPbr: number | null;
  medianRoe: number | null;
  /** 해당 업종 종목 중 PBR 1배 미만 비중(%) — 분모는 업종 전체 종목 수 */
  lowPbrShare: number;
}

export interface MarketSnapshot {
  key: MarketKey;
  /** 해당 시장의 스냅샷 종목 수 (모든 비중의 분모) */
  count: number;
  medianPer: number | null;
  medianPbr: number | null;
  medianRoe: number | null;
  medianDebtRatio: number | null;
  /** 아래 비중은 모두 count 대비 % */
  sharePerUnder10: number;
  sharePbrUnder1: number;
  shareRoeOver10: number;
  /** PER 데이터 없음(적자로 산출 불가 포함) 또는 ROE 음수 */
  shareLoss: number;
  shareYieldOver3: number;
  /** 시가총액 가중 PER = Σ시총 ÷ Σ(시총 ÷ PER). PER>0·시총>0 종목만 사용 */
  capWeightedPer: number | null;
  capWeightedPbr: number | null;
  /** 가중 배수 산출에 실제로 쓰인 종목 수 */
  capWeightedPerCount: number;
  capWeightedPbrCount: number;
  /** 히스토그램용 원자료 (양수만) */
  perValues: number[];
  pbrValues: number[];
  /** 종목 수 내림차순 */
  sectors: SectorStat[];
}

export interface MarketStats {
  asOf: string | null;
  markets: Record<MarketKey, MarketSnapshot>;
}

export interface HistogramBinDef {
  from: number;
  to: number;
}

export interface HistogramBin extends HistogramBinDef {
  count: number;
  /** 전체 표본 대비 비중(%) */
  share: number;
}

/**
 * 구간별 도수. 각 구간은 `from 이상 to 미만`이며 값은 첫 번째로 맞는 구간에만 들어간다.
 * 마지막 구간의 `to` 를 Infinity 로 두면 상단 잔여분을 모두 담는다.
 */
export function histogram(values: number[], bins: HistogramBinDef[]): HistogramBin[] {
  const pool = values.filter(isNum);
  const counts: number[] = bins.map(() => 0);
  for (const v of pool) {
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      if (!b) continue;
      if (v >= b.from && v < b.to) {
        counts[i] = (counts[i] ?? 0) + 1;
        break;
      }
    }
  }
  return bins.map((b, i) => {
    const count = counts[i] ?? 0;
    return { from: b.from, to: b.to, count, share: pool.length > 0 ? (count / pool.length) * 100 : 0 };
  });
}

function share(matched: number, total: number): number {
  return total > 0 ? (matched / total) * 100 : 0;
}

/** Σ시총 ÷ Σ(시총 ÷ 배수) — 분모가 0이면 null */
function capWeighted(rows: ScreenRow[], pick: (r: ScreenRow) => number | null): { value: number | null; used: number } {
  let capSum = 0;
  let ratioSum = 0;
  let used = 0;
  for (const r of rows) {
    const cap = r.market_cap;
    const m = pick(r);
    if (!isNum(cap) || cap <= 0 || !isNum(m) || m <= 0) continue;
    capSum += cap;
    ratioSum += cap / m;
    used++;
  }
  if (used === 0 || ratioSum <= 0 || capSum <= 0) return { value: null, used };
  return { value: capSum / ratioSum, used };
}

function buildSectors(rows: ScreenRow[]): SectorStat[] {
  const groups = new Map<string, ScreenRow[]>();
  for (const r of rows) {
    const key = r.sector && r.sector.trim() ? r.sector : "미분류";
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  const out: SectorStat[] = [];
  for (const [sector, list] of groups) {
    const lowPbr = list.filter((r) => isNum(r.pbr) && r.pbr > 0 && r.pbr < MARKET_THRESHOLDS.pbrUnder).length;
    out.push({
      sector,
      count: list.length,
      medianPer: median(list.map((r) => r.per).filter((v): v is number => isNum(v) && v > 0)),
      medianPbr: median(list.map((r) => r.pbr).filter((v): v is number => isNum(v) && v > 0)),
      medianRoe: median(list.map((r) => r.roe).filter(isNum)),
      lowPbrShare: share(lowPbr, list.length),
    });
  }
  return out.sort((a, b) => (b.count - a.count) || a.sector.localeCompare(b.sector, "ko"));
}

function buildSnapshot(key: MarketKey, rows: ScreenRow[], yieldByCode: Map<string, number>): MarketSnapshot {
  const count = rows.length;
  const perValues = rows.map((r) => r.per).filter((v): v is number => isNum(v) && v > 0);
  const pbrValues = rows.map((r) => r.pbr).filter((v): v is number => isNum(v) && v > 0);
  const roeValues = rows.map((r) => r.roe).filter(isNum);
  const debtValues = rows.map((r) => r.debt_ratio).filter(isNum);

  const perUnder = rows.filter((r) => isNum(r.per) && r.per > 0 && r.per < MARKET_THRESHOLDS.perUnder).length;
  const pbrUnder = rows.filter((r) => isNum(r.pbr) && r.pbr > 0 && r.pbr < MARKET_THRESHOLDS.pbrUnder).length;
  const roeOver = rows.filter((r) => isNum(r.roe) && r.roe >= MARKET_THRESHOLDS.roeOver).length;
  const loss = rows.filter((r) => !isNum(r.per) || r.per <= 0 || (isNum(r.roe) && r.roe < 0)).length;
  const highYield = rows.filter((r) => {
    const y = yieldByCode.get(r.code) ?? r.dividend_yield;
    return isNum(y) && y >= MARKET_THRESHOLDS.yieldOver;
  }).length;

  const wPer = capWeighted(rows, (r) => r.per);
  const wPbr = capWeighted(rows, (r) => r.pbr);

  return {
    key,
    count,
    medianPer: median(perValues),
    medianPbr: median(pbrValues),
    medianRoe: median(roeValues),
    medianDebtRatio: median(debtValues),
    sharePerUnder10: share(perUnder, count),
    sharePbrUnder1: share(pbrUnder, count),
    shareRoeOver10: share(roeOver, count),
    shareLoss: share(loss, count),
    shareYieldOver3: share(highYield, count),
    capWeightedPer: wPer.value,
    capWeightedPbr: wPbr.value,
    capWeightedPerCount: wPer.used,
    capWeightedPbrCount: wPbr.used,
    perValues,
    pbrValues,
    sectors: buildSectors(rows),
  };
}

/** 전 종목 스냅샷 → 시장별 분포 통계. rows 가 비어도 안전하게 0/null 을 돌려준다. */
export function buildMarketStats(rows: ScreenRow[], divRows: DividendRow[]): MarketStats {
  const yieldByCode = new Map<string, number>();
  for (const d of divRows) {
    if (isNum(d.dividend_yield)) yieldByCode.set(d.code, d.dividend_yield);
  }
  const kospi = rows.filter((r) => r.market === "KOSPI");
  const kosdaq = rows.filter((r) => r.market === "KOSDAQ");
  const asOf = rows.reduce<string | null>((acc, r) => (r.as_of && (acc === null || r.as_of > acc) ? r.as_of : acc), null);

  return {
    asOf,
    markets: {
      ALL: buildSnapshot("ALL", rows, yieldByCode),
      KOSPI: buildSnapshot("KOSPI", kospi, yieldByCode),
      KOSDAQ: buildSnapshot("KOSDAQ", kosdaq, yieldByCode),
    },
  };
}
