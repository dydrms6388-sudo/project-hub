export const site = {
  name: "딕테이트",
  shortName: "dictate",
  domain: "dictate-kr.vercel.app",
  url: "https://dictate-kr.vercel.app",
  description:
    "녹음 파일이 서버로 올라가지 않는 한국어 받아쓰기. Whisper 모델이 브라우저 안에서 직접 돌아갑니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#2563eb", accent: "#0ea5e9" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
