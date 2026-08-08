import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SoundPlayer from "@/components/SoundPlayer";
import { SECTION_TITLES, getContent } from "@/lib/content";
import { SITE_NAME, SITE_URL, getCategory, getSound, sounds } from "@/lib/sounds";

export function generateStaticParams() {
  return sounds.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = getSound(slug);
  const c = s && getContent(slug);
  if (!s || !c) return {};
  return {
    title: `${s.name} — 직접 조작하는 소리 실험`,
    description: c.intro.slice(0, 155),
    alternates: { canonical: `/sound/${slug}/` },
  };
}

export default async function SoundPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getSound(slug);
  const content = s && getContent(slug);
  if (!s || !content) notFound();
  const cat = getCategory(s.category);
  const relatedSounds = content.related
    .map((r) => getSound(r))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${s.name} — ${SITE_NAME}`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}/sound/${s.slug}/`,
      description: content.intro.slice(0, 200),
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: cat?.label ?? s.category,
          item: `${SITE_URL}/category/${s.category}/`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: s.name,
          item: `${SITE_URL}/sound/${s.slug}/`,
        },
      ],
    },
  ];

  return (
    <main className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="breadcrumb">
        <Link href="/">홈</Link> ›{" "}
        <Link href={`/category/${s.category}/`}>{cat?.label}</Link> › {s.name}
      </p>
      <h1>{s.name}</h1>
      <div className="prose">
        <p className="lead">{content.intro}</p>
      </div>

      <SoundPlayer sound={s} presets={content.presets} />

      <div className="prose">
        <h2>파라미터가 소리를 바꾸는 방식</h2>
        <ul className="param-doc">
          {s.params.map((p) => (
            <li key={p.name}>
              <b>{p.name}</b> ({p.min}–{p.max}
              {p.unit && ` ${p.unit}`}) — {p.meaning}
            </li>
          ))}
        </ul>

        {content.sectionOrder.map((key) => (
          <section key={key}>
            <h2>{SECTION_TITLES[key]}</h2>
            <p>{content[key]}</p>
          </section>
        ))}

        <h2>같은 원리의 다른 실험</h2>
        <ul className="related-grid">
          {relatedSounds.map((r) => (
            <li key={r.slug} className="card">
              <Link href={`/sound/${r.slug}/`}>{r.name}</Link>
              <p>{r.principle.split(". ")[0].slice(0, 70)}…</p>
            </li>
          ))}
        </ul>

        <h2>자주 묻는 질문</h2>
        <div className="faq">
          {content.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
