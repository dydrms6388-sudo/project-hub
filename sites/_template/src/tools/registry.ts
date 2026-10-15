export type Faq = { q: string; a: string };

export type ToolMeta = {
  /** URL: /tools/<slug>/ */
  slug: string;
  /** <title> 에 들어가는 문구 */
  title: string;
  /** H1 — 한국어 검색어를 그대로 쓴다 */
  h1: string;
  description: string;
  keywords: string[];
  category: string;
  /** 사용법 단계 */
  howto: string[];
  /** 원리·근거 (문단 배열, 마크다운 아님 — 순수 텍스트) */
  principle: string[];
  /** 출처 링크 (선택) */
  sources?: { label: string; url: string }[];
  /** FAQ 5개 — JSON-LD FAQPage 로 나간다 */
  faq: Faq[];
  /** 관련 도구 slug */
  related: string[];
  /** 무거운 도구면 "PC 권장" 뱃지 */
  heavy?: boolean;
};

export const tools: ToolMeta[] = [
  {
    slug: "sample",
    title: "샘플 도구",
    h1: "샘플 도구",
    description: "템플릿 동작 확인용 샘플 도구입니다.",
    keywords: ["샘플", "테스트"],
    category: "기타",
    howto: ["입력창에 텍스트를 넣습니다.", "결과가 바로 표시됩니다.", "복사 버튼을 누릅니다."],
    principle: ["이 페이지는 템플릿이 정상 동작하는지 확인하기 위한 샘플입니다."],
    faq: [
      { q: "이 도구는 무엇인가요?", a: "템플릿 검증용 샘플입니다." },
      { q: "파일이 서버로 전송되나요?", a: "아니요. 모든 처리는 브라우저 안에서만 이루어집니다." },
      { q: "무료인가요?", a: "네, 전부 무료입니다." },
      { q: "회원가입이 필요한가요?", a: "필요 없습니다." },
      { q: "모바일에서도 되나요?", a: "네, 반응형으로 동작합니다." },
    ],
    related: [],
  },
];

export const toolBySlug = (slug: string): ToolMeta | undefined =>
  tools.find((t) => t.slug === slug);

export const toolsByCategory = (): { category: string; items: ToolMeta[] }[] => {
  const map = new Map<string, ToolMeta[]>();
  for (const t of tools) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
};
