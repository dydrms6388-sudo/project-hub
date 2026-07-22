import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoteCard from "@/components/VoteCard";
import { CATEGORIES, getCategory, getHub, getSeedsByCategory } from "@/lib/surveys";
import { breadcrumbLd, faqLd, ldJson, abs } from "@/lib/jsonld";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hub = getHub(slug);
  const cat = getCategory(slug);
  if (!hub || !cat) return {};
  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: { canonical: abs(`/c/${cat.slug}`) },
    openGraph: {
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: abs(`/c/${cat.slug}`),
    },
  };
}

export default async function CategoryHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = getCategory(slug);
  const hub = getHub(slug);
  if (!cat || !hub) notFound();

  const seeds = getSeedsByCategory(cat.slug);
  const introParas = hub.intro.split("\n\n");

  const ld = ldJson(
    breadcrumbLd([
      { name: "홈", path: "/" },
      { name: cat.name, path: `/c/${cat.slug}` },
    ]),
    faqLd(hub.faq),
  );

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />

      <nav className="text-xs text-ink/40">
        <Link href="/" className="hover:text-ink/70">
          홈
        </Link>
        <span className="mx-1">/</span>
        <span className="text-ink/60">{cat.name}</span>
      </nav>

      <header>
        <div className="mb-1 text-3xl" aria-hidden="true">
          {cat.emoji}
        </div>
        <h1 className="text-2xl font-extrabold text-ink">{hub.h1}</h1>
      </header>

      {/* 설문 카드 — 1탭 참여 (B2) */}
      <section className="space-y-6">
        {seeds.map((s) => (
          <article key={s.slug} className="rounded-2xl border border-black/5 bg-white/60 p-4">
            <h2 className="mb-2 text-base font-bold text-ink">
              <Link href={`/q/${s.slug}`} className="hover:text-brand">
                {s.title}
              </Link>
            </h2>
            <p className="mb-3 text-sm leading-relaxed text-ink/60">{s.body}</p>
            <VoteCard slug={s.slug} options={s.options} />
          </article>
        ))}
      </section>

      <div className="ad-slot" aria-hidden="true">
        광고 영역 (승인 후 노출)
      </div>

      {/* 편집 콘텐츠 (고유 본문) */}
      <section className="prose-sm">
        <h2 className="mb-3 text-lg font-bold text-ink">이 카테고리 이야기</h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-ink/80">
          {introParas.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">자주 묻는 질문</h2>
        <dl className="space-y-4">
          {hub.faq.map((f, i) => (
            <div key={i} className="rounded-xl border border-black/5 bg-white p-4">
              <dt className="text-sm font-semibold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink/70">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
