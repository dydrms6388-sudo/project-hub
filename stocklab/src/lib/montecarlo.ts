/**
 * 몬테카를로 목표 달성 시뮬레이션 — 순수 함수 모듈 (DOM 의존 없음).
 *
 * - PRNG: mulberry32(시드 고정) → 같은 입력이면 항상 같은 결과 (URL 재현 보장)
 * - 정규분포: Box-Muller
 * - 자산 경로: 월 단위 기하 브라운 운동(GBM). 월 로그수익률 ~ N((μ − σ²/2)/12, σ/√12)
 *   매월 말 적립(기말 적립) 후 다음 달로 이동.
 *
 * 주의: 확률은 사용자가 입력한 기대수익률·변동성 가정의 시뮬레이션 결과이며 예측이 아닙니다.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 32bit 시드 (FNV-1a) */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Box-Muller — 표준정규 난수 생성기(두 값 중 하나를 캐시) */
export function makeGaussian(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    do u = rand(); while (u <= 1e-12);
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * v;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

export interface GoalSimInput {
  /** 초기 자금(원) */
  initial: number;
  /** 월 적립액(원, 기말) */
  monthly: number;
  /** 기간(년) */
  years: number;
  /** 연 기대수익률(%) — 산술 기대치. 로그 드리프트는 μ − σ²/2 로 보정 */
  expReturnPct: number;
  /** 연 변동성(%) */
  volPct: number;
  /** 목표 금액(원) */
  target: number;
  /** 경로 수 (기본 2000) */
  paths?: number;
  /** 시드. 미지정 시 입력값 해시 */
  seed?: number;
}

export interface FanRow {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface GoalSimResult {
  /** 만기 시점 자산 ≥ 목표 인 경로 비율(0~1) */
  probability: number;
  /** 목표 이상 경로 수 */
  hitCount: number;
  paths: number;
  seed: number;
  /** 연차별 백분위(0년차 = 초기 자금) */
  fan: FanRow[];
  medianFinal: number;
  meanFinal: number;
  p10Final: number;
  p90Final: number;
  /** 총 납입 원금 = 초기 자금 + 월 적립 × 개월 */
  invested: number;
  /** 무변동(입력 기대수익률 고정) 복리 결과 */
  deterministicFinal: number;
  /** 목표 도달에 필요한 연수익률(%, 무변동 가정). 상한(200%) 초과면 null */
  requiredReturnPct: number | null;
  /** 달성 확률 50% / 75% 를 위한 월 적립액(원). 상한 초과면 null */
  requiredMonthly50: number | null;
  requiredMonthly75: number | null;
}

export const MAX_MONTHLY_SOLVE = 1e9;

/** 무변동 월복리(기말 적립) 미래가치 */
export function futureValueFixed(initial: number, monthly: number, years: number, ratePct: number): number {
  const n = Math.round(years * 12);
  const i = ratePct / 100 / 12;
  if (Math.abs(i) < 1e-12) return initial + monthly * n;
  const gN = Math.pow(1 + i, n);
  return initial * gN + (monthly * (gN - 1)) / i;
}

/** 목표 도달에 필요한 연수익률(%) — 무변동 가정, 이분 탐색(단조 증가). 도달 불가면 null */
export function requiredReturnPct(initial: number, monthly: number, years: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0) return 0;
  let lo = -99;
  let hi = 200;
  if (futureValueFixed(initial, monthly, years, hi) < target) return null;
  if (futureValueFixed(initial, monthly, years, lo) >= target) return lo;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (futureValueFixed(initial, monthly, years, mid) >= target) hi = mid;
    else lo = mid;
  }
  return Math.round(hi * 100) / 100;
}

/** 정렬된 배열의 q(0~1) 분위수 — 선형 보간 */
function quantileSorted(sorted: Float64Array, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(n - 1, lo + 1);
  const frac = pos - lo;
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * frac;
}

