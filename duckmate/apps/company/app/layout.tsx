import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRETENDARD_CDN_HREF } from "@duckmate/ui/tokens";
import "./globals.css";
import { SERVICE_NAME, assertCompanyConfig, company, companyUrl, isPlaceholder } from "@/config/company";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";

/** Vercel preview 배포는 인덱싱 금지(정적 export 라 X-Robots-Tag 대신 메타 noindex). 프로덕션·로컬은 index. */
const IS_PREVIEW = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

export const metadata: Metadata = {
  metadataBase: new URL(companyUrl()),
  title: {
    default: `${SERVICE_NAME} — 같은 걸 좋아하는 사람이랑 만나는 앱`,
    template: `%s · ${SERVICE_NAME}`,
  },
  description: `외모 스와이프 대신 덕질 궁합. 취미 Top3와 최애로 소개하고, 매칭되면 '같이 할 것'까지 골라주는 취미 친구·데이팅 앱. 만 19세 이상, 본인인증 필수.`,
  robots: IS_PREVIEW ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: { type: "website", locale: "ko_KR", siteName: SERVICE_NAME },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // 빌드(서버 렌더) 시 1회 경고. throw·exit 없음.
  assertCompanyConfig();
  const orgJsonLd = isPlaceholder(company.COMPANY_NAME)
    ? null
    : {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": companyUrl("/#organization"),
            name: company.COMPANY_NAME,
            url: companyUrl("/"),
            ...(isPlaceholder(company.CONTACT_EMAIL) ? {} : { email: company.CONTACT_EMAIL }),
          },
          {
            "@type": "WebSite",
            "@id": companyUrl("/#website"),
            name: SERVICE_NAME,
            url: companyUrl("/"),
            inLanguage: "ko",
            publisher: { "@id": companyUrl("/#organization") },
          },
        ],
      };

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href={PRETENDARD_CDN_HREF} />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
        {orgJsonLd ? <JsonLd data={orgJsonLd} /> : null}
      </body>
    </html>
  );
}
