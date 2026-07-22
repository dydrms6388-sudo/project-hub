import { SubmitForm } from "./SubmitForm";
import { listPublished } from "./ugc";

// Reads live store state on each request.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const published = listPublished();

  return (
    <>
      <section className="intro">
        <h1>UGC 파이프라인 데모</h1>
        <p>
          아래 폼으로 글을 제출하면 <code>@ggu/ugc-core</code> 가 검증 → 자동검수 →
          공개/검수대기/차단 을 결정합니다. 공개된 글만 사이트맵에 색인됩니다.
        </p>
      </section>

      <SubmitForm />

      <section className="card">
        <h2>공개된 글 ({published.length})</h2>
        {published.length === 0 ? (
          <p className="muted">아직 공개된 글이 없습니다. 위에서 첫 글을 작성해 보세요.</p>
        ) : (
          <ul className="list">
            {published.map((c) => {
              const title = String((c.content as { title?: string }).title ?? c.slug);
              return (
                <li key={c.id}>
                  <a href={`/case/${c.slug}`}>{title}</a>
                  <span className="badge">score {c.contentScore}</span>
                  {c.indexed ? (
                    <span className="badge badge-ok">indexed</span>
                  ) : (
                    <span className="badge badge-warn">noindex</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
