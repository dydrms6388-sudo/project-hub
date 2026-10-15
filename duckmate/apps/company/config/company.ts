import { BRAND_NAME } from "@duckmate/ui";

/**
 * 사업자 정보 단일 소스 (스펙 §7 · C4 13_company_site.md §3.2).
 *
 * 법적 고지 표·푸터·JSON-LD·문의 수신 주소가 **전부 이 파일 하나**를 참조한다.
 * 다른 파일에서 상호·대표자·이메일 등을 하드코딩하지 말 것.
 *
 * 값이 빈 문자열이면:
 *   - 화면에는 `[TODO_사업자정보]` 를 그대로 노출한다(숨기지 않는다, 스펙 §0-4).
 *   - 빌드 시 콘솔 경고를 띄우되 **빌드를 차단하지 않는다**(절대 규칙 4).
 */
export interface CompanyInfo {
  /** 서비스명 — 브랜드 토큰(@duckmate/ui BRAND_NAME) 단일 출처 */
  serviceName: string;
  /** 상호(법인명) — 전자상거래법 §10 */
  legalName: string;
  /** 대표자 */
  ceoName: string;
  /** 사업자등록번호 */
  bizRegNo: string;
  /** 통신판매업 신고번호 — Phase 3 결제 오픈 전 하드 블로커(PRD 이슈 #3) */
  mailOrderNo: string;
  /** 사업장 소재지 */
  address: string;
  /** 대표 전화 */
  phone: string;
  /** 대표 이메일 = 문의 수신 주소 */
  contactEmail: string;
  /** 개인정보보호책임자 — 개인정보보호법 */
  privacyOfficer: { name: string; email: string };
  /** 청소년보호책임자 — 정보통신망법 */
  youthOfficer: { name: string; email: string };
  /** 호스팅 서비스 제공자 — 전자상거래법 */
  hostingProvider: string;
}

export const TODO_PLACEHOLDER = "[TODO_사업자정보]";

export const company: CompanyInfo = {
  serviceName: BRAND_NAME,
  // ↓ 소유자 확인 전까지 전부 빈 문자열로 커밋 (C4 §3.2)
  legalName: "",
  ceoName: "",
  bizRegNo: "",
  mailOrderNo: "",
  address: "",
  phone: "",
  contactEmail: "",
  privacyOfficer: { name: "", email: "" },
  youthOfficer: { name: "", email: "" },
  hostingProvider: "Vercel Inc.",
};

/** 빈 값이면 화면 노출용 플레이스홀더로 치환한다. */
export function display(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : TODO_PLACEHOLDER;
}

/** 값이 실제로 채워져 있는지 (mailto·JSON-LD 처럼 플레이스홀더를 넣으면 안 되는 곳에서 사용) */
export function isFilled(value: string | undefined | null): boolean {
  return (value ?? "").trim().length > 0;
}

/** 미입력 필드 경로 목록 (예: "privacyOfficer.email") */
export function missingCompanyFields(info: CompanyInfo = company): string[] {
  const missing: string[] = [];
  const push = (path: string, v: string) => {
    if (!isFilled(v)) missing.push(path);
  };
  push("legalName", info.legalName);
  push("ceoName", info.ceoName);
  push("bizRegNo", info.bizRegNo);
  push("mailOrderNo", info.mailOrderNo);
  push("address", info.address);
  push("phone", info.phone);
  push("contactEmail", info.contactEmail);
  push("privacyOfficer.name", info.privacyOfficer.name);
  push("privacyOfficer.email", info.privacyOfficer.email);
  push("youthOfficer.name", info.youthOfficer.name);
  push("youthOfficer.email", info.youthOfficer.email);
  push("hostingProvider", info.hostingProvider);
  return missing;
}
