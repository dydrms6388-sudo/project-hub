export const site = {
  name: "머니칼크",
  shortName: "moneycalc",
  domain: "moneycalc-kr.vercel.app",
  url: "https://moneycalc-kr.vercel.app",
  description:
    "2026년 개정 요율을 그대로 보여주는 재테크 계산기 모음. 연봉 실수령액·퇴직금·대출이자·전월세 전환율까지, 계산에 쓴 요율과 출처를 함께 공개합니다.",
  email: "dydrms6388@gmail.com",
  locale: "ko_KR",
  /** 카테고리별 OG/뱃지 색 */
  colors: { primary: "#0f766e", accent: "#14b8a6" },
} as const;

/** STATIC_EXPORT 프리뷰에서 basePath 를 붙이기 위한 헬퍼 */
export const withBase = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
