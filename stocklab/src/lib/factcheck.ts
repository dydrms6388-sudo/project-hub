import type { DividendRow, PricePoint, ScreenRow } from "@/lib/types";

/**
 * 종목 팩트체크 — 한 종목의 밸류에이션·재무·변동성·배당을 숫자와 "확인 항목"으로 정리한다.
 * 종합 점수·등급·판단 문장은 만들지 않는다 (docs/00-legal-expression-guide.md, A안).
 * 확인 항목은 모두 "조건 충족 여부"이며, 조건과 임계값은 FLAG_RULES 로 공개한다.
 */

export type FlagLevel = "info" | "check";

export interface Flag {
  key: string;
  /** 조건문 형태의 라벨 (예: "부채비율 200% 초과"). 판단·권유 표현 금지 */
  label: string;
  level: FlagLevel;
}

export interface FactCheck {
  valuation: {
    per: number | null;
    /** 전체 유니버스(PER>0) 중 백분위. 낮을수록 PER 이 낮은 쪽 */
    perPercentile: number | null;
    pbr: number | null;
    pbrPercentile: number | null;
    sectorMedianPer: number | null;
    sectorMedianPbr: number | null;
    /** 업종 통계에 사용된 종목 수(자기 자신 포함). 3개 미만이면 업종 통계는 null */
    sectorPeerCount: number;
  };
  quality: {
    roe: number | null;
    debt_ratio: number | null;
    /** 높을수록 ROE 가 높은 쪽 */
    roePercentile: number | null;
    /** 높을수록 부채비율이 높은 쪽 */
    debtPercentile: number | null;
  };
  dividend: {
    yield: number | null;
    years: number | null;
    payout: number | null;
    dps: number | null;
    exDividendDate: string | null;
  };
  momentum: {
    ret20d: number | null;
    ret60d: number | null;
    ret250d: number | null;
    high52w: number | null;
    low52w: number | null;
    /** 마지막 종가가 52주 최고가 대비 몇 % 위치인지 (0 이하) */
    high52wDistancePct: number | null;
    /** 마지막 종가가 52주 최저가 대비 몇 % 위치인지 (0 이상) */
    low52wDistancePct: number | null;
    /** 최근 60거래일 일간 로그수익률 표준편차 × √252 (%) */
    vol60dAnnualizedPct: number | null;
    /** 사용된 시계열 점 개수 */
    points: number;
    lastDate: string | null;
  };
  size: {
    marketCap: number | null;
    /** 높을수록 시총이 큰 쪽 */
    marketCapPercentile: number | null;
  };
  flags: Flag[];
  universeSize: number;
}

/* ───────────────────────── 임계값 (공개) ───────────────────────── */

export const THRESHOLDS = {
  debtRatioOver: 200,
  ret20dAbs: 30,
  vol60dOver: 60,
  topPercentile: 90,
  bottomPercentile: 10,
  sectorMultiple: 2,
  near52wPct: 3,
  payoutOver: 100,
  minSectorPeers: 3,
} as const;

/** 화면 하단 "확인 항목 기준" 설명용 — 코드의 조건과 1:1 */
export const FLAG_RULES: { key: string; text: string }[] = [
  { key: "loss", text: `PER 이 0 이하 → "적자(EPS 음수) — PER 산출 불가"` },
  { key: "per-missing", text: `PER 데이터 없음 (재무 미제공 또는 산출 불가)` },
  { key: "debt", text: `부채비율 ${THRESHOLDS.debtRatioOver}% 초과` },
  { key: "roe-neg", text: `ROE 음수` },
  { key: "per-top", text: `PER 전체 상위 ${100 - THRESHOLDS.topPercentile}% (백분위 ${THRESHOLDS.topPercentile} 이상)` },
  { key: "pbr-top", text: `PBR 전체 상위 ${100 - THRESHOLDS.topPercentile}%` },
  { key: "per-sector", text: `PER 이 업종 중앙값의 ${THRESHOLDS.sectorMultiple}배 초과 (업종 종목 ${THRESHOLDS.minSectorPeers}개 이상일 때만)` },
  { key: "ret20-up", text: `최근 20거래일 상승폭 ${THRESHOLDS.ret20dAbs}% 이상` },
  { key: "ret20-down", text: `최근 20거래일 하락폭 ${THRESHOLDS.ret20dAbs}% 이상` },
  { key: "vol60", text: `60일 변동성(연율) ${THRESHOLDS.vol60dOver}% 이상` },
  { key: "cap-bottom", text: `시가총액 전체 하위 ${THRESHOLDS.bottomPercentile}%` },
  { key: "near-high", text: `52주 최고가 대비 ${THRESHOLDS.near52wPct}% 이내 (참고)` },
  { key: "near-low", text: `52주 최저가 대비 ${THRESHOLDS.near52wPct}% 이내 (참고)` },
  { key: "no-div", text: `최근 회계연도 배당 없음 (참고)` },
  { key: "payout", text: `배당성향 ${THRESHOLDS.payoutOver}% 초과` },
];

