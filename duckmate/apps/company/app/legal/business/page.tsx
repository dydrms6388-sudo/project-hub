import type { Metadata } from "next";
import { SERVICE_NAME, company, companyUrl, isPlaceholder } from "@/config/company";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/JsonLd";
import { LegalBlockFull } from "@/components/LegalBlock";
import { LegalTabs } from "@/components/LegalTabs";

export const metadata: Metadata = {
  title: "사업자 정보",
  description: `${SERVICE_NAME}를 운영하는 사업자의 상호·대표자·사업자등록번호·통신판매업 신고번호·주소·고객센터·개인정보보호책임자·청소년보호책임자·호스팅 제공자 표시 항목입니다.`,
  alternates: { canonical: "/legal/business/" },
};

export default function BusinessPage() {
  return (
    <Container className="py-8 md:py-12">
      <LegalTabs current="/legal/business/" />
      <article className="mx-auto mt-8 max-w-3xl">
        <header className="pb-6">
          <p className="text-label text-primary">법적 고지</p>
          <h1 className="text-h1 mt-1">사업자 정보</h1>
          <p className="text-body mt-3 text-muted-foreground">
            「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따른 표시 항목이에요. 아직 입력되지 않은 항목은 그대로 표시되며 실서비스 전에 채워요.
          </p>
        </header>
        <LegalBlockFull />
        <p className="text-body-sm mt-6 text-muted-foreground">
          개인정보 열람·정정·삭제·다운로드 요청은 개인정보보호책임자 이메일 또는 문의 페이지로 보내 주세요. 문의 처리 후 10일 안에 회신해요.
        </p>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "사업자 정보",
          url: companyUrl("/legal/business/"),
          inLanguage: "ko",
          ...(isPlaceholder(company.COMPANY_NAME) ? {} : { about: { "@type": "Organization", name: company.COMPANY_NAME } }),
        }}
      />
    </Container>
  );
}
