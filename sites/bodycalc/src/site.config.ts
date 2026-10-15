export const site = {
  name: "바디칼크",
  shortName: "bodycalc",
  domain: "bodycalc.vercel.app",
  url: "https://bodycalc.vercel.app",
  description:
    "BMI·기초대사량·카페인 반감기·수면 사이클까지, 계산에 쓰인 공식과 숫자 대입 과정을 그대로 보여주는 무료 건강 계산기 모음.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#0d9488", accent: "#14b8a6" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
