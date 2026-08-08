import raw from "../../data/colors.json";

export type ColorItem = {
  type: "color";
  slug: string;
  nameKo: string;
  nameEn: string;
  hex: string;
  family: string;
  sampleUses: string[];
  trademarkRisk: string;
};

export type PageItem = {
  type: "tool" | "theory";
  slug: string;
  name: string;
  computation: string;
  standardBasis: string;
};

type RawItem = Record<string, unknown>;
const items = (raw as { items: RawItem[] }).items;

export const COLORS: ColorItem[] = items.filter(
  (i) => i.type === "color"
) as ColorItem[];
export const TOOLS: PageItem[] = items.filter(
  (i) => i.type === "tool"
) as PageItem[];
export const THEORIES: PageItem[] = items.filter(
  (i) => i.type === "theory"
) as PageItem[];

export const FAMILIES: Record<string, { nameKo: string; desc: string }> = {
  red: { nameKo: "빨강 계열", desc: "가장 강한 주목성을 지닌 계열. 경고와 열정, 식욕까지 폭넓은 맥락에서 쓰인다." },
  orange: { nameKo: "주황 계열", desc: "빨강의 강렬함과 노랑의 명랑함 사이. 따뜻하고 친근한 인상을 만들 때 꺼내는 계열이다." },
  yellow: { nameKo: "노랑 계열", desc: "명도가 높아 눈에 먼저 들어오는 계열. 주의 표시와 강조에 오래 쓰여 왔다." },
  green: { nameKo: "초록 계열", desc: "자연·안전·성장의 맥락에서 자주 선택되는 계열. 명도 폭이 넓어 쓰임새가 다양하다." },
  cyan: { nameKo: "청록 계열", desc: "파랑과 초록의 경계. 차분하면서도 청량한 인상을 동시에 낼 수 있다." },
  blue: { nameKo: "파랑 계열", desc: "웹과 기업 디자인에서 가장 널리 쓰이는 계열. 신뢰·안정의 관례적 연상이 강하다." },
  purple: { nameKo: "보라 계열", desc: "역사적으로 귀했던 염료의 색. 창의성과 신비로움의 맥락에서 자주 쓰인다." },
  pink: { nameKo: "분홍 계열", desc: "채도에 따라 인상이 크게 갈리는 계열. 부드러움부터 강렬한 팝까지 폭이 넓다." },
  neutral: { nameKo: "무채·중립 계열", desc: "배경과 바탕을 만드는 계열. 다른 색을 살리는 받침 역할이 본업이다." },
};

export function getColor(slug: string): ColorItem | undefined {
  return COLORS.find((c) => c.slug === slug);
}
export function getTool(slug: string): PageItem | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
export function getTheory(slug: string): PageItem | undefined {
  return THEORIES.find((t) => t.slug === slug);
}
export function colorsInFamily(cat: string): ColorItem[] {
  return COLORS.filter((c) => c.family === cat);
}

export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL || undefined;
}
