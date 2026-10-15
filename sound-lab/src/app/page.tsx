import Link from "next/link";
import { byCategory, categories, sounds } from "@/lib/sounds";

export default function HubPage() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>
          소리를 눈으로 보고 손으로 만지는
          <br />
          인터랙티브 소리 실험실
        </h1>
        <p>
          {sounds.length}가지 청각 현상과 합성 원리를 브라우저가 실시간으로
          만들어 들려준다. 슬라이더를 움직이면 소리가 즉시 변하고, 파형과
          스펙트럼이 함께 그려진다. 음원 파일 없이 Web Audio API만 사용하며,
          모든 실험은 재생 버튼을 눌러야 시작된다.
        </p>
      </section>
      {categories.map((c) => (
        <section key={c.slug} className="cat-section">
          <h2>
            <Link href={`/category/${c.slug}/`}>{c.name}</Link>
          </h2>
          <p>{c.desc}</p>
          <div className="card-grid">
            {byCategory(c.slug).map((s) => (
              <Link key={s.slug} href={`/sound/${s.slug}/`} className="card">
                <div className="card-title">
                  {s.name}
                  {s.needsHeadphones && (
                    <span className="hp-mark" title="이어폰 필수">
                      🎧
                    </span>
                  )}
                </div>
                <div className="card-meta">{s.principle.slice(0, 46)}…</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
