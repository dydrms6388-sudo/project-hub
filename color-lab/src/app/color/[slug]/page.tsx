import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ColorPageBody from "@/components/ColorPageBody";
import { COLOR_CONTENT } from "@/lib/content";
import { COLORS, FAMILIES, getColor, siteUrl } from "@/lib/data";

export function generateStaticParams() {
  return COLORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const color = getColor(slug);
  if (!color) return {};
  return {
    title: `${color.nameKo}(${color.nameEn}) ${color.hex} — 색상 정보·배색·대비`,
    description: `${color.nameKo} ${color.hex}의 색상 코드(HEX·RGB·HSL·OKLCH), 명도 팔레트, 어울리는 배색, WCAG 대비비, 색각 이상 시뮬레이션과 유래를 한 페이지에서 만져 보세요.`,
  };
}

export default async function ColorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const color = getColor(slug);
  const content = COLOR_CONTENT[slug];
  if (!color || !content) notFound();

  const related = content.related
    .map((r) => getColor(r))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const fam = FAMILIES[color.family];
  const base = siteUrl();

  const jsonLd = [
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
        { "@type": "ListItem", position: 1, name: "색채 실험실", item: base ? `${base}/` : "/" },
        { "@type": "ListItem", position: 2, name: fam?.nameKo ?? color.family, item: base ? `${base}/family/${color.family}/` : `/family/${color.family}/` },
        { "@type": "ListItem", position: 3, name: color.nameKo, item: base ? `${base}/color/${color.slug}/` : `/color/${color.slug}/` },
      ],
    },
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="crumbs" aria-label="현재 위치">
        <Link href="/">색채 실험실</Link> ›{" "}
        <Link href={`/family/${color.family}/`}>{fam?.nameKo}</Link> ›{" "}
        {color.nameKo}
      </nav>
      <h1>
        {color.nameKo}{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          {color.nameEn} · {color.hex}
        </span>
      </h1>
      <p>{content.intro}</p>
      <p className="muted">
        주요 쓰임: {color.sampleUses.join(" · ")}
      </p>

      <ColorPageBody
        slug={color.slug}
        nameKo={color.nameKo}
        nameEn={color.nameEn}
        hex={color.hex}
        history={content.history}
        tips={content.tips}
        order={content.order}
      />

      <section>
        <h2>관련 색</h2>
        <ul className="swatch-grid">
          {related.map((r) => (
            <li key={r.slug}>
              <Link href={`/color/${r.slug}/`} className="swatch-card">
                <div className="chip" style={{ background: r.hex, height: 56 }} />
                <div className="meta">
                  <div>{r.nameKo}</div>
                  <div className="hex">{r.hex}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>자주 묻는 질문</h2>
        {content.faq.map((f) => (
          <div className="faq-item" key={f.q}>
            <div className="q">{f.q}</div>
            <div className="a">{f.a}</div>
          </div>
        ))}
      </section>

      <p className="footnote">
        색각 이상 시뮬레이션은 Machado, Oliveira &amp; Fernandes(2009)의 변환
        행렬을 사용한 근사이며 의료적 진단이 아닙니다. 대비비는 WCAG 2.1 상대
        휘도 공식으로 계산합니다. 색의 역사 서술 중 통설로 전해지는 내용은
        본문에 그렇게 표기했습니다.
      </p>
    </main>
  );
}
