import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reportAction, voteAction } from "../../actions";
import { caseFields, getPublishedBySlug, SITE_URL, voteCounts } from "../../ugc";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getPublishedBySlug(slug);
  if (!item) return { title: "사건을 찾을 수 없음", robots: { index: false, follow: false } };

  const f = caseFields(item);
  const description = f.situation.slice(0, 150);
  return {
    title: f.title,
    description,
    alternates: { canonical: `${SITE_URL}${item.url}` },
    robots: item.indexed ? undefined : { index: false, follow: true },
    openGraph: { title: `${f.title} — 판결소`, description, url: `${SITE_URL}${item.url}` },
  };
}

export default async function CasePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = getPublishedBySlug(slug);
  if (!item) notFound();

  const f = caseFields(item);
  const v = voteCounts(item.id);
  const total = v.a + v.b;
  const pa = total ? Math.round((v.a / total) * 100) : 50;
  const pb = total ? 100 - pa : 50;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: f.title,
        articleBody: f.situation,
        datePublished: item.publishedAt,
        dateModified: item.updatedAt,
        url: `${SITE_URL}${item.url}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "판결소", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: f.title, item: `${SITE_URL}${item.url}` },
        ],
      },
    ],
  };

  return (
    <article className="card case">
      <nav className="crumbs">
        <a href="/">판결소</a> / <span>{f.title}</span>
      </nav>
      <h1>{f.title}</h1>
      <div className="meta">
        <span>공개 {item.publishedAt.slice(0, 10)}</span>
        <span className="badge">판결 {total}표</span>
        {item.indexed ? (
          <span className="badge badge-ok">indexed</span>
        ) : (
          <span className="badge badge-warn">noindex</span>
        )}
      </div>

      <div className="body">
        {f.situation.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      <section className="verdict">
        <h2>당신의 판결은?</h2>
        <div className="claims">
          <div className="claim claim-a">
            <div className="who">A 입장</div>
            <p>{f.sideA}</p>
            <form action={voteAction}>
              <input type="hidden" name="contentId" value={item.id} />
              <input type="hidden" name="side" value="A" />
              <button type="submit" className="btn-vote-a">A가 맞다</button>
            </form>
          </div>
          <div className="claim claim-b">
            <div className="who">B 입장</div>
            <p>{f.sideB}</p>
            <form action={voteAction}>
              <input type="hidden" name="contentId" value={item.id} />
              <input type="hidden" name="side" value="B" />
              <button type="submit" className="btn-vote-b">B가 맞다</button>
            </form>
          </div>
        </div>

        <div className="tally">
          <div className="tally-bar">
            <div className="tally-a" style={{ width: `${pa}%` }} />
            <div className="tally-b" style={{ width: `${pb}%` }} />
          </div>
          <div className="tally-legend">
            <span>A {pa}% ({v.a}표)</span>
            <span>B {pb}% ({v.b}표)</span>
          </div>
        </div>

        <p className="notice">
          이 판결은 방문자 투표로 만들어진 <strong>재미용 결과</strong>입니다.
          법률·의료·금융 자문이 아니며, 실제 분쟁은 전문가와 상담하세요.
          투표는 사연당 1회만 반영됩니다.
        </p>
      </section>

      <div className="engage-bar">
        <form action={reportAction} className="report-form">
          <input type="hidden" name="contentId" value={item.id} />
          <input name="reason" placeholder="신고 사유" required maxLength={200} />
          <button type="submit" className="btn-report">🚩 신고</button>
        </form>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
}
