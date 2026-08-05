export interface PatternContent {
  /** 도입 문단 — 항목마다 다른 구성 */
  intro: string;
  /** 수식과 원리: 대표 식 + 각 항의 역할 */
  formula: { expr: string; explain: string[] };
  /** 발견 경위와 수학사 */
  history: string;
  /** 파라미터를 극단으로 밀면 무슨 일이 생기는가 */
  extremes: string;
  faq: { q: string; a: string }[];
}
