import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SITE_NAME,
  SITE_URL,
  getCategory,
  getSound,
  related,
  sounds,
} from "@/lib/sounds";
import { contents } from "@/lib/content";
import SoundLab from "@/components/SoundLab";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return sounds.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getSound(slug);
  if (!s) return {};
  return {
    title: `${s.name} — 직접 합성해 듣는 소리 실험`,
    description: `${s.principle} 슬라이더 ${s.params.length}개로 실시간 조작하며 파형·스펙트럼을 눈으로 확인하는 무료 인터랙티브 실험.`,
    alternates: { canonical: `/sound/${slug}/` },
  };
}

export default async function SoundPage({ params }: Props) {
  const { slug } = await params;
  const s = getSound(slug);
  const content = contents[slug];
  if (!s || !content) notFound();
  const cat = getCategory(s.category);
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
            name: cat?.name,
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
      {
        "@type": "FAQPage",
        mainEntity: content.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "SoftwareApplication",
        name: `${s.name} 실험기`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
        inLanguage: "ko",
        url: `${SITE_URL}/sound/${s.slug}/`,
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
        <Link href={`/category/${s.category}/`}>{cat?.name}</Link> › {s.name}
      </nav>
      <header className="sound-head">
        <h1>{s.name}</h1>
        <p className="meta">
          {cat?.name} · 합성 방식: {s.synthesis}
          {s.needsHeadphones && " · 🎧 이어폰 필수"}
          {s.hearingRisk === "주의" && " · ⚠️ 청취 주의"}
        </p>
      </header>

      <SoundLab sound={s} presets={content.presets} />

      <article className="body">
        <p>{content.intro}</p>

        <div className="fact-box">
          <dl>
            <dt>핵심 원리</dt>
            <dd>{s.principle}</dd>
            <dt>분류</dt>
            <dd>{cat?.name}</dd>
            <dt>청취 환경</dt>
            <dd>
              {s.needsHeadphones
                ? "이어폰 필수 — 좌우 채널이 분리되어야 현상이 성립한다"
                : "스피커·이어폰 모두 가능"}
            </dd>
          </dl>
        </div>

        <h2>무엇이 들리는가</h2>
        <p>{content.hear}</p>

        <h2>실제 신호는 무엇인가</h2>
        <p>{content.signal}</p>

        <h2>왜 그렇게 들리는가 — 청각 처리의 단계</h2>
        <ol>
          {content.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>

        <h2>발견 경위와 연구사</h2>
        <p>{content.history}</p>

        <h2>같은 원리의 다른 실험</h2>
        <div className="related-grid">
          {rel.map((r) => (
            <Link key={r.slug} href={`/sound/${r.slug}/`} className="card">
              <div className="card-body">
                <div className="card-title">{r.name}</div>
                <div className="card-meta">{r.principle.slice(0, 44)}…</div>
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
          이 페이지의 체험과 해설은 교육·재미 목적이며, 청력에 대한 의학적
          검사나 진단을 대신하지 않습니다. 들리는 정도는 나이·청력·재생
          장비(이어폰, 스피커, 기기 볼륨)에 따라 크게 다르며, 브라우저 합성은
          학술 실험 환경의 근사입니다. 귀에 불편이 느껴지면 즉시 정지하고,
          청력 이상이 의심되면 이비인후과 진료를 받으세요.
        </p>
      </article>
    </main>
  );
}
