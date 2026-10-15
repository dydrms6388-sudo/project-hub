import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL, byCategory, categories, getCategory } from "@/lib/sounds";

interface Props {
  params: Promise<{ cat: string }>;
}

export function generateStaticParams() {
  return categories.map((c) => ({ cat: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) return {};
  return {
    title: `${c.name} 실험 ${byCategory(cat).length}가지`,
    description: `${c.desc} 소리실험실의 ${c.name} 카테고리 — 브라우저에서 실시간 합성으로 직접 들어보는 인터랙티브 실험 목록.`,
    alternates: { canonical: `/category/${cat}/` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) notFound();
  const list = byCategory(cat);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: c.name,
        item: `${SITE_URL}/category/${cat}/`,
      },
    ],
  };

  return (
    <main className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link> › {c.name}
      </nav>
      <section className="hero" style={{ paddingTop: 8 }}>
        <h1>{c.name}</h1>
        <p>{c.desc}</p>
      </section>
      <section className="cat-section">
        <div className="card-grid">
          {list.map((s) => (
            <Link key={s.slug} href={`/sound/${s.slug}/`} className="card">
              <div className="card-title">
                {s.name}
                {s.needsHeadphones && (
                  <span className="hp-mark" title="이어폰 필수">
                    🎧
                  </span>
                )}
              </div>
              <div className="card-meta">{s.principle.slice(0, 60)}…</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
