/**
 * 포트폴리오 X-ray — 순수 계산 모듈 (DOM·네트워크 의존 없음).
 *
 * 입력은 "종목코드 + 평가금액(원)" 목록이며, 여기서 나오는 값은 모두
 * 사용자가 입력한 보유 금액을 그대로 집계·기술(descriptive)한 숫자입니다.
 * 특정 종목의 매매를 권유하거나 판단을 대신하지 않으며, 어떤 항목도 조언이 아닙니다.
 */

import type { DividendRow, Market, ScreenRow } from "@/lib/types";

/* ───────────────── 입력 ───────────────── */

export interface PortfolioItem {
  /** 6자리 종목코드 */
  code: string;
  /** 평가금액(원) */
  amount: number;
}

export interface HoldingSource extends PortfolioItem {
  row: ScreenRow | null;
  dividend?: DividendRow | null;
}

export const MAX_ITEMS = 30;
export const MAX_AMOUNT = 1e13;
export const CODE_RE = /^\d{6}$/;

/* ───────────────── ETF 판별 ───────────────── */

/**
 * 종목명 기반 ETF 판별. 국내 ETF 브랜드 접두어 + "ETF" 표기.
 * P2 에서 KRX ETF 구성종목(PDF) 을 적재하면 look-through 로 대체됩니다.
 */
const ETF_TOKENS = ["ETF", "TIGER", "KODEX", "ACE", "SOL", "RISE", "PLUS", "KOSEF", "ARIRANG"] as const;

export function isEtfName(name: string | null | undefined): boolean {
  if (!name) return false;
  const upper = name.toUpperCase();
  return ETF_TOKENS.some((t) => upper.includes(t));
}

/* ───────────────── 결과 타입 ───────────────── */

export interface Holding {
  code: string;
  name: string;
  market: Market | null;
  sector: string;
  amount: number;
  /** 0~1 */
  weight: number;
  isEtf: boolean;
  price: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  debtRatio: number | null;
  dividendYield: number | null;
  /** 데이터 조회 실패(코드 미존재 등) */
  missing: boolean;
}

export interface Slice {
  key: string;
  amount: number;
  /** 0~1 */
  weight: number;
  codes: string[];
}

export type ConcentrationLevel = "spread" | "middle" | "concentrated";

export interface HhiBand {
  level: ConcentrationLevel;
  /** 구간 이름 (중립·서술적 표현) */
  label: string;
  /** 구간 설명 — 판단이 아닌 정의 */
  desc: string;
}

export interface WeightedMetrics {
  /** 이익수익률(1/PER) 가중 조화평균. 산출 가능한 종목이 없으면 null */
  per: number | null;
  /** 순자산수익률(1/PBR) 가중 조화평균 */
  pbr: number | null;
  roe: number | null;
  debtRatio: number | null;
  dividendYield: number | null;
  /** 각 지표가 커버한 금액 비중(0~1) — 분모는 ETF 제외 금액 */
  coverage: { per: number; pbr: number; roe: number; debtRatio: number; dividendYield: number };
}

export interface CheckItem {
  id: string;
  /** 확인 항목 제목 */
  title: string;
  /** 해당하는 금액 비중(0~1) */
  weight: number;
  /** 관련 종목명 */
  names: string[];
  /** 사실 서술 문장 */
  detail: string;
}

export interface XrayResult {
  total: number;
  holdings: Holding[];
  sectors: Slice[];
  markets: Slice[];
  /** 종목 기준 HHI (0~10000) */
  hhi: number;
  /** 섹터 기준 HHI (0~10000) */
  sectorHhi: number;
  hhiBand: HhiBand;
  /** 동일 비중이라면 몇 종목을 가진 것과 같은지 (10000 / HHI) */
  effectiveCount: number;
  topWeight: number;
  topName: string;
  weighted: WeightedMetrics;
  etf: { count: number; amount: number; weight: number; names: string[] };
  missingCount: number;
  checks: CheckItem[];
}

/* ───────────────── 유틸 ───────────────── */

