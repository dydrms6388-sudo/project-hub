import { SubmitForm } from "./SubmitForm";
import { caseFields, listPublished, voteCounts } from "./ugc";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cases = listPublished();

  return (
    <>
      <section className="intro">
        <h1>당신의 사연, 대중의 판결 ⚖️</h1>
        <p>
          억울한 일, 애매한 갈등 — 사연과 양쪽 입장을 올리면 방문자들이 A/B로
          판결합니다. 모든 결과는 <strong>재미용</strong>이며 법률 자문이 아닙니다.
        </p>
      </section>

      <SubmitForm />

      <section className="card">
        <h2>진행 중인 사건 ({cases.length})</h2>
        {cases.length === 0 ? (
          <p className="muted">아직 공개된 사건이 없습니다. 첫 사연을 올려보세요.</p>
        ) : (
          <ul className="list">
            {cases.map((c) => {
              const f = caseFields(c);
              const v = voteCounts(c.id);
              return (
                <li key={c.id}>
                  <a href={`/case/${c.slug}`}>{f.title}</a>
                  <span className="badge">판결 {v.a + v.b}표</span>
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
