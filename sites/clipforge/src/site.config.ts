export const site = {
  name: "클립포지",
  shortName: "clipforge",
  domain: "clipforge.vercel.app",
  url: "https://clipforge.vercel.app",
  description:
    "영상 세로 변환·자막 굽기·자르기·용량 줄이기·GIF 변환까지, 업로드 없이 브라우저에서 끝내는 숏폼 편집 도구 모음.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#7c3aed", accent: "#f43f5e" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
