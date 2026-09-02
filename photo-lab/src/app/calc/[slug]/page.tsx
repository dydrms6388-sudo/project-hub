import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CALCULATORS, CATEGORIES, getCalc, siteUrl } from "@/lib/data";
import { CALC_CONTENT } from "@/lib/content/calc";
import { GUIDES } from "@/lib/data";
import CalcShell from "@/components/CalcShell";

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const calc = getCalc(slug);
  if (!calc) return {};
  const content = CALC_CONTENT[slug];
  return {
    title: `${calc.name} — ${CATEGORIES[calc.category]}`,
    description: content?.intro[0]?.slice(0, 155) ?? calc.formula,
  };
}

function labelOf(href: string, fallback: string): string {
  if (href.startsWith("/calc/")) {
    const c = getCalc(href.replace("/calc/", "").replace(/\/$/, ""));
    return c?.name ?? fallback;
  }
  const g = GUIDES.find(
    (x) => x.slug === href.replace("/guide/", "").replace(/\/$/, "")
  );
  return g?.name ?? fallback;
}

export default async function CalcPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const calc = getCalc(slug);
  const content = CALC_CONTENT[slug];
  if (!calc || !content) notFound();

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: calc.name,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        description: content.intro[0],
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
        ...(base ? { url: `${base}/calc/${slug}/` } : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: content.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
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
            name: CATEGORIES[calc.category],
            ...(base ? { item: `${base}/category/${calc.category}/` } : {}),
          },
          { "@type": "ListItem", position: 3, name: calc.name },
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
        <Link href={`/category/${calc.category}/`}>
          {CATEGORIES[calc.category]}
        </Link>{" "}
        › {calc.name}
      </nav>

      <h1>{calc.name}</h1>
      <p className="page-desc">{content.intro[0]}</p>

      {/* 1~4. 계산기 본체 + 프리셋 + 시각화 (클라이언트) */}
      <CalcShell slug={slug} />

      {content.intro.slice(1).map((p, i) => (
        <p key={i} style={{ color: "var(--text-dim)", marginTop: 14 }}>
          {p}
        </p>
      ))}

      {/* 5. 공식과 각 항의 의미 */}
      <section className="section">
        <h2>공식</h2>
        <div className="formula-box">
          <code>{calc.formula}</code>
          <ul className="term-list">
            {content.formulaTerms.map(([term, meaning]) => (
              <li key={term}>
                <b>{term}</b>
                <span>{meaning}</span>
              </li>
            ))}
          </ul>
          {content.formulaNote ? (
            <p className="source-note">{content.formulaNote}</p>
          ) : null}
          <p className="source-note">
            공식 출처: {calc.formulaSource.문헌명} — {calc.formulaSource.출처}
          </p>
        </div>
      </section>

      {/* 6. 왜 필요한가 */}
      <section className="section">
        <h2>이 계산이 왜 필요한가</h2>
        {content.why.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      {/* 7. 흔한 오해 */}
      <section className="section">
        <h2>흔히 잘못 알려진 것</h2>
        {content.misconceptions.map((m) => (
          <div key={m.claim} className="myth">
            <p className="claim">{m.claim}</p>
            <p className="truth">{m.truth}</p>
          </div>
        ))}
      </section>

      {/* 8. 극단값 */}
      <section className="section">
        <h2>극단값에서 무슨 일이 생기는가</h2>
        {content.extremes.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      {/* 9. 관련 링크 */}
      <section className="section">
        <h2>함께 보면 좋은 것</h2>
        <div className="related-grid">
          {content.related.map((r) => (
            <Link key={r.href} href={`${r.href}/`} className="related-card">
              {labelOf(r.href, r.label)}
            </Link>
          ))}
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="section">
        <h2>자주 묻는 질문</h2>
        {content.faq.map((f) => (
          <div key={f.q} className="faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>
    </>
  );
}
