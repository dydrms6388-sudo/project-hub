export interface Faq {
  q: string;
  a: string;
}

export interface Preset {
  name: string;
  /** 해당 항목 params 순서의 값 배열 (각 값은 min~max 안, step 배수) */
  values: number[];
}

export type SectionKey = "hear" | "signal" | "why" | "history";

export interface SoundContent {
  /** 도입 문단 — 항목마다 첫 문장 구조가 달라야 한다 */
  intro: string;
  /** 무엇이 들리는가 */
  hear: string;
  /** 실제 신호는 무엇인가 */
  signal: string;
  /** 왜 그렇게 들리는가 — 청각 처리 근거, 추측 금지, 근사·개인차·장비 의존성 명시 */
  why: string;
  /** 발견 경위와 연구사 */
  history: string;
  /** 본문 섹션 표시 순서 — 항목마다 다르게 섞는다 */
  sectionOrder: SectionKey[];
  faq: Faq[]; // 정확히 3개
  presets: Preset[]; // 정확히 3개
  /** 같은 원리의 다른 실험 3개 (유효한 slug) */
  related: string[];
}
