import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SITE_NAME,
  SITE_URL,
  getCategory,
  getPattern,
  patterns,
  related,
} from "@/lib/patterns";
import { contents } from "@/lib/content";
import { presets } from "@/lib/content/presets";
import Thumb from "@/components/Thumb";
import PatternStage from "@/components/PatternStage";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return patterns.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pat = getPattern(slug);
  if (!pat) return {};
  return {
    title: `${pat.name} — 파라미터로 그리는 ${pat.year}년 수학 패턴`,
    description: `${pat.name}을(를) 슬라이더로 조작하고 PNG·SVG로 내려받으세요. ${pat.mathBasis.split("—")[0].trim()}. ${pat.discoveredBy}, ${pat.year}년.`,
    alternates: { canonical: `/pattern/${slug}/` },
  };
}

export default async function PatternPage({ params }: Props) {
  const { slug } = await params;
  const pat = getPattern(slug);
  const content = contents[slug];
  if (!pat || !content) notFound();
  const cat = getCategory(pat.category);
  const rel = related(slug);
  const pset = presets[slug] ?? [];

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
            item: `${SITE_URL}/category/${pat.category}/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: pat.name,
            item: `${SITE_URL}/pattern/${pat.slug}/`,
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
        headline: `${pat.name} — 인터랙티브 생성기와 수식 해설`,
        about: pat.mathBasis,
        inLanguage: "ko",
        author: { "@type": "Organization", name: SITE_NAME },
        mainEntityOfPage: `${SITE_URL}/pattern/${pat.slug}/`,
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
        <Link href={`/category/${pat.category}/`}>{cat?.label}</Link> › {pat.name}
      </nav>
      <header className="illusion-head">
        <h1>{pat.name}</h1>
        <p className="meta">
          {pat.discoveredBy}, {pat.year}
        </p>
        <div className="meta-tags">
          <span className="tag">{cat?.label}</span>
          <span className={`tag cost`}>계산 비용 {pat.renderCost}</span>
          {pat.needsWorker && <span className="tag worker">Web Worker</span>}
        </div>
      </header>

      <PatternStage pattern={pat} presets={pset} />

      <article className="body">
        <p>{content.intro}</p>

        <h2>수식과 원리</h2>
        <div className="formula-box">{content.formula.expr}</div>
        <ol>
          {content.formula.explain.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ol>

        <h2>발견 경위와 수학사</h2>
        <p>{content.history}</p>

        <h2>파라미터를 극단으로 밀면</h2>
        <p>{content.extremes}</p>

        {pset.length > 0 && (
          <>
            <h2>프리셋</h2>
            <p>
              캔버스 위 버튼으로 바로 적용됩니다:{" "}
              {pset.map((pr, i) => (
                <span key={pr.name}>
                  <b>{pr.name}</b>
                  {i < pset.length - 1 ? " · " : ""}
                </span>
              ))}
              . 각 프리셋은 파라미터를 특정 조합으로 점프시킵니다.
            </p>
          </>
        )}

        <h2>같은 계열의 다른 패턴</h2>
        <div className="related-grid">
          {rel.map((r) => (
            <Link key={r.slug} href={`/pattern/${r.slug}/`} className="card">
              <Thumb slug={r.slug} />
              <div className="card-body">
                <div className="card-title">{r.name}</div>
                <div className="card-meta">{getCategory(r.category)?.label}</div>
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
          이 페이지의 그림은 브라우저에서 수식으로 실시간 계산되며, 저장한
          이미지는 자유롭게 사용할 수 있습니다. 계산 비용이 &quot;고&quot;인
          패턴은 Web Worker에서 처리해 조작 중에도 화면이 멈추지 않도록 했습니다.
        </p>
      </article>
    </main>
  );
}
