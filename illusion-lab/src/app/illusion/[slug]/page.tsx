import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SITE_NAME,
  SITE_URL,
  getCategory,
  getIllusion,
  illusions,
  related,
} from "@/lib/illusions";
import { contents } from "@/lib/content";
import { tips } from "@/lib/content/tips";
import { FigureSvg } from "@/lib/figures";
import IllusionStage from "@/components/IllusionStage";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return illusions.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ill = getIllusion(slug);
  if (!ill) return {};
  const c = contents[slug];
  return {
    title: `${ill.name} — 직접 조작하는 ${ill.year}년 고전 착시`,
    description: c
      ? `${ill.name}(${ill.nameEn})을 슬라이더로 조작하고 속임수 벗기기로 실제 값을 확인해 보세요. ${ill.discoveredBy}, ${ill.year}년. 원리: ${ill.mechanism}.`
      : undefined,
    alternates: { canonical: `/illusion/${slug}/` },
  };
}

export default async function IllusionPage({ params }: Props) {
  const { slug } = await params;
  const ill = getIllusion(slug);
  const content = contents[slug];
  if (!ill || !content) notFound();
  const cat = getCategory(ill.category);
  const rel = related(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: cat?.label,
            item: `${SITE_URL}/category/${ill.category}/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: ill.name,
            item: `${SITE_URL}/illusion/${ill.slug}/`,
          },
        ],
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
        "@type": "Article",
        headline: `${ill.name} — 인터랙티브 체험과 원리 해설`,
        about: ill.nameEn,
        inLanguage: "ko",
        author: { "@type": "Organization", name: SITE_NAME },
        mainEntityOfPage: `${SITE_URL}/illusion/${ill.slug}/`,
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
        <Link href="/">홈</Link> ›{" "}
        <Link href={`/category/${ill.category}/`}>{cat?.label}</Link> ›{" "}
        {ill.name}
      </nav>
      <header className="illusion-head">
        <h1>{ill.name}</h1>
        <p className="meta">
          {ill.nameEn} · {ill.discoveredBy}, {ill.year} · 원리: {ill.mechanism}
        </p>
      </header>

      <IllusionStage illusion={ill} />

      <article className="body">
        <p>{content.intro}</p>

        <div className="fact-box">
          <dl>
            <dt>발견</dt>
            <dd>
              {ill.discoveredBy} ({ill.year})
            </dd>
            <dt>분류</dt>
            <dd>{cat?.label}</dd>
            <dt>핵심 기제</dt>
            <dd>{ill.mechanism}</dd>
          </dl>
        </div>

        <h2>무엇이 보이는가</h2>
        <p>{content.see}</p>

        <h2>실제로는 무엇인가</h2>
        <p>{content.reality}</p>

        <h2>왜 속는가 — 시각 처리 단계별 설명</h2>
        <ol>
          {content.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>

        {tips[slug] && (
          <>
            <h2>관찰과 실험 팁</h2>
            <p>{tips[slug]}</p>
          </>
        )}

        <h2>발견 경위와 연구사</h2>
        <p>{content.history}</p>

        <h2>같은 원리의 다른 착시</h2>
        <div className="related-grid">
          {rel.map((r) => (
            <Link key={r.slug} href={`/illusion/${r.slug}/`} className="card">
              <FigureSvg slug={r.slug} />
              <div className="card-body">
                <div className="card-title">{r.name}</div>
                <div className="card-meta">{r.mechanism.split("·")[0]}</div>
              </div>
            </Link>
          ))}
        </div>

        <h2>자주 묻는 질문</h2>
        <div className="faq">
          {content.faq.map((f, i) => (
            <details key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>

        <p className="disclaimer">
          이 페이지의 체험과 해설은 교육·재미 목적으로 제공되며, 시각 기능에
          대한 의학적 진단이나 검사를 대신하지 않습니다. 착시가 평소와 다르게
          느껴지는 것은 정상 범위의 개인차입니다. 시야 이상이 의심되면
          안과 진료를 받으세요.
        </p>
      </article>
    </main>
  );
}
