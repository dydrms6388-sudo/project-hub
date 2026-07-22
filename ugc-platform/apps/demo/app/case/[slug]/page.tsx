import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reactAction, reportAction } from "../../actions";
import { getPublishedBySlug, SITE_URL } from "../../ugc";

export const dynamic = "force-dynamic";

type Params = { slug: string };

function fields(content: unknown): { title: string; body: string } {
  const c = (content ?? {}) as { title?: string; body?: string };
  return { title: c.title ?? "제목 없음", body: c.body ?? "" };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getPublishedBySlug(slug);
  if (!item) return { title: "찾을 수 없음", robots: { index: false, follow: false } };

  const { title, body } = fields(item.content);
  return {
    title,
    description: body.slice(0, 150),
    alternates: { canonical: `${SITE_URL}${item.url}` },
    // Below the indexing bar → noindex, matching the sitemap decision.
    robots: item.indexed ? undefined : { index: false, follow: true },
    openGraph: { title, description: body.slice(0, 150), url: `${SITE_URL}${item.url}` },
  };
}

export default async function CasePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = getPublishedBySlug(slug);
  if (!item) notFound();

  const { title, body } = fields(item.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: title,
        articleBody: body,
        datePublished: item.publishedAt,
        dateModified: item.updatedAt,
        url: `${SITE_URL}${item.url}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${item.url}` },
        ],
      },
    ],
  };

  return (
    <article className="card case">
      <nav className="crumbs">
        <a href="/">홈</a> / <span>{title}</span>
      </nav>
      <h1>{title}</h1>
      <div className="meta">
        <span>공개 {item.publishedAt.slice(0, 10)}</span>
        <span className="badge">score {item.contentScore}</span>
        {item.indexed ? (
          <span className="badge badge-ok">indexed</span>
        ) : (
          <span className="badge badge-warn">noindex</span>
        )}
      </div>
      <div className="body">
        {body.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      <div className="engage-bar">
        <form action={reactAction}>
          <input type="hidden" name="contentId" value={item.id} />
          <button type="submit" className="btn-react">
            👍 공감 {item.reactions > 0 ? item.reactions : ""}
          </button>
        </form>
        <form action={reportAction} className="report-form">
          <input type="hidden" name="contentId" value={item.id} />
          <input name="reason" placeholder="신고 사유" required maxLength={200} />
          <button type="submit" className="btn-report">
            🚩 신고
          </button>
        </form>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
}
