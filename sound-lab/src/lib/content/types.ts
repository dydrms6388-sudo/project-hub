export interface Faq {
  q: string;
  a: string;
}

export interface Preset {
  /** 짧은 한국어 이름 (예: "느린 상승") */
  name: string;
  /** 슬라이더 파라미터 값 — sounds.json의 범위·step을 지켜야 한다 */
  params: Record<string, number>;
  /** 무엇이 달라지는지 한 줄 */
  note: string;
}

export interface SoundContent {
  /** 도입 문단 — 항목마다 문형과 구성 순서를 달리한다 */
  intro: string;
  /** 무엇이 들리는가 */
  hear: string;
  /** 실제 신호는 무엇인가 */
  signal: string;
  /** 왜 그렇게 들리는가 — 청각 처리 기반, 근거 있는 설명만. 논쟁 중이면 그렇게 표기 */
  why: string[];
  /** 발견 경위와 연구사 */
  history: string;
  faq: Faq[];
  presets: Preset[];
}
