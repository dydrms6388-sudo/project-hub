export interface CalcContent {
  /** 계산기 바로 아래 도입부 (1~2문단) */
  intro: string[];
  /** 공식의 각 항 설명 */
  formulaTerms: Array<[string, string]>;
  formulaNote?: string;
  /** 이 계산이 왜 필요한가 — 실제 촬영 상황 */
  why: string[];
  /** 흔히 잘못 알려진 것 */
  misconceptions: Array<{ claim: string; truth: string }>;
  /** 극단값에서 무슨 일이 생기는가 */
  extremes: string[];
  faq: Array<{ q: string; a: string }>;
  /** 관련 계산기·해설 3개: href는 /calc/.. 또는 /guide/.. */
  related: Array<{ href: string; label: string }>;
}

export interface GuideContent {
  /** 문단 배열. "## " 로 시작하면 소제목 */
  body: string[];
  related: Array<{ href: string; label: string }>;
}
