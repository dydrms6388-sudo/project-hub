import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_NAME } from "@/config/company";
import { LEGAL_DOCS, LEGAL_ROUTE_SLUGS } from "@/lib/legal";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/JsonLd";
import { companyUrl } from "@/config/company";

export const metadata: Metadata = {
  title: "법적 고지",
  description: `이용약관, 개인정보처리방침, 위치정보 이용약관, 청소년보호정책, 사업자 정보 다섯 가지 법적 고지를 한곳에서 볼 수 있어요. 앱과 같은 내용이에요.`,
  alternates: { canonical: "/legal/" },
};

export default function LegalIndexPage() {
  const items = [
    ...LEGAL_ROUTE_SLUGS.map((s) => ({ href: `/legal/${s}/`, label: LEGAL_DOCS[s].label, description: LEGAL_DOCS[s].description })),
    { href: "/legal/business/", label: "사업자 정보", description: "상호·대표자·사업자등록번호·통신판매업 신고번호·주소·고객센터·책임자·호스팅 제공자." },
  ];
  return (
    <Container className="py-12 md:py-16">
      <p className="text-label text-primary">법적 고지</p>
      <h1 className="text-h1 mt-1">{SERVICE_NAME} 약관과 정책</h1>
      <p className="text-body mt-3 max-w-2xl text-muted-foreground">앱 안의 문서와 같은 내용이에요. 변경되면 시행일이 함께 갱신돼요.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="block h-full rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted">
              <span className="text-h3 block">{it.label}</span>
              <span className="text-body-sm mt-2 block text-muted-foreground">{it.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "법적 고지", url: companyUrl("/legal/"), inLanguage: "ko" }} />
    </Container>
  );
}
