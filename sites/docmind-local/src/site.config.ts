export const site = {
  name: "독마인드",
  shortName: "docmind",
  domain: "docmind-local.vercel.app",
  url: "https://docmind-local.vercel.app",
  description:
    "파일이 밖으로 나가지 않는 문서 요약·질문 도구. AI 모델을 브라우저로 내려받아 내 PC에서 직접 실행합니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#4338ca", accent: "#6366f1" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
