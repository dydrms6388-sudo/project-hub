export interface ExpContent {
  /** 도입 문단 — 항목마다 다른 구성 */
  intro: string;
  /** 지배방정식 + 각 항의 역할 */
  equation: { expr: string; terms: string[] };
  /** 무엇을 보게 되는가 — 관찰 포인트 3가지 */
  observe: string[];
  /** 파라미터를 극단으로 밀면 */
  extremes: string;
  /** 실제 세계의 대응 사례 */
  realWorld: string;
  /** 발견 경위·연구사 */
  history: string;
  faq: { q: string; a: string }[];
}
