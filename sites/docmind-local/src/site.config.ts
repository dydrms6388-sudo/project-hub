export const site = {
  name: "도구 사이트",
  shortName: "tool",
  domain: "example.vercel.app",
  url: "https://example.vercel.app",
  description: "브라우저에서 바로 쓰는 무료 도구 모음.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#2563eb", accent: "#0ea5e9" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
