import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, GUIDES, getCalc, getGuide, siteUrl } from "@/lib/data";
import { GUIDE_CONTENT } from "@/lib/content/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.name,
    description: guide.topic.slice(0, 155),
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  const content = GUIDE_CONTENT[slug];
  if (!guide || !content) notFound();

  const relCalc = getCalc(guide.relatedCalculator);
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.name,
        description: guide.topic,
        inLanguage: "ko",
        ...(base ? { url: `${base}/guide/${slug}/` } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "PhotoLab",
            ...(base ? { item: `${base}/` } : {}),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: CATEGORIES[guide.category],
            ...(base ? { item: `${base}/category/${guide.category}/` } : {}),
          },
          { "@type": "ListItem", position: 3, name: guide.name },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="breadcrumb">
        <Link href="/">PhotoLab</Link> ›{" "}
        <Link href={`/category/${guide.category}/`}>
          {CATEGORIES[guide.category]}
        </Link>{" "}
        › 해설
      </nav>

      <h1>{guide.name}</h1>
      <p className="page-desc">{guide.topic}</p>

      <article className="prose">
        {content.body.map((p, i) =>
          p.startsWith("## ") ? (
            <h2 key={i}>{p.slice(3)}</h2>
          ) : (
            <p key={i}>{p}</p>
          )
        )}
      </article>

      <p className="source-note" style={{ marginTop: 24 }}>
        사실 근거: {guide.factualBasis}
      </p>

      <section className="section">
        <h2>직접 계산해 보기</h2>
        <div className="related-grid">
          {relCalc ? (
            <Link href={`/calc/${relCalc.slug}/`} className="related-card">
              {relCalc.name}
            </Link>
          ) : null}
          {content.related
            .filter((r) => !r.href.includes(guide.relatedCalculator))
            .slice(0, 2)
            .map((r) => (
              <Link key={r.href} href={`${r.href}/`} className="related-card">
                {r.label}
              </Link>
            ))}
        </div>
      </section>
    </>
  );
}
