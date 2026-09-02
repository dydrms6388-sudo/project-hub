import Link from "next/link";
import type { Metadata } from "next";
import {
  CALCULATORS,
  CATEGORIES,
  CATEGORY_KEYS,
  GUIDES,
  calcsInCategory,
  guidesInCategory,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "PhotoLab — 사진 촬영 계산 레퍼런스",
  description:
    "착란원부터 NPF 법칙, 태양 고도각까지. 공식과 출처를 밝히고 검증 케이스로 대조한 사진 계산기 18종과 광학 해설 27편.",
};

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>
          감이 아니라 <b style={{ color: "var(--accent)" }}>계산</b>으로 찍는다
        </h1>
        <p>
          심도·노출·별·태양 — 촬영 현장의 판단을 수식으로 대신하는 계산기{" "}
          {CALCULATORS.length}종과 해설 {GUIDES.length}편. 모든 공식은 광학
          교재와 표준 문서의 출처를 함께 표기하고, 알려진 값과 대조해
          검증했습니다.
        </p>
      </section>

      {CATEGORY_KEYS.map((cat) => {
        const calcs = calcsInCategory(cat);
        const guides = guidesInCategory(cat);
        if (calcs.length + guides.length === 0) return null;
        return (
          <section key={cat} className="cat-section">
            <h2>
              <Link href={`/category/${cat}/`} style={{ color: "inherit" }}>
                {CATEGORIES[cat]}
              </Link>
            </h2>
            <div className="card-grid">
              {calcs.map((c) => (
                <Link key={c.slug} href={`/calc/${c.slug}/`} className="card">
                  <div className="card-name">
                    {c.name}
                    <span className="badge">계산기</span>
                  </div>
                  <div className="card-desc">{c.formula.split(";")[0]}</div>
                </Link>
              ))}
              {guides.map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}/`} className="card">
                  <div className="card-name">
                    {g.name}
                    <span className="badge">해설</span>
                  </div>
                  <div className="card-desc">{g.topic.slice(0, 64)}…</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <div className="notice">
        입력값은 URL에만 인코딩됩니다 — 링크를 저장하면 장비 설정이 그대로
        복원됩니다. 서버 전송·쿠키·로컬 저장소를 쓰지 않습니다.
      </div>
    </>
  );
}
