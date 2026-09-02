import { LegalFooter, type LegalCompanyInfo } from "@duckmate/ui";
import { company, display, isPlaceholder } from "@/config/company";

/** company.ts → @duckmate/ui LegalFooter props 매핑 (E5 담당, 11_design_system 결정 21). */
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

/** 푸터용 축약 블록: ui LegalFooter 그대로(링크 nav 는 푸터 4열이 담당하므로 links=[]). */
export function LegalBlockCompact() {
  return <LegalFooter company={legalCompanyInfo()} links={[]} year={footerYear()} className="border-t-0 bg-transparent px-0 py-0" />;
}

interface Row {
  label: string;
  value: string;
  /** 선택 항목: 플레이스홀더면 줄 미렌더 */
  optional?: boolean;
  href?: string;
}

/**
 * /legal/business/ 전체 블록 (13_company_site §3.8 full):
 * 상호·대표·사업자등록번호·통신판매업신고번호·주소·이메일·전화(선택)·개인정보보호책임자·청소년보호책임자·호스팅 + 공정위 링크.
 * 플레이스홀더는 `[TODO_사업자정보]` 그대로 노출(숨기지 않음).
 */
export function LegalBlockFull() {
  const officer = (name: string, email: string) => (isPlaceholder(name) && isPlaceholder(email) ? display(name) : `${display(name)} (${display(email)})`);
  const rows: Row[] = [
    { label: "상호", value: company.COMPANY_NAME },
    { label: "대표자", value: company.CEO_NAME },
    { label: "사업자등록번호", value: company.BUSINESS_NUMBER },
    { label: "통신판매업 신고번호", value: company.ECOMMERCE_REG_NUMBER },
    { label: "사업장 주소", value: company.ADDRESS },
    { label: "고객센터 이메일", value: company.CONTACT_EMAIL, href: isPlaceholder(company.CONTACT_EMAIL) ? undefined : `mailto:${company.CONTACT_EMAIL}` },
    { label: "고객센터 전화", value: company.CONTACT_PHONE, optional: true },
    { label: "개인정보보호책임자", value: officer(company.PRIVACY_OFFICER_NAME, company.PRIVACY_OFFICER_EMAIL) },
    { label: "위치정보 관리책임자", value: officer(company.LOCATION_OFFICER_NAME, company.LOCATION_OFFICER_EMAIL) },
    { label: "청소년보호책임자", value: officer(company.YOUTH_OFFICER_NAME, company.YOUTH_OFFICER_EMAIL) },
    { label: "호스팅 서비스 제공자", value: company.HOSTING_PROVIDER },
  ];
  const bizDigits = company.BUSINESS_NUMBER.replace(/\D/g, "");
  const ftc = !isPlaceholder(company.BUSINESS_NUMBER) && bizDigits.length === 10 ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizDigits}` : null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 md:p-6">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-body sm:grid-cols-[max-content_1fr]" aria-label="사업자 정보">
        {rows.map((r) => {
          if (r.optional && isPlaceholder(r.value)) return null;
          const v = display(r.value);
          return (
            <div key={r.label} className="contents">
              <dt className="text-label text-muted-foreground">{r.label}</dt>
              <dd className="break-words text-foreground">
                {r.href && !isPlaceholder(r.value) ? (
                  <a href={r.href} className="text-primary underline underline-offset-4">
                    {v}
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {ftc ? (
        <p className="mt-5 text-body-sm">
          <a href={ftc} rel="noopener noreferrer" target="_blank" className="text-primary underline underline-offset-4">
            공정거래위원회 사업자정보확인
          </a>
        </p>
      ) : null}
    </div>
  );
}
