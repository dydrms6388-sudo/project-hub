import { company, isFilled } from "@/config/company";
import { COMPANY_URL } from "@/config/site";

/**
 * JsonLd (C4 D-2 / §5.2) — 값은 전부 company.ts·site.ts 에서 주입, 하드코딩 금지.
 * 미입력 사업자 값은 `[TODO_사업자정보]` 를 구조화 데이터에 넣지 않고 **필드 자체를 생략**한다
 * (화면 표시는 플레이스홀더 노출, 기계 판독 데이터는 거짓값 금지).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // 값 출처가 전부 빌드타임 상수라 XSS 벡터 없음. </script> 만 이스케이프.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function organizationJsonLd(): Record<string, unknown> {
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.serviceName,
    url: COMPANY_URL,
    // logo: 브랜드 벡터·OG 이미지 미제작(C2 D-6 후속). 존재하지 않는 파일을 참조하지 않는다.
  };

  if (isFilled(company.legalName)) org.legalName = company.legalName;
  if (isFilled(company.address)) org.address = company.address;

  const contactPoint: Record<string, unknown> = {
    "@type": "ContactPoint",
    contactType: "customer support",
    areaServed: "KR",
    availableLanguage: ["ko"],
  };
  if (isFilled(company.contactEmail)) contactPoint.email = company.contactEmail;
  if (isFilled(company.phone)) contactPoint.telephone = company.phone;
  if (isFilled(company.contactEmail) || isFilled(company.phone)) {
    org.contactPoint = contactPoint;
  }

  org.sameAs = [];
  return org;
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${company.serviceName} 회사 소개`,
    url: COMPANY_URL,
    inLanguage: "ko-KR",
  };
}
