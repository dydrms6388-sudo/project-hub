import type { Metadata } from "next";
import { SERVICE_NAME, companyUrl } from "@/config/company";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "문의하기",
  description: "제휴, 언론, 안전, 기타 문의를 남겨 주세요. 앱 이용 중 신고는 앱 안의 신고 버튼이 가장 빠릅니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <Container className="py-12 md:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-label text-primary">문의</p>
        <h1 className="text-h1 mt-1">문의하기</h1>
        <p className="text-body mt-4 text-muted-foreground">
          제휴, 언론, 안전, 그 밖의 이야기를 남겨 주세요. <strong className="text-foreground">앱 이용 중 겪은 문제는 앱 안 [신고] 버튼이 가장 빨라요</strong> — 대화 기록이 자동으로 첨부되고 24시간 안에 확인해요.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </div>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ContactPage", name: `문의하기 · ${SERVICE_NAME}`, url: companyUrl("/contact/"), inLanguage: "ko" }} />
    </Container>
  );
}
