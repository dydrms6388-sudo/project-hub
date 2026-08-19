// homecalc-kr 사이트 설정 — 절대 URL 은 이 상수 하나로만 관리한다.
// gen.mjs 가 sitemap.xml / robots.txt / 롱테일 페이지에 주입하고,
// 손으로 쓴 페이지의 canonical 호스트가 이 값과 다르면 경고한다.
export const SITE_ORIGIN = "https://homecalc-kr.vercel.app";
export const SITE_NAME = "홈캘크 HomeCalc";
export const HUB_TAGLINE = "집·인테리어·이사 계산기 허브";
export const ADSENSE_CLIENT = "ca-pub-5567719201265106";
