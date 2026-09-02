import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byCategory, categories, getCategory } from "@/lib/experiments";
import Thumb from "@/components/Thumb";

interface Props { params: Promise<{ cat: string }>; }

const catIntro: Record<string, string> = {
  oscillation:
    "진동은 물리의 기본 언어다. 되돌아오려는 복원력과 관성이 균형을 이루면 계는 흔들리고, 여러 진동자가 결합하면 정규모드와 맥놀이가 나타난다. 이 분류는 단진자의 비선형성부터 공명, 파라메트릭 진동, 비선형 사슬의 에너지 회귀까지 되풀이하는 운동의 다양한 얼굴을 담는다.",
  chaos:
    "결정론적 방정식이 예측 불가능을 낳는다는 역설이 카오스다. 초기조건의 미세한 차이가 지수적으로 증폭되어 장기 예측이 불가능해진다. 이 분류의 모든 실험은 쌍둥이 비교 기능으로, 거의 같은 두 초기조건이 어떻게 갈라지는지 — 나비 효과를 — 직접 눈으로 보여 준다.",
  gravity:
    "1/r²에 비례하는 중력은 행성을 타원 궤도에 붙잡고, 세 물체가 되면 풀 수 없는 카오스를 만든다. 이 분류는 케플러 궤도와 러더퍼드 산란, 삼체 문제와 N체 성단, 그리고 뉴턴을 넘어서는 상대론적 세차까지 중력이 그리는 궤도를 탐구한다.",
  mechanics:
    "힘과 운동량, 충돌과 회전은 고전 역학의 뼈대다. 이 분류는 공기 저항 발사체, 로켓 방정식, π를 세는 충돌, 코리올리 힘, 팽이의 세차처럼 일상과 공학에서 마주치는 역학 현상을 실제 방정식으로 시뮬레이션한다.",
  wave:
    "파동은 매질을 통해 에너지를 나른다. 줄과 수면과 기체를 통해 퍼지고 반사되고 간섭하며, 확산은 무작위 걸음이 만드는 매끄러운 흐름이다. 이 분류는 정상파, 이중 슬릿 간섭, 도플러 효과, 확산, 현수선까지 파동과 연속체의 물리를 담는다.",
  "fluid-stat":
    "수많은 입자가 상호작용하면 개별 예측은 무의미해지고, 대신 통계적 법칙이 창발한다. 이 분류는 기체 분자 운동론의 맥스웰 분포, 소용돌이 동역학, 방사성 붕괴의 통계처럼 다체와 확률에서 나오는 거시 법칙을 보여 준다.",
  "em-quantum":
    "전자기장은 하전입자를 원과 나선으로 이끌고, 양자 세계에서 입자는 파동이 되어 넘을 수 없는 장벽을 통과한다. 이 분류는 로런츠 힘 속 하전입자, 전기장 역선, 양자 터널링으로 전자기와 양자의 근본 현상을 시각화한다.",
};

export function generateStaticParams() { return categories.map((c) => ({ cat: c.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) return {};
  return { title: `${c.label} 실험 모음 — ${byCategory(cat).length}가지 시뮬레이션`, description: catIntro[cat]?.slice(0, 120), alternates: { canonical: `/category/${cat}/` } };
}

export default async function CategoryPage({ params }: Props) {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) notFound();
  const list = byCategory(cat);
  return (
    <main className="wrap">
      <nav className="breadcrumb" aria-label="현재 위치"><Link href="/">홈</Link> › {c.label}</nav>
      <section className="hero"><h1>{c.label}</h1><p>{catIntro[cat]}</p></section>
      <section className="cat-section">
        <div className="card-grid">
          {list.map((exp) => (
            <Link key={exp.slug} href={`/experiment/${exp.slug}/`} className="card">
              <Thumb slug={exp.slug} />
              <div className="card-body">
                <div className="card-title">{exp.name}{exp.isChaotic && <span className="badge">카오스</span>}</div>
                <div className="card-meta">{exp.integrator}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
