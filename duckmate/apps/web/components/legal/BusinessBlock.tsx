import { company, display, isPlaceholder } from "@/config/company";

interface Row {
  label: string;
  value: string;
  /** 선택 항목: 플레이스홀더면 줄 미렌더 */
  optional?: boolean;
  href?: string;
}

/**
 * /legal/business — 전자상거래법 제13조 표시 항목 (마크다운 없음, company.ts 직접 렌더).
 * 플레이스홀더는 `[TODO_사업자정보]` 그대로 노출(숨기지 않음, 브리프 규칙 4).
 */
export function BusinessBlock() {
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
    <div className="rounded-lg border border-border bg-card p-5" data-testid="business-block">
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
