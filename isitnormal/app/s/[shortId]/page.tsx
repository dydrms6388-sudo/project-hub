import type { Metadata } from "next";
import Link from "next/link";
import { resolveShortLink } from "@/lib/shortlink";
import { getSurveyBySlug } from "@/lib/surveys";
import { getStatsBySlug } from "@/lib/stats";
import { buildCard } from "@/lib/card";
import CardPreview from "@/components/CardPreview";
import ShareLanding from "@/components/ShareLanding";
import { SITE_URL } from "@/site.config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const link = await resolveShortLink(shortId);
  // U1: /s/ 는 전면 noindex. OG 태그만 살린다(U2).
  if (!link) return { title: "만료된 링크", robots: { index: false, follow: false } };
  const survey = getSurveyBySlug(link.slug);
  const stats = await getStatsBySlug(link.slug);
  const card = buildCard(survey?.title ?? "정상인가요", stats, link.optKey);
  return {
    title: card.headline,
    description: `${card.subline} — 나도 투표하고 확인해보세요.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: card.headline,
      description: card.subline,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: card.headline, description: card.subline },
  };
}

function Expired() {
  return (
    <div className="py-20 text-center">
      <p className="text-4xl">⌛</p>
      <h1 className="mt-4 text-lg font-bold text-ink">만료되었거나 없는 링크예요</h1>
      <p className="mt-2 text-sm text-ink/60">공유 링크는 90일이 지나면 사라져요.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        정상인가요 둘러보기
      </Link>
    </div>
  );
}

export default async function ShareLandingPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const link = await resolveShortLink(shortId);
  if (!link) return <Expired />;
  const survey = getSurveyBySlug(link.slug);
  if (!survey) return <Expired />;

  const stats = await getStatsBySlug(link.slug);
  const card = buildCard(survey.title, stats, link.optKey);
  const shortUrl = `${SITE_URL.replace(/^https?:\/\//, "")}/s/${shortId}`;

  return (
    <div className="space-y-6 py-4">
      <p className="text-center text-sm text-ink/60">누군가 이 질문에서 당신 생각을 궁금해해요 👀</p>
      <CardPreview card={card} shortUrl={shortUrl} />
      <div className="rounded-xl bg-white p-4 text-center text-sm text-ink/70">{survey.title}</div>
      {/* U3: 결과 미리보기 → 나도 투표하기 CTA → 색인된 본 페이지 */}
      <ShareLanding slug={link.slug} />
    </div>
  );
}
