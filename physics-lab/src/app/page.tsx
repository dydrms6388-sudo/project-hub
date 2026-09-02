import Link from "next/link";
import { byCategory, categories, experiments } from "@/lib/experiments";
import Thumb from "@/components/Thumb";

const catDesc: Record<string, string> = {
  oscillation: "진자·용수철·공명 — 되풀이하는 운동과 그 결합.",
  chaos: "초기값과 매개변수에 극도로 민감한 결정론적 카오스.",
  gravity: "역제곱 중력이 만드는 궤도와 다체 문제.",
  mechanics: "충돌·발사·회전 — 힘과 운동량의 고전 역학.",
  wave: "줄·수면·기체를 통해 퍼지는 파동과 확산.",
  "fluid-stat": "다체 상호작용과 통계에서 창발하는 거시 법칙.",
  "em-quantum": "전자기장 속 하전입자와 양자 파동함수.",
};

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1>물리 실험실 — 방정식을 손으로 만지기</h1>
        <p>
          단진자부터 양자 터널링까지, 물리 현상 {experiments.length}가지를 실시간
          시뮬레이션으로 모았습니다. 초기조건을 슬라이더로 바꾸고 재생·정지하며,
          카오스는 쌍둥이 비교로 나비 효과를, 보존계는 에너지 드리프트로 적분
          정확도를 확인할 수 있습니다. 모든 계산은 오일러법이 아닌 RK4·심플렉틱
          적분기로 이뤄지며, 현재 설정은 링크로 공유됩니다.
        </p>
      </section>
      {categories.map((cat) => (
        <section key={cat.slug} className="cat-section">
          <h2><Link href={`/category/${cat.slug}/`}>{cat.label}</Link></h2>
          <p className="cat-desc">{catDesc[cat.slug]}</p>
          <div className="card-grid">
            {byCategory(cat.slug).map((exp) => (
              <Link key={exp.slug} href={`/experiment/${exp.slug}/`} className="card">
                <Thumb slug={exp.slug} />
                <div className="card-body">
                  <div className="card-title">
                    {exp.name}
                    {exp.isChaotic && <span className="badge">카오스</span>}
                  </div>
                  <div className="card-meta">{exp.integrator} · {exp.computeCost === "고" ? "고비용" : exp.governingEquation.split(/[—(]/)[0].trim().slice(0, 22)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
