/**
 * 도메인·외부 링크 단일 소스 (C4 D-3 / §6.2-4).
 * 도메인 미확보 상태(PRD 오픈 이슈 #2)라 env 로 주입하고 vercel.app 기본값을 둔다.
 * URL 하드코딩 금지 — 반드시 이 파일의 헬퍼를 경유할 것.
 */

const stripSlash = (u: string) => u.replace(/\/+$/, "");

/** 회사 소개 사이트 자신의 절대 URL (canonical·OG·sitemap 기준) */
export const COMPANY_URL = stripSlash(
  process.env.NEXT_PUBLIC_COMPANY_URL || "https://duckmate-company.vercel.app",
);

/** 서비스 본체(apps/web) 절대 URL */
export const WEB_URL = stripSlash(
  process.env.NEXT_PUBLIC_WEB_URL || "https://duckmate-web.vercel.app",
);

/**
 * 문의 폼 전송 엔드포인트 (Supabase Edge Function `company-contact`).
 * 비어 있으면 폼은 mailto 폴백 모드로 동작한다 (C4 D-4 / 26_fe_company.md §3).
 */
export const CONTACT_ENDPOINT = (process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || "").trim();

/** company → web 링크는 전부 UTM 필수 (C4 §6.2-1) */
export function webUrl(path: string, campaign: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const q = new URLSearchParams({
    utm_source: "company",
    utm_medium: "referral",
    utm_campaign: campaign,
  });
  return `${WEB_URL}${p}?${q.toString()}`;
}

/**
 * 법적 문서 6종 — 원문은 apps/web 단일 게시, company 는 링크만 (C4 §3.3).
 * company 에 사본을 두지 않는다(개정 시 불일치 방지).
 */
export const LEGAL_DOCS = [
  { label: "이용약관", path: "/legal/terms" },
  { label: "개인정보처리방침", path: "/legal/privacy" },
  { label: "위치기반서비스 이용약관", path: "/legal/location" },
  { label: "청소년보호정책", path: "/legal/youth" },
  { label: "커뮤니티 가이드라인", path: "/legal/community" },
  { label: "환불정책", path: "/legal/refund" },
] as const;
