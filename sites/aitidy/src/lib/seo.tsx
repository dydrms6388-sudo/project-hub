import type { Metadata } from "next";
import { site } from "@/site.config";
import type { ToolMeta } from "@/tools/registry";

export function siteMetadata(): Metadata {
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s | ${site.name}` },
    description: site.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: site.locale,
      siteName: site.name,
      url: site.url,
      title: site.name,
      description: site.description,
    },
    twitter: { card: "summary_large_image", title: site.name, description: site.description },
    robots: { index: true, follow: true },
  };
}

export function toolMetadata(tool: ToolMeta): Metadata {
  const path = `/tools/${tool.slug}/`;
  return {
    title: tool.title,
    description: tool.description,
    keywords: [...tool.keywords],
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: site.locale,
      siteName: site.name,
      url: path,
      title: `${tool.title} | ${site.name}`,
      description: tool.description,
    },
    twitter: { card: "summary_large_image", title: tool.title, description: tool.description },
  };
}

/** SoftwareApplication + FAQPage + BreadcrumbList JSON-LD */
export function toolJsonLd(tool: ToolMeta) {
  const url = `${site.url}/tools/${tool.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.h1,
      description: tool.description,
      url,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (Web Browser)",
      inLanguage: "ko-KR",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${site.url}/` },
        { "@type": "ListItem", position: 2, name: "도구", item: `${site.url}/tools/` },
        { "@type": "ListItem", position: 3, name: tool.h1, item: url },
      ],
    },
  ];
}

export function JsonLd({ data }: { data: unknown[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD 는 신뢰된 자체 데이터만 직렬화한다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
