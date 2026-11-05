/**
 * 앱 공용 법적 푸터 (서버 컴포넌트). 사업자 정보는 E4 소유 `apps/web/config/company.ts` 가 단일 소스 —
 * 값이 `{{KEY}}` 플레이스홀더면 LegalFooter 가 `[TODO_사업자정보]` 를 그대로 노출한다(브리프 규칙 4).
 */
import Link from "next/link";
import { LegalFooter, type LegalCompanyInfo, type LegalFooterProps } from "@duckmate/ui";
import { company } from "@/config/company";

export function companyToLegalInfo(c: typeof company): LegalCompanyInfo {
  return {
    companyName: c.COMPANY_NAME,
    ceoName: c.CEO_NAME,
    bizNo: c.BUSINESS_NUMBER,
    ecomNo: c.ECOMMERCE_REG_NUMBER,
    address: c.ADDRESS,
    email: c.CONTACT_EMAIL,
    phone: c.CONTACT_PHONE,
    privacyOfficer: c.PRIVACY_OFFICER_NAME,
    youthOfficer: c.YOUTH_OFFICER_NAME,
    hostingProvider: c.HOSTING_PROVIDER,
  };
}

export function LegalFooterWeb(props: Partial<LegalFooterProps>) {
  return (
    <LegalFooter
      company={companyToLegalInfo(company)}
      renderLink={(l, p) => (
        <Link href={l.href} className={p.className}>
          {p.children}
        </Link>
      )}
      {...props}
    />
  );
}
