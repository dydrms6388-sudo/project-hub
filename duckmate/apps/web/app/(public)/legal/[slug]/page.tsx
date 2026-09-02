import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { LegalTabs } from "@/components/legal/LegalTabs";
import { LEGAL_ALIASES, LEGAL_DOCS, LEGAL_ROUTE_SLUGS, loadLegalDoc, resolveLegalSlug } from "@/lib/legal";

export const dynamicParams = false;

/** 짧은 slug 6 + 긴 별칭 3(→ 301). 빌드 시 정적 생성. */
export function generateStaticParams() {
  return [...LEGAL_ROUTE_SLUGS, ...Object.keys(LEGAL_ALIASES)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = resolveLegalSlug(slug);
  if (!r) return {};
  const doc = loadLegalDoc(r.slug);
  return {
    title: doc.meta.title,
    description: LEGAL_DOCS[r.slug].description,
    alternates: { canonical: `/legal/${r.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = resolveLegalSlug(slug);
  if (!r) notFound();
  if (r.redirect) permanentRedirect(`/legal/${r.slug}`);
  const doc = loadLegalDoc(r.slug);
  return (
    <>
      <LegalTabs current={`/legal/${r.slug}`} />
      <LegalDocView doc={doc} />
    </>
  );
}
