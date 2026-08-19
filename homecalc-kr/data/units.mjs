// 단위 환산 상수 — 각 항목 {value, source, checkedAt}
export const M2_PER_PYEONG = {
  value: 3.305785, // 1평 = 400/121 ㎡ ≈ 3.305785㎡
  source: "https://www.law.go.kr/법령/계량에관한법률", // 계량에 관한 법률(법정계량단위: ㎡) — 평은 비법정단위, 관용 환산 400/121㎡
  checkedAt: "2026-08-19",
  note: "1평 = 400/121㎡ = 3.3057851…㎡. 계량에 관한 법률상 법정 단위는 ㎡이며 '평'은 관용 단위.",
};

export const EXCLUSIVE_RATE_RANGE = {
  value: { min: 0.72, max: 0.85 },
  source: "https://www.law.go.kr/법령/주택법", // 전용/공급(주거공용 포함) 면적 구분 근거: 주택법·주택공급에관한규칙
  checkedAt: "2026-08-19",
  note: "아파트 전용률(전용면적/공급면적)은 단지마다 다르며 통상 72~85% 수준. 참고용.",
  practice: true,
};
