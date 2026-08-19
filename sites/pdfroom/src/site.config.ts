export const site = {
  name: "피디에프룸",
  shortName: "pdfroom",
  domain: "pdfroom.vercel.app",
  url: "https://pdfroom.vercel.app",
  description:
    "업로드 없는 PDF 편집. 합치기·분할·회전·페이지 삭제·워터마크·페이지 번호까지 전부 브라우저 안에서 처리하고, 한글 폰트 깨짐 문제도 해결합니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#b91c1c", accent: "#ef4444" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
