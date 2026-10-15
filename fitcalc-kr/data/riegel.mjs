// Riegel 기록 예측 공식 — T2 = T1 × (D2/D1)^b
export const CHECKED_AT = "2026-08-19";

// 지수 b = 1.06 (Peter Riegel, 1981 "Athletic Records and Human Endurance")
export const RIEGEL_EXPONENT = {
  value: 1.06,
  source: "https://en.wikipedia.org/wiki/Peter_Riegel",
  checkedAt: CHECKED_AT,
};

/**
 * @param {number} t1 기준 기록(초)
 * @param {number} d1 기준 거리(km)
 * @param {number} d2 예측 거리(km)
 * @returns {number} 예측 기록(초)
 */
export function riegelPredict(t1, d1, d2) {
  return t1 * Math.pow(d2 / d1, RIEGEL_EXPONENT.value);
}
