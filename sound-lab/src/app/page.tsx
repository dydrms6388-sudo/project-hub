import Link from "next/link";
import { byCategory, categories, sounds } from "@/lib/sounds";

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>소리를 만지면서 배우는 실험실</h1>
        <p className="lead">
          {sounds.length}가지 소리 현상 — 착청, 심리음향, 공간 지각, 합성,
          신호처리 — 을 슬라이더로 직접 조작하며 귀로 확인합니다. 모든 소리는
          음원 파일 없이 브라우저에서 실시간 합성됩니다.
        </p>
      </section>
      {categories.map((c) => {
        const items = byCategory(c.slug);
        return (
          <section key={c.slug}>
            <h2 className="section-title">
              <Link href={`/category/${c.slug}/`}>{c.label}</Link>{" "}
              <small>({items.length})</small>
            </h2>
            <p className="section-sub">{c.description}</p>
            <ul className="card-grid">
              {items.map((s) => (
                <li key={s.slug} className="card">
                  <Link href={`/sound/${s.slug}/`}>{s.name}</Link>
                  <p>{s.principle.split(". ")[0].slice(0, 90)}…</p>
                  <span className="meta">
                    {s.needsHeadphones && (
                      <span className="badge badge-phones">🎧 이어폰</span>
                    )}
                    {s.hearingRisk === "주의" && (
                      <span className="badge badge-risk">청력 주의</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
