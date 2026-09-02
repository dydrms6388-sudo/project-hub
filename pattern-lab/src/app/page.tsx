import Link from "next/link";
import { byCategory, categories, patterns } from "@/lib/patterns";
import Thumb from "@/components/Thumb";

const catDesc: Record<string, string> = {
  curves: "두 진동이나 구르는 원이 만드는 매끄러운 궤적 곡선.",
  spirals: "황금각·로그·소수가 만드는 나선과 성장 배치.",
  fractals: "반복과 재귀가 만드는 무한히 깊은 자기닮음 구조.",
  tilings: "평면을 채우는 주기·비주기 타일과 공간 분할.",
  fields: "파동·노이즈·정상파가 만드는 연속 장 무늬.",
  chaos: "초기값과 매개변수에 민감한 동역학 끌개.",
  automata: "단순 규칙의 반복이 낳는 창발적 무늬.",
  "number-theory": "소수와 조합이 드러내는 정수론적 구조.",
};

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>수학 패턴 연구소 — 수식을 슬라이더로 조작하기</h1>
        <p>
          리사주 곡선부터 반응확산까지, 수학이 만드는 패턴 {patterns.length}가지를
          모았습니다. 모든 그림은 이미지가 아니라 브라우저에서 실시간 계산되며,
          파라미터를 바꾸면 즉시 반영되고 PNG(고해상도 2048px)·SVG로 내려받을 수
          있습니다. 현재 설정은 주소창에 담겨, 링크만 공유하면 같은 그림이
          재현됩니다.
        </p>
      </section>
      {categories.map((cat) => (
        <section key={cat.slug} className="cat-section">
          <h2>
            <Link href={`/category/${cat.slug}/`}>{cat.label}</Link>
          </h2>
          <p className="cat-desc">{catDesc[cat.slug]}</p>
          <div className="card-grid">
            {byCategory(cat.slug).map((pat) => (
              <Link key={pat.slug} href={`/pattern/${pat.slug}/`} className="card">
                <Thumb slug={pat.slug} />
                <div className="card-body">
                  <div className="card-title">
                    {pat.name}
                    {pat.renderCost === "고" && <span className="badge">고비용</span>}
                  </div>
                  <div className="card-meta">
                    {pat.discoveredBy.split("(")[0].split("·")[0].trim()} · {pat.year}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