export function simulateGoal(input: GoalSimInput): GoalSimResult {
  const initial = Math.max(0, input.initial);
  const monthly = Math.max(0, input.monthly);
  const years = Math.max(1, Math.min(60, Math.round(input.years)));
  const paths = Math.max(100, Math.min(5000, Math.round(input.paths ?? 2000)));
  const target = Math.max(0, input.target);
  const mu = input.expReturnPct / 100;
  const sigma = Math.max(0, input.volPct) / 100;
  const seed = input.seed ?? hashSeed(`${initial}|${monthly}|${years}|${input.expReturnPct}|${input.volPct}|${target}|${paths}`);

  const rand = mulberry32(seed);
  const gauss = makeGaussian(rand);
  const months = years * 12;
  const dt = 1 / 12;
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const sd = sigma * Math.sqrt(dt);

  // yearly[y][p] = y년차 말 자산
  const yearly: Float64Array[] = [];
  for (let y = 0; y <= years; y++) yearly.push(new Float64Array(paths));
  const y0 = yearly[0];
  if (y0) y0.fill(initial);

  // 경로별 선형 분해: final = initial·A + monthly·B  (A = 누적 성장, B = 적립분 누적 성장)
  const aArr = new Float64Array(paths);
  const bArr = new Float64Array(paths);

  for (let p = 0; p < paths; p++) {
    let a = 1;
    let b = 0;
    let bal = initial;
    for (let m = 1; m <= months; m++) {
      const g = sd > 0 ? Math.exp(drift + sd * gauss()) : Math.exp(drift);
      a *= g;
      b = b * g + 1;
      bal = bal * g + monthly;
      if (m % 12 === 0) {
        const row = yearly[m / 12];
        if (row) row[p] = bal;
      }
    }
    aArr[p] = a;
    bArr[p] = b;
  }

  const fan: FanRow[] = [];
  for (let y = 0; y <= years; y++) {
    const col = yearly[y];
    if (!col) continue;
    const sorted = Float64Array.from(col).sort();
    fan.push({
      year: y,
      p10: quantileSorted(sorted, 0.1),
      p25: quantileSorted(sorted, 0.25),
      p50: quantileSorted(sorted, 0.5),
      p75: quantileSorted(sorted, 0.75),
      p90: quantileSorted(sorted, 0.9),
    });
  }

  const finals = yearly[years] ?? new Float64Array(0);
  let hit = 0;
  let sum = 0;
  for (let p = 0; p < finals.length; p++) {
    const v = finals[p] ?? 0;
    sum += v;
    if (v >= target) hit++;
  }
  const last = fan[fan.length - 1];

  // 확률 q 달성에 필요한 월 적립액 = 경로별 필요 적립액의 q 분위수
  const need = new Float64Array(paths);
  for (let p = 0; p < paths; p++) {
    const a = aArr[p] ?? 1;
    const b = bArr[p] ?? 1;
    need[p] = b > 0 ? Math.max(0, (target - initial * a) / b) : 0;
  }
  const needSorted = need.sort();
  const solveMonthly = (q: number): number | null => {
    const v = Math.ceil(quantileSorted(needSorted, q));
    return v > MAX_MONTHLY_SOLVE ? null : v;
  };

  return {
    probability: paths > 0 ? hit / paths : 0,
    hitCount: hit,
    paths,
    seed,
    fan,
    medianFinal: last?.p50 ?? initial,
    meanFinal: paths > 0 ? sum / paths : initial,
    p10Final: last?.p10 ?? initial,
    p90Final: last?.p90 ?? initial,
    invested: initial + monthly * months,
    deterministicFinal: futureValueFixed(initial, monthly, years, input.expReturnPct),
    requiredReturnPct: requiredReturnPct(initial, monthly, years, target),
    requiredMonthly50: solveMonthly(0.5),
    requiredMonthly75: solveMonthly(0.75),
  };
}
