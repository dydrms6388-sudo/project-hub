export const site = {
  name: "AI 답변 정리",
  shortName: "aitidy",
  domain: "aitidy.vercel.app",
  url: "https://aitidy.vercel.app",
  description:
    "ChatGPT·Claude·제미나이 답변을 붙여넣기 좋게 정리하는 도구 모음. 마크다운 제거, 표 엑셀 변환, 코드블록 추출까지 브라우저에서 바로.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#2563eb", accent: "#0ea5e9" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
