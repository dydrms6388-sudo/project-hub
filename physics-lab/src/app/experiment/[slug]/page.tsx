import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL, getCategory, getExperiment, experiments, related } from "@/lib/experiments";
import { contents } from "@/lib/content";
import { presets } from "@/lib/content/presets";
import Thumb from "@/components/Thumb";
import ExperimentStage from "@/components/ExperimentStage";

interface Props { params: Promise<{ slug: string }>; }

export function generateStaticParams() {
  return experiments.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const exp = getExperiment(slug);
  if (!exp) return {};
  return {
    title: `${exp.name} — 지배방정식으로 직접 돌리는 물리 시뮬레이션`,
    description: `${exp.name}을(를) 슬라이더로 조작하고 재생·정지하며 관찰하세요. 지배방정식: ${exp.governingEquation.split(/[—(]/)[0].trim()}. 적분기 ${exp.integrator}.`,
    alternates: { canonical: `/experiment/${slug}/` },
  };
}

export default async function ExperimentPage({ params }: Props) {
  const { slug } = await params;
  const exp = getExperiment(slug);
  const content = contents[slug];
  if (!exp || !content) notFound();
  const cat = getCategory(exp.category);
  const rel = related(slug);
  const pset = presets[slug] ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: cat?.label, item: `${SITE_URL}/category/${exp.category}/` },
        { "@type": "ListItem", position: 3, name: exp.name, item: `${SITE_URL}/experiment/${exp.slug}/` },
      ] },
      { "@type": "FAQPage", mainEntity: content.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      { "@type": "Article", headline: `${exp.name} — 인터랙티브 시뮬레이션과 물리 해설`, about: exp.governingEquation, inLanguage: "ko", author: { "@type": "Organization", name: SITE_NAME }, mainEntityOfPage: `${SITE_URL}/experiment/${exp.slug}/` },
    ],
  };

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link> › <Link href={`/category/${exp.category}/`}>{cat?.label}</Link> › {exp.name}
      </nav>
      <header className="illusion-head">
        <h1>{exp.name}</h1>
        <div className="meta-tags">
          <span className="tag">{cat?.label}</span>
          <span className="tag integ">적분기 {exp.integrator}</span>
          {exp.isChaotic && <span className="tag chaos">카오스</span>}
          {exp.computeCost === "고" && <span className="tag">고비용</span>}
        </div>
      </header>

      <ExperimentStage experiment={exp} presets={pset} />

      <article className="body">
        <p>{content.intro}</p>

        <h2>지배방정식과 각 항의 역할</h2>
        <div className="eq-box">{content.equation.expr}</div>
        <ol>{content.equation.terms.map((t, i) => <li key={i}>{t}</li>)}</ol>

        <h2>무엇을 보게 되는가</h2>
        <ol>{content.observe.map((o, i) => <li key={i}>{o}</li>)}</ol>

        <h2>파라미터를 극단으로 밀면</h2>
        <p>{content.extremes}</p>

        <h2>실제 세계의 대응</h2>
        <p>{content.realWorld}</p>

        <h2>발견 경위와 연구사</h2>
        <p>{content.history}</p>

        {pset.length > 0 && (
          <>
            <h2>프리셋</h2>
            <p>캔버스 위 버튼으로 적용됩니다: {pset.map((pr, i) => <span key={pr.name}><b>{pr.name}</b>{i < pset.length - 1 ? " · " : ""}</span>)}.</p>
          </>
        )}

        <h2>같은 원리의 다른 실험</h2>
        <div className="related-grid">
          {rel.map((r) => (
            <Link key={r.slug} href={`/experiment/${r.slug}/`} className="card">
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
            <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </div>

        <p className="disclaimer">
          이 시뮬레이션은 교육 목적의 물리 모형입니다. 계산은 고정 타임스텝의 RK4·심플렉틱·벨레 적분기로 이뤄지며(오일러법 미사용), 발산이 감지되면 자동으로 정지합니다. 마찰·소각·차원 축소 등 각 항목의 근사와 가정은 본문에 명시했습니다.
        </p>
      </article>
    </main>
  );
}
