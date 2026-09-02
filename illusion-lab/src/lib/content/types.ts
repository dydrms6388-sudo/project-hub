export interface Faq {
  q: string;
  a: string;
}

export interface IllusionContent {
  /** 도입 문단 — 항목마다 문형을 달리한다 */
  intro: string;
  /** 무엇이 보이는가 */
  see: string;
  /** 실제로는 무엇인가 */
  reality: string;
  /** 왜 속는가 — 시각 처리 단계별. 근거 있는 설명만, 논쟁 중이면 그렇게 표기 */
  why: string[];
  /** 발견 경위와 연구사 */
  history: string;
  faq: Faq[];
}
