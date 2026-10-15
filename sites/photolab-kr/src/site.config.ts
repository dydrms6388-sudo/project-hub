export const site = {
  name: "포토랩",
  shortName: "photolab",
  domain: "photolab-kr.vercel.app",
  url: "https://photolab-kr.vercel.app",
  description:
    "아이폰 HEIC 변환, 사진 위치정보 삭제, 용량 줄이기, 일괄 크기 조절까지 — 업로드 없이 브라우저에서 끝내는 사진 정리 도구 모음.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#2563eb", accent: "#0ea5e9" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
