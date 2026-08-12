import Link from "next/link";
import { COLORS, FAMILIES, THEORIES, TOOLS } from "@/lib/data";

export default function Home() {
  return (
    <main>
      <h1>만지면서 배우는 색</h1>
      <p>
        색채 실험실은 색상 하나하나의 정보와 배색 도구를 모은 사이트입니다.
        모든 페이지는 읽는 것이 아니라 만지는 것을 목표로 합니다 — 슬라이더를
        움직이면 색이 즉시 바뀌고, 대비비와 색각 이상 시뮬레이션까지 그 자리에서
        다시 계산됩니다. 조정한 색은 URL에 담기므로 링크만 공유하면 같은 화면이
        재현됩니다.
      </p>

      <h2 id="colors">색상 도감</h2>
      <p className="muted">
        30가지 색의 유래·코드값·배색·접근성을 한 페이지씩 정리했습니다.
      </p>
      {Object.entries(FAMILIES).map(([cat, fam]) => {
        const list = COLORS.filter((c) => c.family === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} style={{ marginTop: 18 }}>
            <h3>
              <Link
                href={`/family/${cat}/`}
                style={{ textDecoration: "none" }}
              >
                {fam.nameKo} →
              </Link>
            </h3>
            <ul className="swatch-grid">
              {list.map((c) => (
                <li key={c.slug}>
                  <Link href={`/color/${c.slug}/`} className="swatch-card">
                    <div className="chip" style={{ background: c.hex }} />
                    <div className="meta">
                      <div>{c.nameKo}</div>
                      <div className="hex">{c.hex}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2 id="tools">배색 도구</h2>
      <p className="muted">
        브라우저 안에서만 동작하는 9가지 계산 도구. 입력값은 어디에도 전송되지
        않습니다.
      </p>
      <ul className="list-links">
        {TOOLS.map((t) => (
          <li key={t.slug}>
            <Link href={`/tool/${t.slug}/`}>
              <span className="t">{t.name}</span>
              <span className="d" style={{ display: "block" }}>
                {t.computation.split(" — ")[0].slice(0, 46)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 id="theory">색 이론</h2>
      <p className="muted">
        배색이 왜 통하는지, 색공간이 왜 여러 개인지 — 데모와 함께 읽는 이론.
      </p>
      <ul className="list-links">
        {THEORIES.map((t) => (
          <li key={t.slug}>
            <Link href={`/theory/${t.slug}/`}>
              <span className="t">{t.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
