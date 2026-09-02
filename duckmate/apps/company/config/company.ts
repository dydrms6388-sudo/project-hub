/**
 * company.ts — 사업자·서비스 정보의 단일 소스 (13_company_site §2 + 08_legal_docs README 변수 18개).
 *
 * 규칙
 * - 모든 값은 string. 미입력은 이중 중괄호 토큰(KEY 이름 그대로)을 둔다(null·빈 문자열 금지, 예외: CONTACT_ENDPOINT 는 빈 값 허용).
 * - 키 = 대문자 스네이크 = 법적 문서(apps/web/content/legal/*.md)의 치환 토큰 이름과 1:1.
 *   08_legal_docs 결정 3에 따라 PRD 의 BIZ_NO / ECOM_NO / PRIVACY_OFFICER 는
 *   BUSINESS_NUMBER / ECOMMERCE_REG_NUMBER / PRIVACY_OFFICER_NAME 으로 통일했다(13_company_site §2 표기 대체).
 * - 화면 노출: 푸터·/legal/business/ 는 플레이스홀더를 LEGAL_TODO 문구로 그대로 출력(브리프 규칙 4).
 *   본문 치환(fillPlaceholders)은 값이 플레이스홀더면 토큰을 그대로 남긴다(PRD §4.7).
 * - `scripts/check-legal-placeholders.mjs` 가 이 파일을 스캔해 남은 토큰을 경고한다(차단 X).
 */
import { LEGAL_TODO } from "@duckmate/ui/tokens";

/** 서비스명 — 가칭. 상표 검색(KIPRIS 9·38·42·45류) 후 확정. 컴포넌트·카피에 리터럴 금지, 이 상수만 참조. */
export const SERVICE_NAME = "덕메이트";

export const company = {
  // ---- 법적 문서 변수 18개 (README 표 순서) ----
  COMPANY_NAME: "{{COMPANY_NAME}}", // 상호 (예: 주식회사 덕메이트)
  SERVICE_NAME, // 서비스명
  DOMAIN: "{{DOMAIN}}", // 서비스 도메인 (scheme 없이)
  BUSINESS_NUMBER: "{{BUSINESS_NUMBER}}", // 사업자등록번호 000-00-00000
  ECOMMERCE_REG_NUMBER: "{{ECOMMERCE_REG_NUMBER}}", // 통신판매업 신고번호 (Phase 3 전 플레이스홀더 허용)
  ADDRESS: "{{ADDRESS}}", // 사업장 주소(도로명)
  CEO_NAME: "{{CEO_NAME}}", // 대표자 성명
  CONTACT_EMAIL: "{{CONTACT_EMAIL}}", // 고객센터 이메일 (mailto 폴백·푸터)
  CONTACT_PHONE: "{{CONTACT_PHONE}}", // 고객센터 전화 (선택)
  EFFECTIVE_DATE: "{{EFFECTIVE_DATE}}", // 문서 시행일 YYYY-MM-DD (문서별 frontmatter override 가능)
  PRIVACY_OFFICER_NAME: "{{PRIVACY_OFFICER_NAME}}", // 개인정보보호책임자 성명
  PRIVACY_OFFICER_EMAIL: "{{PRIVACY_OFFICER_EMAIL}}",
  PRIVACY_OFFICER_PHONE: "{{PRIVACY_OFFICER_PHONE}}",
  LOCATION_OFFICER_NAME: "{{LOCATION_OFFICER_NAME}}", // 위치정보 관리책임자 (개인정보보호책임자 겸임 가능)
  LOCATION_OFFICER_EMAIL: "{{LOCATION_OFFICER_EMAIL}}",
  YOUTH_OFFICER_NAME: "{{YOUTH_OFFICER_NAME}}", // 청소년보호책임자 성명
  YOUTH_OFFICER_EMAIL: "{{YOUTH_OFFICER_EMAIL}}",
  SUPABASE_REGION: "{{SUPABASE_REGION}}", // 예: ap-northeast-2 (대한민국 서울)

  // ---- URL (env 우선) ----
  /** company 사이트 자기 URL (metadataBase·sitemap·robots) */
  COMPANY_URL: process.env.NEXT_PUBLIC_COMPANY_URL ?? "{{COMPANY_URL}}",
  /** 앱(apps/web) URL — 헤더 CTA·법적 고지 canonical */
  WEB_APP_URL: process.env.NEXT_PUBLIC_WEB_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "{{WEB_APP_URL}}",
  /** 문의 Edge Function URL. 빈 값 허용(미설정 시 폼은 오류 상태 + mailto 폴백) */
  CONTACT_ENDPOINT: process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "",

  // ---- 브랜드 (선택: 플레이스홀더면 미노출) ----
  SNS_X: "{{SNS_X}}",
  SNS_INSTAGRAM: "{{SNS_INSTAGRAM}}",
  FOUNDED_YEAR: "{{FOUNDED_YEAR}}",
  /** 전자상거래법 표시 항목: 호스팅 서비스 제공자 */
  HOSTING_PROVIDER: "Vercel Inc.",
} as const satisfies Record<string, string>;

