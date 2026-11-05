import Link from "next/link";
import { LegalFooter, type LegalCompanyInfo } from "@duckmate/ui";
import { company } from "@/config/company";
import { LEGAL_LINKS } from "@/lib/legal";

/** company.ts → @duckmate/ui LegalFooter props (11_design_system 결정 21). 플레이스홀더는 [TODO_사업자정보] 그대로 노출. */
export function legalCompanyInfo(): LegalCompanyInfo {
  return {
    companyName: company.COMPANY_NAME,
    ceoName: company.CEO_NAME,
    bizNo: company.BUSINESS_NUMBER,
    ecomNo: company.ECOMMERCE_REG_NUMBER,
    address: company.ADDRESS,
    email: company.CONTACT_EMAIL,
    phone: company.CONTACT_PHONE,
    privacyOfficer: company.PRIVACY_OFFICER_NAME,
    youthOfficer: company.YOUTH_OFFICER_NAME,
    hostingProvider: company.HOSTING_PROVIDER,
  };
}

export function footerYear(): number {
  const y = Number(company.FOUNDED_YEAR);
  return Number.isInteger(y) && y > 2000 ? y : new Date().getFullYear();
}

/** 법적 페이지 하단 사업자 블록 + /legal/* 링크 7종 (Next Link 주입) */
export function LegalFooterBlock({ compact = false }: { compact?: boolean }) {
  return (
    <LegalFooter
      company={legalCompanyInfo()}
      links={[...LEGAL_LINKS]}
      year={footerYear()}
      compact={compact}
      renderLink={(l, p) => (
        <Link href={l.href} className={p.className}>
          {p.children}
        </Link>
      )}
    />
  );
}
