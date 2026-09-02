/**
 * company.ts (web) — 사업자·서비스 정보의 단일 소스 (08_legal_docs 결정 2 · README 변수 18개 · 26_fe_company §2 와 **동일 키**).
 *
 * 규칙
 * - 모든 값은 string. 미입력은 이중 중괄호 토큰(KEY 이름 그대로)을 둔다(null·빈 문자열 금지).
 * - 키 = 대문자 스네이크 = 법적 문서(content/legal/*.md)의 치환 토큰 이름과 1:1.
 * - 화면 노출: 푸터·/legal/business 는 플레이스홀더를 LEGAL_TODO 문구로 그대로 출력(브리프 규칙 4).
 *   본문 치환(fillPlaceholders)은 값이 플레이스홀더면 토큰을 그대로 남긴다(PRD §4.7).
 * - `scripts/check-legal-placeholders.mjs` 가 `apps/web/config` 를 스캔해 남은 토큰을 경고한다(차단 X).
 * - 값을 채울 때는 apps/company/config/company.ts 와 **같은 값**을 넣는다(소유자 1회 작업, 두 파일 동시).
 */
import { LEGAL_TODO } from "@duckmate/ui/tokens";

/** 서비스명 — 가칭. 컴포넌트·카피에 리터럴 금지, 이 상수만 참조(10_brand 결정 1). */
export const SERVICE_NAME = "덕메이트";

export const company = {
  // ---- 법적 문서 변수 18개 (README 표 순서) ----
  COMPANY_NAME: "{{COMPANY_NAME}}",
  SERVICE_NAME,
  DOMAIN: "{{DOMAIN}}",
  BUSINESS_NUMBER: "{{BUSINESS_NUMBER}}",
  ECOMMERCE_REG_NUMBER: "{{ECOMMERCE_REG_NUMBER}}",
  ADDRESS: "{{ADDRESS}}",
  CEO_NAME: "{{CEO_NAME}}",
  CONTACT_EMAIL: "{{CONTACT_EMAIL}}",
  CONTACT_PHONE: "{{CONTACT_PHONE}}",
  EFFECTIVE_DATE: "{{EFFECTIVE_DATE}}",
  PRIVACY_OFFICER_NAME: "{{PRIVACY_OFFICER_NAME}}",
  PRIVACY_OFFICER_EMAIL: "{{PRIVACY_OFFICER_EMAIL}}",
  PRIVACY_OFFICER_PHONE: "{{PRIVACY_OFFICER_PHONE}}",
  LOCATION_OFFICER_NAME: "{{LOCATION_OFFICER_NAME}}",
  LOCATION_OFFICER_EMAIL: "{{LOCATION_OFFICER_EMAIL}}",
  YOUTH_OFFICER_NAME: "{{YOUTH_OFFICER_NAME}}",
  YOUTH_OFFICER_EMAIL: "{{YOUTH_OFFICER_EMAIL}}",
  SUPABASE_REGION: "{{SUPABASE_REGION}}",

  // ---- URL (env 우선) ----
  /** 앱(apps/web) 자기 URL — canonical·공유 링크 */
  WEB_APP_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "{{WEB_APP_URL}}",
  /** 회사 사이트 URL — 설정 > 문의·회사 소개 링크 */
  COMPANY_URL: process.env.NEXT_PUBLIC_COMPANY_URL ?? "{{COMPANY_URL}}",
  /** 문의 Edge Function URL. 빈 값 허용 */
  CONTACT_ENDPOINT: process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "",

  // ---- 브랜드 (선택) ----
  SNS_X: "{{SNS_X}}",
  SNS_INSTAGRAM: "{{SNS_INSTAGRAM}}",
  FOUNDED_YEAR: "{{FOUNDED_YEAR}}",
  /** 전자상거래법 표시 항목: 호스팅 서비스 제공자 */
  HOSTING_PROVIDER: "Vercel Inc.",
} as const satisfies Record<string, string>;

export type CompanyKey = keyof typeof company;

/** README 표의 법적 문서 변수 18개 (체크 스크립트·테스트가 참조) */
export const LEGAL_VAR_KEYS = [
  "COMPANY_NAME",
  "SERVICE_NAME",
  "DOMAIN",
  "BUSINESS_NUMBER",
  "ECOMMERCE_REG_NUMBER",
  "ADDRESS",
  "CEO_NAME",
  "CONTACT_EMAIL",
  "CONTACT_PHONE",
  "EFFECTIVE_DATE",
  "PRIVACY_OFFICER_NAME",
  "PRIVACY_OFFICER_EMAIL",
  "PRIVACY_OFFICER_PHONE",
  "LOCATION_OFFICER_NAME",
  "LOCATION_OFFICER_EMAIL",
  "YOUTH_OFFICER_NAME",
  "YOUTH_OFFICER_EMAIL",
  "SUPABASE_REGION",
] as const satisfies ReadonlyArray<CompanyKey>;

/** 플레이스홀더면 줄·아이콘 자체를 렌더하지 않는 선택 항목. 그 외는 LEGAL_TODO 노출. */
export const OPTIONAL_KEYS: readonly CompanyKey[] = ["CONTACT_PHONE", "SNS_X", "SNS_INSTAGRAM", "FOUNDED_YEAR", "CONTACT_ENDPOINT"];

export const isPlaceholder = (v: string | null | undefined): boolean =>
  v == null || v.trim() === "" || /^\{\{[A-Z_]+\}\}$/.test(v.trim());

/** 사업자 블록 표시값: 플레이스홀더 → LEGAL_TODO (숨기지 않음) */
export const display = (v: string | null | undefined): string => (isPlaceholder(v) ? LEGAL_TODO : (v as string));

/** 치환 토큰 → company[KEY]. 값이 플레이스홀더거나 알 수 없는 키면 토큰을 그대로 남긴다(빌드 경고는 스크립트가). */
export function fillPlaceholders(text: string, source: Readonly<Record<string, string>> = company): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return token;
    const v = source[key];
    return isPlaceholder(v) ? token : (v as string);
  });
}

/** 앱 절대 URL (플레이스홀더면 로컬 기본값) */
export function siteUrl(path = ""): string {
  const base = isPlaceholder(company.WEB_APP_URL) ? "http://localhost:3000" : company.WEB_APP_URL.replace(/\/$/, "");
  return base + path;
}

/** 회사 사이트 URL. 플레이스홀더면 null(링크 미노출) */
export function companyUrl(path = ""): string | null {
  if (isPlaceholder(company.COMPANY_URL)) return null;
  return company.COMPANY_URL.replace(/\/$/, "") + path;
}

/**
 * 08_legal_docs 결정 2: COMPANY_NAME·ECOMMERCE_REG_NUMBER 가 비면 결제는 켤 수 없다.
 * `isPaymentsEnabled()`(lib/payments) 와 AND 로 묶어 판정한다(E4 구독 화면).
 */
export function paymentsAllowedByLegal(): boolean {
  return !isPlaceholder(company.COMPANY_NAME) && !isPlaceholder(company.ECOMMERCE_REG_NUMBER);
}

/** 앱 버전 표기(설정 하단). 빌드 시 NEXT_PUBLIC_APP_VERSION 을 주입하면 그 값 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

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
