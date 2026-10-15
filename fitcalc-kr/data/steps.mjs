// 걸음수 ↔ 거리 변환용 보폭 추정 계수 — {value, source, checkedAt} 규율.
export const CHECKED_AT = "2026-08-19";

// 걷기 보폭 ≈ 키 × 0.413(여) / 0.415(남) — 만보계 보정 관행 계수.
export const STRIDE_WALK = {
  female: { value: 0.413, source: "https://www.verywellfit.com/set-pedometer-better-accuracy-3432895", checkedAt: CHECKED_AT },
  male: { value: 0.415, source: "https://www.verywellfit.com/set-pedometer-better-accuracy-3432895", checkedAt: CHECKED_AT },
  avg: { value: 0.414, source: "https://www.verywellfit.com/set-pedometer-better-accuracy-3432895", checkedAt: CHECKED_AT },
};

// 달리기 보폭 계수 — 속도에 따라 편차가 매우 커서 단일 계수의 공신력 있는 출처를 확정하지 못함.
// TODO: 확인 필요 — UI에 "확인 필요" 배지로 표시하고 참고 추정으로만 제공.
export const STRIDE_RUN = {
  value: 0.65,
  needsCheck: true,
  todo: "달리기 보폭 계수(키×0.65) 공신력 있는 출처 확인 필요",
  source: "",
  checkedAt: CHECKED_AT,
};

/** 보폭(m) = 키(cm) × 계수 / 100 */
export function strideMeters(heightCm, factor) {
  return (heightCm * factor) / 100;
}
