import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byCategory, categories, getCategory } from "@/lib/illusions";
import { FigureSvg } from "@/lib/figures";

interface Props {
  params: Promise<{ cat: string }>;
}

const catIntro: Record<string, string> = {
  "geometry-size":
    "길이와 크기의 지각은 자로 재듯 절대적으로 이루어지지 않습니다. 화살깃, 수렴선, 이웃 도형 같은 맥락이 개입하는 순간 같은 선분과 같은 원이 다르게 보입니다. 이 분류의 도형들은 19세기 심리물리학이 발견한 크기 왜곡의 표준 사례들로, 각 페이지에서 왜곡을 만드는 매개변수를 직접 조작할 수 있습니다.",
  "geometry-angle":
    "짧은 빗금 몇 개, 방사선 한 다발이 완전한 평행선을 기울이고 곧은 직선을 휘게 만듭니다. 원인은 대부분 시각 피질이 교차 각도를 실제보다 벌려 읽는 예각 과대평가에 있습니다. 죌너에서 프레이저 나선까지, 같은 뿌리에서 갈라진 왜곡의 변주를 비교해 보세요.",
  brightness:
    "화면의 픽셀 값과 지각되는 밝기는 다른 것입니다. 배경이 바뀌면 같은 회색이 두 색이 되고, 경계의 좁은 굴곡 하나가 넓은 면 전체의 밝기를 바꿉니다. 측면억제라는 망막 회로에서 밝기 항등성이라는 장면 해석까지, 밝기 처리의 여러 층을 도형별로 체험할 수 있습니다.",
  "color-contour":
    "그려지지 않은 삼각형이 떠오르고, 선에만 있는 색이 면 전체를 물들입니다. 윤곽 보완과 색 동화는 시각 시스템이 불완전한 입력을 적극적으로 완성한다는 증거입니다. 각 페이지의 속임수 벗기기는 화면에 실제로 존재하는 것과 지각되는 것의 차이를 표본으로 보여 줍니다.",
  fading:
    "시선을 고정하는 것만으로 주변의 사물이 사라지고, 망막의 구멍은 평생 의식되지 않습니다. 변화 없는 신호를 버리는 적응과 빈자리를 메우는 채움은 시각의 기본 유지 보수 작동입니다. 두 체험 모두 자신의 눈으로 직접 확인하는 데 1분이 걸리지 않습니다.",
  motion:
    "움직임 지각은 카메라 기록이 아니라 계산 결과입니다. 정지 화면이 흐르고, 점멸이 이동이 되고, 창의 모양이 방향을 바꿉니다. 이 분류의 체험은 모두 움직임을 포함하므로 시작 전에 경고가 표시되며, 언제든 정지할 수 있고 깜빡임은 초당 3회 미만으로 제한됩니다.",
  ambiguous:
    "하나의 그림이 두 개의 세계를 오갑니다. 네커 정육면체의 깊이 반전에서 펜로즈 삼각형의 불가능한 조립까지, 이 분류는 시각이 단일 정답이 아니라 가설 선택으로 작동한다는 것을 보여 줍니다. 반전을 스스로 통제하는 요령도 각 페이지에 정리되어 있습니다.",
};

export function generateStaticParams() {
  return categories.map((c) => ({ cat: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) return {};
  return {
    title: `${c.label} 착시 모음 — ${byCategory(cat).length}가지 인터랙티브 체험`,
    description: catIntro[cat]?.slice(0, 120),
    alternates: { canonical: `/category/${cat}/` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) notFound();
  const list = byCategory(cat);
  return (
    <main className="wrap">
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link> › {c.label}
      </nav>
      <section className="hero">
        <h1>{c.label}</h1>
        <p>{catIntro[cat]}</p>
      </section>
      <section className="cat-section">
        <div className="card-grid">
          {list.map((ill) => (
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
    </main>
  );
}
