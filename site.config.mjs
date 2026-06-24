// 검색엔진 소유확인(verification) 코드 — 단일 주입 지점.
// 콘솔에서 받은 코드로 아래 값을 교체한 뒤 `node gen-pages.mjs` 재실행 → 전 페이지 <head>에 반영.
// (환경변수 GOOGLE_SITE_VERIFICATION / NAVER_SITE_VERIFICATION 로도 주입 가능)
export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || "REPLACE_GOOGLE_CODE";
export const NAVER_SITE_VERIFICATION = process.env.NAVER_SITE_VERIFICATION || "REPLACE_NAVER_CODE";
export const SITE = "https://tomatoeggcat.com";
