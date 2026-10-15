// 광학 계산 모듈 — 내부 단위: 길이 mm, 피치 μm, 시간 s, 각도는 함수별 명시.
// 공식 출처는 data/calculators.json formulaSource 참조.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** 과초점거리 (mm). H = f²/(N·c) + f */
export function hyperfocalMm(f: number, N: number, c: number): number {
  return (f * f) / (N * c) + f;
}

export interface DofResult {
  hyperfocalMm: number;
  nearMm: number;
  /** Infinity 가능 */
  farMm: number;
  totalMm: number;
  beyondHyperfocal: boolean;
}

/** 심도 정확식. s: 피사체 거리(mm) */
export function dof(f: number, N: number, c: number, s: number): DofResult {
  const H = hyperfocalMm(f, N, c);
  const near = (s * (H - f)) / (H + s - 2 * f);
  const beyond = s >= H;
  // 부동소수점 경계: s가 H에 근접하면 분모가 0/음수로 튈 수 있어 명시 처리
  const far = beyond ? Infinity : (s * (H - f)) / (H - s);
  const safeFar = far < 0 ? Infinity : far;
  return {
    hyperfocalMm: H,
    nearMm: Math.max(near, 0),
    farMm: safeFar,
    totalMm: safeFar === Infinity ? Infinity : safeFar - near,
    beyondHyperfocal: beyond,
  };
}

/** 감상 조건 기반 CoC (mm). 0.2mm @ 25cm 시력 관례 */
export function cocFromViewing(
  sensorDiagMm: number,
  printDiagMm: number,
  viewDistMm: number
): number {
  const enlargement = printDiagMm / sensorDiagMm;
  return (0.2 * (viewDistMm / 250)) / enlargement;
}

/** d-분할 방식 CoC (mm). 기본 d=1500 */
export function cocFromD(sensorDiagMm: number, d = 1500): number {
  return sensorDiagMm / d;
}

/** NPF 간이식 (s). p: 화소피치 μm, decl: 적위 deg */
export function npfSeconds(
  N: number,
  p: number,
  f: number,
  declDeg = 0
): number {
  return (35 * N + 30 * p) / f / Math.cos(declDeg * D2R);
}

/** 500법칙 (s). fEq: 환산 초점거리 */
export function rule500Seconds(fEq: number): number {
  return 500 / fEq;
}

export const SIDEREAL_ARCSEC_PER_SEC = 15.0411;
const ARCSEC_PER_RAD = 206265;

/** 별 궤적: 센서상 길이(μm) */
export function starTrailUm(
  f: number,
  tSec: number,
  declDeg: number
): number {
  const arcsec = SIDEREAL_ARCSEC_PER_SEC * tSec * Math.cos(declDeg * D2R);
  return f * (arcsec / ARCSEC_PER_RAD) * 1000;
}

/** 화각 (deg). dim: 센서 치수 mm. 무한대 초점 기준 */
export function angleOfViewDeg(dimMm: number, f: number): number {
  return 2 * Math.atan(dimMm / (2 * f)) * R2D;
}

/** EV (ISO 100 환산). t: 초 */
export function ev100(N: number, tSec: number, iso = 100): number {
  return Math.log2((N * N) / tSec) - Math.log2(iso / 100);
}

/** 에어리 원반 지름 (μm). lambda: μm */
export function airyDiameterUm(N: number, lambdaUm = 0.55): number {
  return 2.44 * lambdaUm * N;
}

/** 회절 체감 시작 f수 (에어리 = 2×피치 기준) */
export function diffractionOnsetN(pitchUm: number, lambdaUm = 0.55): number {
  return (2 * pitchUm) / (2.44 * lambdaUm);
}

/** 화소 피치 (μm) */
export function pixelPitchUm(sensorWidthMm: number, hPixels: number): number {
  return (sensorWidthMm * 1000) / hPixels;
}

/** 플레이트 스케일 (″/px) */
export function plateScale(pitchUm: number, f: number): number {
  return (206.265 * pitchUm) / f;
}

/** 접사 노출 배수 (1+m)², 보정 스톱, 유효 f수 */
export function macroExposure(m: number, N: number) {
  const factor = (1 + m) ** 2;
  return {
    factor,
    stops: 2 * Math.log2(1 + m),
    effectiveN: N * (1 + m),
  };
}

/** 접사링 배율 (무한대 초점 기준) */
export function extensionMagnification(extMm: number, f: number): number {
  return extMm / f;
}

/** 상면 흐림 (μm). v: m/s, d: m, angleDeg: 이동 방향과 센서면 사이 각 */
export function motionBlurUm(
  vMs: number,
  dM: number,
  f: number,
  tSec: number,
  angleDeg = 0
): number {
  const mag = f / (dM * 1000 - f);
  return vMs * 1000 * mag * tSec * Math.cos(angleDeg * D2R) * 1000;
}

/** 파노라마 매수 */
export function panoramaShots(
  rotDimMm: number,
  f: number,
  overlap: number,
  totalDeg: number
) {
  const fovDeg = angleOfViewDeg(rotDimMm, f);
  const stepDeg = fovDeg * (1 - overlap);
  return { fovDeg, stepDeg, shots: Math.max(1, Math.ceil(totalDeg / stepDeg)) };
}

/** ND: 연장 셔터 (s) */
export function ndShutter(baseSec: number, stops: number): number {
  return baseSec * Math.pow(2, stops);
}

/** ND 배수 → 스톱 (예: 1000 → 9.97) */
export function ndFactorToStops(factor: number): number {
  return Math.log2(factor);
}

/** 광학밀도 → 스톱 */
export function odToStops(od: number): number {
  return od / Math.log10(2);
}

/** 플래시: 유효 GN (ISO·광량 반영) */
export function effectiveGN(gn100: number, iso: number, power = 1): number {
  return gn100 * Math.sqrt(iso / 100) * Math.sqrt(power);
}

/** 환산 초점거리·심도 등가 f수 */
export function equivalents(f: number, N: number, crop: number) {
  return { fEq: f * crop, nEqDof: N * crop };
}

/** 타임랩스 산술 */
export function timelapse(
  clipSec: number,
  fps: number,
  intervalSec: number,
  fileMb: number
) {
  const shots = Math.ceil(clipSec * fps);
  return {
    shots,
    shootMin: (shots * intervalSec) / 60,
    storageGb: (shots * fileMb) / 1024,
    speedup: intervalSec * fps,
  };
}

// ---------- 단위 표시 ----------
export const M_PER_FT = 0.3048;

export function fmtLen(
  mm: number,
  unit: "m" | "ft",
  digits = 2
): string {
  if (!isFinite(mm)) return "∞";
  if (unit === "ft") return `${(mm / 1000 / M_PER_FT).toFixed(digits)} ft`;
  if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
  return `${(mm / 1000).toFixed(digits)} m`;
}

export function fmtShutter(tSec: number): string {
  if (tSec >= 1) return `${+tSec.toFixed(1)}초`;
  return `1/${Math.round(1 / tSec)}초`;
}
