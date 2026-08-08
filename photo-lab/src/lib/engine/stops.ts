// 스톱 산술 — 명목(nominal) 클릭값 표기 + 정확값(2^(n/3) 등) 계산.
// 근거: APEX 체계(ANSI PH2.5-1960), ISO 517 조리개 표기.

export type StopStep = 3 | 2 | 1; // 1/3, 1/2, 1스톱

/** 1/3스톱 명목 f값 (실제 카메라 클릭값) */
export const F_THIRD = [
  1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.2, 3.5, 4.0, 4.5, 5.0,
  5.6, 6.3, 7.1, 8.0, 9.0, 10.0, 11.0, 13.0, 14.0, 16.0, 18.0, 20.0, 22.0,
];

/** 1/2스톱 명목 f값 */
export const F_HALF = [
  1.0, 1.2, 1.4, 1.7, 2.0, 2.4, 2.8, 3.3, 4.0, 4.8, 5.6, 6.7, 8.0, 9.5, 11.0,
  13.0, 16.0, 19.0, 22.0,
];

/** 1스톱 명목 f값 */
export const F_FULL = [1.0, 1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 11.0, 16.0, 22.0];

/** 1/3스톱 명목 셔터 표기 */
export const T_THIRD = [
  "1/8000", "1/6400", "1/5000", "1/4000", "1/3200", "1/2500", "1/2000",
  "1/1600", "1/1250", "1/1000", "1/800", "1/640", "1/500", "1/400", "1/320",
  "1/250", "1/200", "1/160", "1/125", "1/100", "1/80", "1/60", "1/50", "1/40",
  "1/30", "1/25", "1/20", "1/15", "1/13", "1/10", "1/8", "1/6", "1/5", "1/4",
  "1/3", "0.4", "0.5", "0.6", "0.8", "1", "1.3", "1.6", "2", "2.5", "3.2",
  "4", "5", "6", "8", "10", "13", "15", "20", "25", "30",
];

export const T_FULL = [
  "1/8000", "1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60",
  "1/30", "1/15", "1/8", "1/4", "1/2", "1", "2", "4", "8", "15", "30",
];

export const T_HALF = [
  "1/8000", "1/6000", "1/4000", "1/3000", "1/2000", "1/1500", "1/1000",
  "1/750", "1/500", "1/350", "1/250", "1/180", "1/125", "1/90", "1/60",
  "1/45", "1/30", "1/20", "1/15", "1/10", "1/8", "1/6", "1/4", "0.3", "1/2",
  "0.7", "1", "1.5", "2", "3", "4", "6", "8", "10", "15", "20", "30",
];

/** ISO 계열 (1/3스톱) */
export const ISO_THIRD = [
  50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250,
  1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000,
  25600, 32000, 40000, 51200, 64000, 80000, 102400,
];

export const ISO_FULL = [
  50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400,
];

export function parseShutter(s: string): number {
  return s.includes("/") ? 1 / Number(s.split("/")[1]) : Number(s);
}

/** 명목값 → 정확 스톱 지수 (1/3스톱 격자 스냅). f값용: Av = log2(N²) */
export function fToAv(n: number): number {
  return Math.round(Math.log2(n * n) * 3) / 3;
}

/** 셔터 → Tv = -log2(t), 1/3 격자 스냅 */
export function tToTv(tSec: number): number {
  return Math.round(-Math.log2(tSec) * 3) / 3;
}

/** ISO → Sv 스텝 (100 기준), 1/3 격자 스냅 */
export function isoToSv(iso: number): number {
  return Math.round(Math.log2(iso / 100) * 3) / 3;
}

function nearest<T>(arr: readonly T[], score: (v: T) => number): T {
  let best = arr[0];
  let bestD = Infinity;
  for (const v of arr) {
    const d = Math.abs(score(v));
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function snapF(n: number, step: StopStep = 3): number {
  const list = step === 3 ? F_THIRD : step === 2 ? F_HALF : F_FULL;
  return nearest(list, (v) => Math.log2((v * v) / (n * n)));
}

export function snapShutter(tSec: number, step: StopStep = 3): string {
  const list = step === 3 ? T_THIRD : step === 2 ? T_HALF : T_FULL;
  return nearest(list, (v) => Math.log2(parseShutter(v) / tSec));
}

export function snapIso(iso: number, step: StopStep = 3): number {
  const list = step === 3 ? ISO_THIRD : ISO_FULL;
  return nearest(list, (v) => Math.log2(v / iso));
}

export interface EquivRow {
  n: number;
  t: string;
  iso: number;
  offStops: number; // 기준과의 실제 편차 (명목값 반올림 누적, 0이면 정확)
  possible: boolean;
}

/**
 * 등가 노출 조합표 생성.
 * fix: 고정할 축. 나머지 두 축을 클릭값 격자에서 이동.
 */
export function equivalentTable(
  n0: number,
  t0Sec: number,
  iso0: number,
  fix: "aperture" | "shutter" | "iso",
  step: StopStep = 3,
  range = 6 // 위아래 몇 클릭
): EquivRow[] {
  const ev0 = fToAv(n0) + tToTv(t0Sec) - isoToSv(iso0);
  const fList = step === 3 ? F_THIRD : step === 2 ? F_HALF : F_FULL;
  const tList = step === 3 ? T_THIRD : step === 2 ? T_HALF : T_FULL;
  const isoList = step === 3 ? ISO_THIRD : ISO_FULL;
  const inc = 1 / step;
  const rows: EquivRow[] = [];
  for (let k = -range; k <= range; k++) {
    const shift = k * inc;
    let n = n0;
    let t = t0Sec;
    let iso = iso0;
    let possible = true;
    if (fix === "iso") {
      // 조리개를 shift만큼 조이면 셔터는 그만큼 길게
      const av = fToAv(n0) + shift;
      const cand = fList.find((v) => Math.abs(fToAv(v) - av) < 0.01);
      if (!cand) possible = false;
      else n = cand;
      t = t0Sec * Math.pow(2, shift);
    } else if (fix === "aperture") {
      const sv = isoToSv(iso0) + shift;
      const cand = isoList.find((v) => Math.abs(isoToSv(v) - sv) < 0.01);
      if (!cand) possible = false;
      else iso = cand;
      t = t0Sec * Math.pow(2, -shift);
    } else {
      const av = fToAv(n0) + shift;
      const candN = fList.find((v) => Math.abs(fToAv(v) - av) < 0.01);
      const sv = isoToSv(iso0) + shift;
      const candI = isoList.find((v) => Math.abs(isoToSv(v) - sv) < 0.01);
      if (!candN || !candI) possible = false;
      else {
        n = candN;
        iso = candI;
      }
    }
    const tStr = snapShutter(t, step);
    const tSnapped = parseShutter(tStr);
    const evNow = fToAv(n) + tToTv(tSnapped) - isoToSv(iso);
    // 셔터 클릭 범위 밖이면 불가
    if (tSnapped > 30 * 1.3 || tSnapped < 1 / 8000 / 1.3) possible = false;
    rows.push({
      n,
      t: tStr,
      iso,
      offStops: Math.round((evNow - ev0) * 12) / 12,
      possible,
    });
  }
  return rows;
}
