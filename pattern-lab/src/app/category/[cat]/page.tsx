import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byCategory, categories, getCategory } from "@/lib/patterns";
import Thumb from "@/components/Thumb";

interface Props {
  params: Promise<{ cat: string }>;
}

const catIntro: Record<string, string> = {
  curves:
    "곡선은 점의 자취다. 두 방향의 진동을 합치거나, 원 위를 구르는 점을 따라가거나, 극좌표에서 반지름을 각도의 함수로 정의하면 매끄러운 궤적이 나온다. 이 분류의 패턴들은 삼각함수 몇 개로 리사주·장미·트로코이드 같은 고전 곡선을 그리며, 대부분 벡터라 SVG로 내려받아 무한히 확대할 수 있다.",
  spirals:
    "나선과 성장 배치는 자연이 공간을 효율적으로 채우는 방식을 담는다. 황금각으로 씨앗을 놓으면 해바라기가 되고, 반지름을 지수적으로 키우면 앵무조개가 된다. 이 분류는 로그·아르키메데스·페르마 나선과 필로택시스, 그리고 소수를 나선에 배열한 울람 나선을 포함한다.",
  fractals:
    "프랙탈은 부분이 전체를 닮는 구조다. 같은 규칙을 재귀적으로 반복하거나, 복소수를 반복 제곱하거나, 무작위 점을 규칙에 따라 찍으면 무한히 깊은 자기닮음이 나타난다. 만델브로·줄리아처럼 계산이 무거운 항목은 Web Worker로 처리해 조작 중에도 화면이 부드럽다.",
  tilings:
    "타일링은 평면을 빈틈없이 채우는 방법이다. 주기적으로 반복하는 17가지 벽지 대칭부터, 결코 반복하지 않는 펜로즈 타일링, 그리고 점의 세력권을 나누는 보로노이 분할까지. 공간을 어떻게 나누고 채우는가에 대한 수학이 시각으로 드러난다.",
  fields:
    "장(場) 무늬는 공간의 각 점에 값을 부여해 만든다. 여러 파원이 겹치는 간섭, 진동판의 정상파, 매끄러운 노이즈를 따라 흐르는 유선까지. 연속적인 값의 분포가 줄무늬·마디선·흐름으로 나타나는 물리적 패턴들이다.",
  chaos:
    "카오스 패턴은 결정론적 규칙에서 예측 불가능이 나오는 역설을 담는다. 로렌츠 끌개, 반복 사상의 스트레인지 어트랙터, 성장률에 따라 안정에서 카오스로 무너지는 분기도까지. 초기값과 매개변수에 극도로 민감한 동역학을 시각화한다.",
  automata:
    "셀룰러 오토마타는 이웃만 보는 단순 규칙의 반복이 복잡한 창발을 낳는 과정이다. 두 줄짜리 규칙의 랭턴 개미, 256개 규칙의 1차원 오토마타, 화학 반응확산까지. 규칙은 극히 단순하지만 결과는 예측할 수 없다.",
  "number-theory":
    "수론 패턴은 정수의 숨은 구조를 시각으로 드러낸다. 파스칼 삼각형을 소수로 나눈 나머지, 원 위 곱셈이 만드는 카디오이드, 콜라츠 수열이 자라는 나무까지. 추상적인 수의 성질이 뜻밖의 기하 무늬로 나타난다.",
};

export function generateStaticParams() {
  return categories.map((c) => ({ cat: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) return {};
  return {
    title: `${c.label} 패턴 모음 — ${byCategory(cat).length}가지 생성기`,
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
          {list.map((pat) => (
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
    </main>
  );
}
