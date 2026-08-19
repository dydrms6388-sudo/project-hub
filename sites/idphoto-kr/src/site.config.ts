export const site = {
  name: "증명사진 메이커",
  shortName: "idphoto",
  domain: "idphoto-kr.vercel.app",
  url: "https://idphoto-kr.vercel.app",
  description:
    "여권·비자·이력서·운전면허 증명사진을 브라우저에서 규격에 맞춰 만들고 300dpi로 저장하거나 4×6·A4 인화 배치 PDF로 뽑습니다. 사진은 서버로 전송되지 않습니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#2563eb", accent: "#0ea5e9" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