function round(n: number, digits: number): number {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

/** 입력 정규화: 코드 형식·금액 검증, 중복 코드 합산, 상한 적용 */
export function normalizeItems(raw: readonly PortfolioItem[]): PortfolioItem[] {
  const merged = new Map<string, number>();
  for (const it of raw) {
    const code = String(it.code ?? "").trim();
    if (!CODE_RE.test(code)) continue;
    const amount = Number(it.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (merged.size >= MAX_ITEMS && !merged.has(code)) continue;
    merged.set(code, Math.min(MAX_AMOUNT, (merged.get(code) ?? 0) + amount));
  }
  return [...merged.entries()].map(([code, amount]) => ({ code, amount }));
}

export function hhiBandOf(hhi: number): HhiBand {
  if (hhi < 1500) {
    return { level: "spread", label: "분산", desc: "HHI 1,500 미만 구간입니다. 개별 종목 비중이 비교적 고르게 나뉘어 있습니다." };
  }
  if (hhi <= 2500) {
    return { level: "middle", label: "중간", desc: "HHI 1,500~2,500 구간입니다. 일부 종목에 비중이 모여 있습니다." };
  }
  return { level: "concentrated", label: "집중", desc: "HHI 2,500 초과 구간입니다. 소수 종목이 전체 금액의 큰 부분을 차지합니다." };
}

/** 가중 조화평균 — 배수형 지표(PER·PBR)를 역수(수익률)로 바꿔 평균한 뒤 되돌린다 */
function weightedHarmonic(entries: readonly { weight: number; value: number | null }[]): { value: number | null; coverage: number } {
  let wSum = 0;
  let inv = 0;
  for (const e of entries) {
    if (e.value === null || !Number.isFinite(e.value) || e.value <= 0) continue;
    wSum += e.weight;
    inv += e.weight / e.value;
  }
  if (wSum <= 0 || inv <= 0) return { value: null, coverage: 0 };
  return { value: round(wSum / inv, 2), coverage: wSum };
}

function weightedMean(entries: readonly { weight: number; value: number | null }[]): { value: number | null; coverage: number } {
  let wSum = 0;
  let acc = 0;
  for (const e of entries) {
    if (e.value === null || !Number.isFinite(e.value)) continue;
    wSum += e.weight;
    acc += e.weight * e.value;
  }
  if (wSum <= 0) return { value: null, coverage: 0 };
  return { value: round(acc / wSum, 2), coverage: wSum };
}

function groupBy(holdings: readonly Holding[], total: number, pick: (h: Holding) => string): Slice[] {
  const map = new Map<string, { amount: number; codes: string[] }>();
  for (const h of holdings) {
    const key = pick(h);
    const cur = map.get(key) ?? { amount: 0, codes: [] };
    cur.amount += h.amount;
    cur.codes.push(h.code);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, amount: v.amount, weight: total > 0 ? v.amount / total : 0, codes: v.codes }))
    .sort((a, b) => b.amount - a.amount);
}

/* ───────────────── 메인 ───────────────── */

export const CHECK_THRESHOLDS = {
  topStockWeight: 0.2,
  sectorWeight: 0.4,
  debtRatio: 200,
} as const;

