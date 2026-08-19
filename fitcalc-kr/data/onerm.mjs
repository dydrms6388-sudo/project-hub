// 1RM 추정 공식 5종 — 브라우저(ES 모듈)와 Node 테스트가 공유하는 단일 소스.
// 모든 항목: { value, source(URL), checkedAt } 규율 준수.
export const CHECKED_AT = "2026-08-19";

// 출처: 각 공식의 원 문헌을 정리한 위키백과 "One-repetition maximum" 문서(원 논문 서지 포함).
const SRC = "https://en.wikipedia.org/wiki/One-repetition_maximum";

export const ONE_RM_FORMULAS = [
  {
    id: "epley",
    name: "Epley",
    value: "1RM = w × (1 + r/30)",
    fn: (w, r) => (r <= 1 ? w : w * (1 + r / 30)),
    source: SRC,
    checkedAt: CHECKED_AT,
  },
  {
    id: "brzycki",
    name: "Brzycki",
    value: "1RM = w × 36 / (37 − r)",
    fn: (w, r) => (r <= 1 ? w : (w * 36) / (37 - r)),
    source: SRC,
    checkedAt: CHECKED_AT,
  },
  {
    id: "lombardi",
    name: "Lombardi",
    value: "1RM = w × r^0.10",
    fn: (w, r) => (r <= 1 ? w : w * Math.pow(r, 0.1)),
    source: SRC,
    checkedAt: CHECKED_AT,
  },
  {
    id: "oconner",
    name: "O'Conner",
    value: "1RM = w × (1 + 0.025r)",
    fn: (w, r) => (r <= 1 ? w : w * (1 + 0.025 * r)),
    source: SRC,
    checkedAt: CHECKED_AT,
  },
  {
    id: "wathan",
    name: "Wathan",
    value: "1RM = 100w / (48.8 + 53.8·e^(−0.075r))",
    fn: (w, r) => (r <= 1 ? w : (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r))),
    source: SRC,
    checkedAt: CHECKED_AT,
  },
];

/** 5공식 평균 1RM */
export function averageOneRM(w, r) {
  const vals = ONE_RM_FORMULAS.map((f) => f.fn(w, r));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// %1RM ↔ 반복수 관행표(트레이닝 현장 관행, 개인차 큼 — 참고용)
// 출처: NSCA Training Load Chart(공식 배포 자료)
export const PERCENT_STEPS = {
  value: [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50],
  source: "https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf",
  checkedAt: CHECKED_AT,
};
