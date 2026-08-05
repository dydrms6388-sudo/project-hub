import Link from "next/link";
import { byCategory, categories, illusions } from "@/lib/illusions";
import { FigureSvg } from "@/lib/figures";

const catDesc: Record<string, string> = {
  "geometry-size":
    "같은 길이·같은 크기가 주변 맥락 때문에 달라 보이는 고전 도형들.",
  "geometry-angle":
    "평행선이 기울고 직선이 휘어 보이는 방향·각도 왜곡 계열.",
  brightness: "같은 회색이 배경과 경계에 따라 딴 색이 되는 밝기 착시.",
  "color-contour": "없는 윤곽이 생기고 색이 경계를 넘어 번지는 현상.",
  fading: "응시만으로 사물이 사라지고, 뇌가 빈자리를 메우는 체험.",
  motion: "정지 화면이 움직이고, 움직임의 방향이 뒤바뀌는 운동 착시.",
  ambiguous: "하나의 그림에 두 해석이 공존하는 다의도형과 불가능도형.",
};

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>착시 실험실 — 눈이 계산하는 방식을 직접 조작해 보기</h1>
        <p>
          1804년의 트록슬러 소실부터 1995년의 체커 그림자까지, 시각 과학이
          검증해 온 표준 착시 {illusions.length}가지를 모았습니다. 모든 도형은
          이미지가 아니라 실시간 렌더링이며, 슬라이더로 착시를 키우고 없애고,
          속임수 벗기기로 실제 값을 확인할 수 있습니다.
        </p>
      </section>
      {categories.map((cat) => (
        <section key={cat.slug} className="cat-section">
          <h2>
            <Link href={`/category/${cat.slug}/`}>{cat.label}</Link>
          </h2>
          <p className="cat-desc">{catDesc[cat.slug]}</p>
          <div className="card-grid">
            {byCategory(cat.slug).map((ill) => (
              <Link
                key={ill.slug}
                href={`/illusion/${ill.slug}/`}
                className="card"
              >
                <FigureSvg slug={ill.slug} />
                <div className="card-body">
                  <div className="card-title">
                    {ill.name}
                    {ill.motionWarning && <span className="badge">움직임</span>}
                  </div>
                  <div className="card-meta">
                    {ill.discoveredBy.split("(")[0].split("·")[0].trim()} ·{" "}
                    {ill.year}
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