export function xray(sources: readonly HoldingSource[]): XrayResult {
  const holdings: Holding[] = [];
  let total = 0;
  for (const s of sources) {
    if (!CODE_RE.test(s.code) || !Number.isFinite(s.amount) || s.amount <= 0) continue;
    total += s.amount;
  }

  for (const s of sources) {
    if (!CODE_RE.test(s.code) || !Number.isFinite(s.amount) || s.amount <= 0) continue;
    const row = s.row;
    const name = row?.name ?? s.code;
    holdings.push({
      code: s.code,
      name,
      market: row?.market ?? null,
      sector: row?.sector ?? "미분류",
      amount: s.amount,
      weight: total > 0 ? s.amount / total : 0,
      isEtf: isEtfName(name),
      price: row?.price ?? null,
      per: row?.per ?? null,
      pbr: row?.pbr ?? null,
      roe: row?.roe ?? null,
      debtRatio: row?.debt_ratio ?? null,
      dividendYield: row?.dividend_yield ?? s.dividend?.dividend_yield ?? null,
      missing: !row,
    });
  }
  holdings.sort((a, b) => b.amount - a.amount);

  const sectors = groupBy(holdings, total, (h) => (h.isEtf ? "ETF" : h.sector));
  const markets = groupBy(holdings, total, (h) => (h.isEtf ? "ETF" : h.market ?? "미확인"));

  const hhi = round(holdings.reduce((acc, h) => acc + Math.pow(h.weight * 100, 2), 0), 0);
  const sectorHhi = round(sectors.reduce((acc, s) => acc + Math.pow(s.weight * 100, 2), 0), 0);
  const top = holdings[0];

  // 밸류에이션 집계에서 ETF 는 제외 (구성종목 look-through 는 P2)
  const core = holdings.filter((h) => !h.isEtf);
  const coreTotal = core.reduce((acc, h) => acc + h.amount, 0);
  const w = (h: Holding) => (coreTotal > 0 ? h.amount / coreTotal : 0);
  const per = weightedHarmonic(core.map((h) => ({ weight: w(h), value: h.per })));
  const pbr = weightedHarmonic(core.map((h) => ({ weight: w(h), value: h.pbr })));
  const roe = weightedMean(core.map((h) => ({ weight: w(h), value: h.roe })));
  const debtRatio = weightedMean(core.map((h) => ({ weight: w(h), value: h.debtRatio })));
  const dividendYield = weightedMean(core.map((h) => ({ weight: w(h), value: h.dividendYield })));

  const etfList = holdings.filter((h) => h.isEtf);
  const etfAmount = etfList.reduce((acc, h) => acc + h.amount, 0);

  /* 확인 항목 — 기준을 넘은 사실만 서술한다 (조언·권유 아님) */
  const checks: CheckItem[] = [];
  const overTop = holdings.filter((h) => h.weight > CHECK_THRESHOLDS.topStockWeight);
  if (overTop.length > 0) {
    const wSum = overTop.reduce((a, h) => a + h.weight, 0);
    checks.push({
      id: "single-stock",
      title: `단일 종목 비중 ${CHECK_THRESHOLDS.topStockWeight * 100}% 초과`,
      weight: wSum,
      names: overTop.map((h) => h.name),
      detail: `${overTop.map((h) => `${h.name} ${(h.weight * 100).toFixed(1)}%`).join(", ")} — 해당 종목의 가격 변동이 전체 평가금액에 그대로 반영되는 비중입니다.`,
    });
  }
  const overSector = sectors.filter((s) => s.weight > CHECK_THRESHOLDS.sectorWeight);
  if (overSector.length > 0) {
    checks.push({
      id: "single-sector",
      title: `단일 섹터 비중 ${CHECK_THRESHOLDS.sectorWeight * 100}% 초과`,
      weight: overSector.reduce((a, s) => a + s.weight, 0),
      names: overSector.map((s) => s.key),
      detail: `${overSector.map((s) => `${s.key} ${(s.weight * 100).toFixed(1)}%`).join(", ")} — 같은 업황에 함께 움직일 가능성이 있는 금액 비중입니다.`,
    });
  }
  const lossMakers = core.filter((h) => h.roe !== null && h.roe < 0);
  if (lossMakers.length > 0) {
    checks.push({
      id: "loss",
      title: "ROE 가 음수인 종목(최근 결산 적자) 비중",
      weight: lossMakers.reduce((a, h) => a + h.weight, 0),
      names: lossMakers.map((h) => h.name),
      detail: `${lossMakers.map((h) => `${h.name} ROE ${h.roe?.toFixed(1)}%`).join(", ")} — 적자 종목은 PER 가 산출되지 않아 가중 PER 집계에서 빠집니다.`,
    });
  }
  const highDebt = core.filter((h) => h.debtRatio !== null && h.debtRatio > CHECK_THRESHOLDS.debtRatio);
  if (highDebt.length > 0) {
    checks.push({
      id: "debt",
      title: `부채비율 ${CHECK_THRESHOLDS.debtRatio}% 초과 종목 비중`,
      weight: highDebt.reduce((a, h) => a + h.weight, 0),
      names: highDebt.map((h) => h.name),
      detail: `${highDebt.map((h) => `${h.name} ${h.debtRatio?.toFixed(0)}%`).join(", ")} — 업종에 따라 통상 수준이 다르므로 동일 업종끼리 비교해 확인해 보세요.`,
    });
  }
  const noData = holdings.filter((h) => h.missing);
  if (noData.length > 0) {
    checks.push({
      id: "no-data",
      title: "재무 데이터가 없는 종목",
      weight: noData.reduce((a, h) => a + h.weight, 0),
      names: noData.map((h) => h.code),
      detail: `${noData.map((h) => h.code).join(", ")} — 데이터베이스에 재무 스냅샷이 없어 밸류에이션 집계에서 제외됩니다.`,
    });
  }

  return {
    total,
    holdings,
    sectors,
    markets,
    hhi,
    sectorHhi,
    hhiBand: hhiBandOf(hhi),
    effectiveCount: hhi > 0 ? round(10000 / hhi, 1) : 0,
    topWeight: top?.weight ?? 0,
    topName: top?.name ?? "",
    weighted: {
      per: per.value,
      pbr: pbr.value,
      roe: roe.value,
      debtRatio: debtRatio.value,
      dividendYield: dividendYield.value,
      coverage: {
        per: per.coverage,
        pbr: pbr.coverage,
        roe: roe.coverage,
        debtRatio: debtRatio.coverage,
        dividendYield: dividendYield.coverage,
      },
    },
    etf: { count: etfList.length, amount: etfAmount, weight: total > 0 ? etfAmount / total : 0, names: etfList.map((h) => h.name) },
    missingCount: noData.length,
    checks,
  };
}