/* ───────────────────────── 통계 헬퍼 ───────────────────────── */

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function median(values: number[]): number | null {
  const v = values.filter(isNum).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  const a = v[mid];
  const b = v[mid - 1];
  if (a === undefined) return null;
  if (n % 2 === 1 || b === undefined) return a;
  return (a + b) / 2;
}

/** 값 v 의 백분위(0~100) — v 보다 작은 값의 비율 + 같은 값의 절반. 표본이 없으면 null */
export function percentileRank(values: number[], v: number): number | null {
  const pool = values.filter(isNum);
  if (pool.length === 0 || !isNum(v)) return null;
  let below = 0;
  let equal = 0;
  for (const x of pool) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return Math.round(((below + equal / 2) / pool.length) * 100);
}

function pctReturn(hist: PricePoint[], lookback: number): number | null {
  const last = hist[hist.length - 1];
  const base = hist[hist.length - 1 - lookback];
  if (!last || !base || base.close <= 0) return null;
  return (last.close / base.close - 1) * 100;
}

function annualizedVol(hist: PricePoint[], window: number): number | null {
  if (hist.length < window + 1) return null;
  const slice = hist.slice(-(window + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    const cur = slice[i];
    if (!prev || !cur || prev.close <= 0 || cur.close <= 0) continue;
    rets.push(Math.log(cur.close / prev.close));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/* ───────────────────────── 본체 ───────────────────────── */

export function buildFactCheck(row: ScreenRow, div: DividendRow | null, universe: ScreenRow[], hist: PricePoint[]): FactCheck {
  const positivePer = universe.map((r) => r.per).filter((v): v is number => isNum(v) && v > 0);
  const positivePbr = universe.map((r) => r.pbr).filter((v): v is number => isNum(v) && v > 0);
  const roes = universe.map((r) => r.roe).filter(isNum);
  const debts = universe.map((r) => r.debt_ratio).filter(isNum);
  const caps = universe.map((r) => r.market_cap).filter(isNum);

  const peers = row.sector ? universe.filter((r) => r.sector === row.sector) : [];
  const hasSector = peers.length >= THRESHOLDS.minSectorPeers;
  const sectorMedianPer = hasSector ? median(peers.map((r) => r.per).filter((v): v is number => isNum(v) && v > 0)) : null;
  const sectorMedianPbr = hasSector ? median(peers.map((r) => r.pbr).filter((v): v is number => isNum(v) && v > 0)) : null;

  const perPercentile = isNum(row.per) && row.per > 0 ? percentileRank(positivePer, row.per) : null;
  const pbrPercentile = isNum(row.pbr) && row.pbr > 0 ? percentileRank(positivePbr, row.pbr) : null;
  const roePercentile = isNum(row.roe) ? percentileRank(roes, row.roe) : null;
  const debtPercentile = isNum(row.debt_ratio) ? percentileRank(debts, row.debt_ratio) : null;
  const marketCapPercentile = isNum(row.market_cap) ? percentileRank(caps, row.market_cap) : null;

  // ── 모멘텀/변동성 (hist 비어 있으면 전부 null)
  const sorted = [...hist].filter((p) => isNum(p.close) && p.close > 0).sort((a, b) => (a.trade_date < b.trade_date ? -1 : 1));
  const last = sorted[sorted.length - 1] ?? null;
  const window52 = sorted.slice(-250);
  const high52w = window52.length >= 20 ? Math.max(...window52.map((p) => p.close)) : null;
  const low52w = window52.length >= 20 ? Math.min(...window52.map((p) => p.close)) : null;
  const momentum: FactCheck["momentum"] = {
    ret20d: pctReturn(sorted, 20),
    ret60d: pctReturn(sorted, 60),
    ret250d: pctReturn(sorted, 250),
    high52w,
    low52w,
    high52wDistancePct: last && high52w ? (last.close / high52w - 1) * 100 : null,
    low52wDistancePct: last && low52w ? (last.close / low52w - 1) * 100 : null,
    vol60dAnnualizedPct: annualizedVol(sorted, 60),
    points: sorted.length,
    lastDate: last?.trade_date ?? null,
  };

  const dividend: FactCheck["dividend"] = {
    yield: div?.dividend_yield ?? row.dividend_yield ?? null,
    years: div ? div.consecutive_years : null,
    payout: div?.payout_ratio ?? null,
    dps: div?.dps ?? null,
    exDividendDate: div?.ex_dividend_date ?? null,
  };

  // ── 확인 항목 (조건 충족 여부만)
  const flags: Flag[] = [];
  const add = (key: string, label: string, level: FlagLevel) => flags.push({ key, label, level });

  if (isNum(row.per) && row.per <= 0) add("loss", "적자(EPS 음수) — PER 산출 불가", "check");
  else if (!isNum(row.per)) add("per-missing", "PER 데이터 없음", "info");
  if (isNum(row.debt_ratio) && row.debt_ratio > THRESHOLDS.debtRatioOver) add("debt", `부채비율 ${THRESHOLDS.debtRatioOver}% 초과 (${Math.round(row.debt_ratio)}%)`, "check");
  if (isNum(row.roe) && row.roe < 0) add("roe-neg", `ROE 음수 (${row.roe.toFixed(1)}%)`, "check");
  if (perPercentile !== null && perPercentile >= THRESHOLDS.topPercentile) add("per-top", `PER 전체 상위 ${100 - THRESHOLDS.topPercentile}% (백분위 ${perPercentile})`, "check");
  if (pbrPercentile !== null && pbrPercentile >= THRESHOLDS.topPercentile) add("pbr-top", `PBR 전체 상위 ${100 - THRESHOLDS.topPercentile}% (백분위 ${pbrPercentile})`, "check");
  if (isNum(row.per) && row.per > 0 && sectorMedianPer !== null && row.per > sectorMedianPer * THRESHOLDS.sectorMultiple)
    add("per-sector", `PER 이 업종 중앙값(${sectorMedianPer.toFixed(1)}배)의 ${THRESHOLDS.sectorMultiple}배 초과`, "check");
  if (momentum.ret20d !== null && momentum.ret20d >= THRESHOLDS.ret20dAbs) add("ret20-up", `최근 20거래일 상승폭 ${THRESHOLDS.ret20dAbs}% 이상 (변동성 확인 항목)`, "check");
  if (momentum.ret20d !== null && momentum.ret20d <= -THRESHOLDS.ret20dAbs) add("ret20-down", `최근 20거래일 하락폭 ${THRESHOLDS.ret20dAbs}% 이상 (변동성 확인 항목)`, "check");
  if (momentum.vol60dAnnualizedPct !== null && momentum.vol60dAnnualizedPct >= THRESHOLDS.vol60dOver)
    add("vol60", `60일 변동성(연율) ${THRESHOLDS.vol60dOver}% 이상 (${Math.round(momentum.vol60dAnnualizedPct)}%)`, "check");
  if (marketCapPercentile !== null && marketCapPercentile <= THRESHOLDS.bottomPercentile) add("cap-bottom", `시가총액 전체 하위 ${THRESHOLDS.bottomPercentile}% (백분위 ${marketCapPercentile})`, "check");
  if (momentum.high52wDistancePct !== null && momentum.high52wDistancePct >= -THRESHOLDS.near52wPct) add("near-high", `52주 최고가 대비 ${THRESHOLDS.near52wPct}% 이내`, "info");
  if (momentum.low52wDistancePct !== null && momentum.low52wDistancePct <= THRESHOLDS.near52wPct) add("near-low", `52주 최저가 대비 ${THRESHOLDS.near52wPct}% 이내`, "info");
  if (!isNum(dividend.yield) || dividend.yield <= 0) add("no-div", "최근 회계연도 배당 없음", "info");
  if (isNum(dividend.payout) && dividend.payout > THRESHOLDS.payoutOver) add("payout", `배당성향 ${THRESHOLDS.payoutOver}% 초과 (${Math.round(dividend.payout)}%)`, "check");

  return {
    valuation: { per: row.per, perPercentile, pbr: row.pbr, pbrPercentile, sectorMedianPer, sectorMedianPbr, sectorPeerCount: peers.length },
    quality: { roe: row.roe, debt_ratio: row.debt_ratio, roePercentile, debtPercentile },
    dividend,
    momentum,
    size: { marketCap: row.market_cap, marketCapPercentile },
    flags,
    universeSize: universe.length,
  };
}

/** as_of(YYYY-MM-DD) 에서 days 일 전 날짜 문자열 */
export function daysBefore(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
