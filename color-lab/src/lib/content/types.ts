// 색상 페이지 본문 콘텐츠 타입.
// order: 페이지 섹션 배치 순서(색마다 다르게 구성). hero는 항상 처음,
// related·faq는 항상 마지막이므로 여기서는 중간 섹션만 나열한다.
export type SectionKey =
  | "codes"
  | "shades"
  | "harmony"
  | "contrast"
  | "cvd"
  | "history"
  | "tips";

export type ColorContent = {
  intro: string;
  history: string[]; // 유래와 쓰임 (문단 배열)
  tips: string[]; // 실전 사용 팁 (잘 맞는 곳 / 실패하기 쉬운 곳)
  faq: { q: string; a: string }[];
  related: string[]; // slug 3개
  order: SectionKey[];
};