/* ───────────────── 목표 비중과의 차이 ───────────────── */

export interface DiffRow {
  code: string;
  name: string;
  amount: number;
  /** 현재 비중 0~1 */
  currentWeight: number;
  /** 목표 비중 0~1 */
  targetWeight: number;
  /** 목표 비중을 적용했을 때의 금액 */
  targetAmount: number;
  /** 목표 금액 − 현재 금액 (양수 = 목표보다 적음, 음수 = 목표보다 많음) */
  diff: number;
}

export interface DiffResult {
  rows: DiffRow[];
  total: number;
  /** 목표 비중 합계(%) — 100 이 아니면 정규화해 계산한다 */
  targetSumPct: number;
  /** 차이 절대값 합계의 절반 = 목표 배분에 맞추기 위해 움직여야 하는 금액 */
  turnover: number;
}

/**
 * 목표 비중과의 차이(금액). 매매 수량이나 주문을 산출하지 않으며,
 * 입력한 목표 비중과 현재 금액의 산술적 차이만 계산합니다.
 * @param targetPct 종목코드 → 목표 비중(%). 합이 100 이 아니면 비율대로 정규화한다.
 */
export function rebalanceDiff(items: readonly { code: string; name?: string; amount: number }[], targetPct: Readonly<Record<string, number>>): DiffResult {
  const valid = items.filter((i) => Number.isFinite(i.amount) && i.amount > 0);
  const total = valid.reduce((a, i) => a + i.amount, 0);
  let sum = 0;
  for (const i of valid) {
    const t = targetPct[i.code];
    sum += Number.isFinite(t) && (t ?? 0) > 0 ? (t as number) : 0;
  }
  const rows: DiffRow[] = valid.map((i) => {
    const raw = targetPct[i.code];
    const t = Number.isFinite(raw) && (raw ?? 0) > 0 ? (raw as number) : 0;
    const targetWeight = sum > 0 ? t / sum : valid.length > 0 ? 1 / valid.length : 0;
    const targetAmount = total * targetWeight;
    return {
      code: i.code,
      name: i.name ?? i.code,
      amount: i.amount,
      currentWeight: total > 0 ? i.amount / total : 0,
      targetWeight,
      targetAmount: Math.round(targetAmount),
      diff: Math.round(targetAmount - i.amount),
    };
  });
  const turnover = Math.round(rows.reduce((a, r) => a + Math.abs(r.diff), 0) / 2);
  return { rows, total, targetSumPct: round(sum, 2), turnover };
}

/* ───────────────── 상관계수 ───────────────── */

/** 일간 로그수익률 배열 */
export function logReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a === undefined || b === undefined || a <= 0 || b <= 0) continue;
    out.push(Math.log(b / a));
  }
  return out;
}

/** 피어슨 상관계수. 표본 표준편차가 0 이면 0 */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i] ?? 0;
    mb += b[i] ?? 0;
  }
  ma /= n;
  mb /= n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma;
    const db = (b[i] ?? 0) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va <= 0 || vb <= 0) return 0;
  const r = cov / Math.sqrt(va * vb);
  return round(Math.max(-1, Math.min(1, r)), 4);
}

/** 여러 종목의 로그수익률 시계열 → 상관계수 행렬 */
export function correlationMatrix(series: readonly (readonly number[])[]): number[][] {
  return series.map((a, i) => series.map((b, j) => (i === j ? 1 : pearson(a, b))));
}

/* ───────────────── URL 상태 (?p=005930:5000000,000660:3000000) ───────────────── */

export function encodePortfolioParam(items: readonly PortfolioItem[]): string {
  return items.map((i) => `${i.code}:${Math.round(i.amount)}`).join(",");
}

export function decodePortfolioParam(raw: string | string[] | undefined): PortfolioItem[] {
  const text = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  if (!text) return [];
  const items: PortfolioItem[] = [];
  for (const chunk of text.split(",").slice(0, MAX_ITEMS * 2)) {
    const [code, amountText] = chunk.split(":");
    const amount = Number((amountText ?? "").replace(/[^\d.]/g, ""));
    if (!code || !CODE_RE.test(code.trim()) || !Number.isFinite(amount) || amount <= 0) continue;
    items.push({ code: code.trim(), amount: Math.round(amount) });
  }
  return normalizeItems(items);
}
