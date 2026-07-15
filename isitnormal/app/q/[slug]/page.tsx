import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import VoteCard from "@/components/VoteCard";
import { getSurveyBySlug, getCategory, getRelated, ALL_SURVEYS } from "@/lib/surveys";
import { UGC_DISCLAIMER } from "@/site.config";
import { breadcrumbLd, ldJson, abs } from "@/lib/jsonld";

export function generateStaticParams() {
  return ALL_SURVEYS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = getSurveyBySlug(slug);
  if (!s) return {};
  const desc = s.body.slice(0, 150);
  return {
    title: s.title,
    description: desc,
    alternates: { canonical: abs(`/q/${s.slug}`) },
    // v1: 미승격 UGC/시드는 noindex. 실제 투표 n>=30 + 7일 경과 후 승격 잡이 index로 전환한다.
    robots: { index: false, follow: true },
    openGraph: { title: s.title, description: desc, url: abs(`/q/${s.slug}`) },
  };
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getSurveyBySlug(slug);
  if (!s) notFound();
  const cat = getCategory(s.categorySlug)!;
  const related = getRelated(s.slug);

  const ld = ldJson(
    breadcrumbLd([
      { name: "홈", path: "/" },
      { name: cat.name, path: `/c/${cat.slug}` },
      { name: s.title, path: `/q/${s.slug}` },
    ]),
  );

  return (
    <div className="space-y-7">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />

      <nav className="text-xs text-ink/40">
        <Link href="/" className="hover:text-ink/70">
          홈
        </Link>
        <span className="mx-1">/</span>
        <Link href={`/c/${cat.slug}`} className="hover:text-ink/70">
          {cat.name}
        </Link>
      </nav>

      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
          {cat.emoji} {cat.name}
        </span>
        <h1 className="mt-3 text-xl font-extrabold leading-snug text-ink">{s.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{s.body}</p>
        <p className="mt-2 text-xs text-ink/40">작성 · @운영자</p>
      </header>

      <VoteCard slug={s.slug} options={s.options} />

      {/* 편집자 해설 (색인 3층 중 3층 · 고유 텍스트) */}
      <section className="rounded-2xl bg-white p-5">
        <h2 className="mb-2 text-sm font-bold text-brand">편집자 해설</h2>
        <p className="text-[15px] leading-relaxed text-ink/80">{s.editorCommentary}</p>
      </section>

      <div className="ad-slot" aria-hidden="true">
        광고 영역 (승인 후 노출)
      </div>

      {/* 관련 항목 5개 */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-ink">관련 설문</h2>
          <ul className="space-y-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/q/${r.slug}`}
                  className="block rounded-xl border border-black/5 bg-white px-4 py-3 text-sm font-medium text-ink transition hover:border-brand"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-black/5 pt-4">
        <p className="text-xs leading-relaxed text-ink/40">{UGC_DISCLAIMER}</p>
        <Link
          href={`/report?slug=${s.slug}`}
          className="mt-2 inline-block text-xs text-ink/40 underline underline-offset-2 hover:text-ink/60"
        >
          이 설문 신고하기
        </Link>
      </div>
    </div>
  );
}