export type CompanyKey = keyof typeof company;

/** 플레이스홀더면 줄·아이콘 자체를 렌더하지 않는 선택 항목. 그 외는 LEGAL_TODO 노출. */
export const OPTIONAL_KEYS: readonly CompanyKey[] = ["CONTACT_PHONE", "SNS_X", "SNS_INSTAGRAM", "FOUNDED_YEAR", "CONTACT_ENDPOINT"];

export const isPlaceholder = (v: string | null | undefined): boolean =>
  v == null || v.trim() === "" || /^\{\{[A-Z_]+\}\}$/.test(v.trim());

/** 사업자 블록 표시값: 플레이스홀더 → LEGAL_TODO (숨기지 않음) */
export const display = (v: string | null | undefined): string => (isPlaceholder(v) ? LEGAL_TODO : (v as string));

/** 치환 토큰 → company[KEY]. 값이 플레이스홀더거나 알 수 없는 키면 토큰을 그대로 남긴다. */
export function fillPlaceholders(text: string): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (token, key: string) => {
    if (!(key in company)) return token;
    const v = company[key as CompanyKey];
    return isPlaceholder(v) ? token : v;
  });
}

/** company 사이트 절대 URL (플레이스홀더면 로컬 기본값) */
export function companyUrl(path = ""): string {
  const base = isPlaceholder(company.COMPANY_URL) ? "http://localhost:3001" : company.COMPANY_URL.replace(/\/$/, "");
  return base + path;
}

/** 앱 URL. WEB_APP_URL 이 플레이스홀더면 null (CTA 는 "준비 중" 비활성) */
export function appUrl(path = ""): string | null {
  if (isPlaceholder(company.WEB_APP_URL)) return null;
  return company.WEB_APP_URL.replace(/\/$/, "") + path;
}

let warned = false;
/** 플레이스홀더 키 목록 반환 + console.warn 1회. throw·process.exit 금지(차단 X). */
export function assertCompanyConfig(): CompanyKey[] {
  const missing = (Object.keys(company) as CompanyKey[]).filter((k) => isPlaceholder(company[k]));
  if (missing.length && !warned) {
    warned = true;
    const required = missing.filter((k) => !OPTIONAL_KEYS.includes(k));
    const optional = missing.filter((k) => OPTIONAL_KEYS.includes(k));
    console.warn(
      `⚠️  [company] 사업자 정보 플레이스홀더 ${missing.length}개 — 화면에 ${LEGAL_TODO} 또는 토큰이 그대로 노출됩니다.\n` +
        `   필수: ${required.join(", ") || "-"}\n   선택: ${optional.join(", ") || "-"}`,
    );
  }
  return missing;
}
