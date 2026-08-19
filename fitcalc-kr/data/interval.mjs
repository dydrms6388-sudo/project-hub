// 인터벌 타이머 프리셋 — {value, source, checkedAt} 규율.
export const CHECKED_AT = "2026-08-19";

export const PRESETS = [
  {
    id: "tabata",
    name: "타바타 (20초 운동 / 10초 휴식 × 8)",
    value: { prep: 10, work: 20, rest: 10, sets: 8 },
    // 출처: Tabata I et al. 1996, Med Sci Sports Exerc (IE1 프로토콜: 20s 초고강도 / 10s 휴식 × 7~8세트)
    source: "https://pubmed.ncbi.nlm.nih.gov/8897392/",
    checkedAt: CHECKED_AT,
  },
  {
    id: "hiit3030",
    name: "HIIT 30/30 × 10 (자체 구성)",
    value: { prep: 10, work: 30, rest: 30, sets: 10 },
    source: "자체 구성 프리셋 (연구 프로토콜 아님, 참고용)",
    checkedAt: CHECKED_AT,
  },
  {
    id: "core4515",
    name: "코어 서킷 45/15 × 6 (자체 구성)",
    value: { prep: 10, work: 45, rest: 15, sets: 6 },
    source: "자체 구성 프리셋 (연구 프로토콜 아님, 참고용)",
    checkedAt: CHECKED_AT,
  },
];
