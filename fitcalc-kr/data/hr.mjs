// 최대심박수 공식·심박 존 — 단일 소스. 항목마다 {value, source, checkedAt}.
export const CHECKED_AT = "2026-08-19";

export const HRMAX_FORMULAS = [
  {
    id: "fox",
    name: "220 − 나이 (Fox)",
    value: "HRmax = 220 − 나이",
    fn: (age) => 220 - age,
    note: "가장 널리 쓰이는 관행 공식. 개인 편차가 큼.",
    source: "https://en.wikipedia.org/wiki/Heart_rate#Maximum_heart_rate",
    checkedAt: CHECKED_AT,
  },
  {
    id: "tanaka",
    name: "Tanaka (208 − 0.7×나이)",
    value: "HRmax = 208 − 0.7 × 나이",
    fn: (age) => 208 - 0.7 * age,
    note: "Tanaka 등(2001) 메타분석 기반. 중장년에서 220−나이보다 오차가 작다고 보고됨.",
    source: "https://pubmed.ncbi.nlm.nih.gov/11153730/",
    checkedAt: CHECKED_AT,
  },
];

// Karvonen(여유심박, HRR) 방식: 목표심박 = 안정심박 + (최대심박 − 안정심박) × 강도
export const KARVONEN = {
  value: "THR = HRrest + (HRmax − HRrest) × 강도(%)",
  fn: (hrMax, hrRest, intensity) => hrRest + (hrMax - hrRest) * intensity,
  source: "https://en.wikipedia.org/wiki/Heart_rate_reserve",
  checkedAt: CHECKED_AT,
};

// 존 1~5 구분(%HRmax 기준 50~100%를 10%p 간격으로 나누는 관행적 구분 — 참고용)
export const HR_ZONES = {
  value: [
    { zone: 1, lo: 0.5, hi: 0.6, name: "존 1 · 회복", desc: "매우 편안함, 워밍업·쿨다운" },
    { zone: 2, lo: 0.6, hi: 0.7, name: "존 2 · 기초 유산소", desc: "대화 가능한 편안한 유산소" },
    { zone: 3, lo: 0.7, hi: 0.8, name: "존 3 · 유산소 지구력", desc: "약간 힘듦, 템포 낮은 지속주" },
    { zone: 4, lo: 0.8, hi: 0.9, name: "존 4 · 역치", desc: "힘듦, 젖산 역치 부근 인터벌·템포" },
    { zone: 5, lo: 0.9, hi: 1.0, name: "존 5 · 최대", desc: "매우 힘듦, 짧은 고강도 인터벌" },
  ],
  source: "https://en.wikipedia.org/wiki/Heart_rate#Training_zones",
  checkedAt: CHECKED_AT,
};
