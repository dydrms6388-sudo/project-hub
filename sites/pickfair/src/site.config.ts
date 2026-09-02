export const site = {
  name: "픽페어",
  shortName: "pickfair",
  domain: "pickfair.vercel.app",
  url: "https://pickfair.vercel.app",
  description:
    "사다리타기·룰렛·팀 나누기까지, 결과가 링크에 seed로 박히는 공정한 추첨 도구. 같은 링크를 열면 누구나 같은 결과를 재현할 수 있습니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#7c3aed", accent: "#f59e0b" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
