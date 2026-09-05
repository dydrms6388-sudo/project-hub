import type { Metadata } from "next";
import { site } from "@/site.config";
import type { ToolMeta } from "@/tools/registry";

export function toolMetadata(t: ToolMeta): Metadata {
  const url = `${site.url}/tools/${t.slug}`;
  const og = `${site.url}/og/${t.slug}`;
  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: t.title,
      description: t.description,
      url,
      siteName: site.name,
      locale: site.locale,
      type: "website",
      images: [{ url: og, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: t.title, description: t.description, images: [og] },
  };
}

export function toolJsonLd(t: ToolMeta) {
  const url = `${site.url}/tools/${t.slug}`;
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: t.title,
    description: t.description,
    url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    inLanguage: "ko",
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const howto = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `${t.title} 사용법`,
    step: t.howto.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
  };
  return [app, faq, howto];
}
