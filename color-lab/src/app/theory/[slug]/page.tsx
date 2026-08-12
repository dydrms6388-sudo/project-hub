import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  WheelDemo,
  HarmonyDemo,
  WarmCoolDemo,
  SpacesDemo,
  MeaningDemo,
} from "@/components/theory/demos";
import { getTheory, THEORIES } from "@/lib/data";

type TheoryDoc = {
  component: React.ComponentType | null;
  body: string[]; // 데모 앞 1문단 + 데모 뒤 나머지
  links: { href: string; label: string }[];
};

const DOCS: Record<string, TheoryDoc> = {
  "color-wheel": {
    component: WheelDemo,
    body: [
      "색상환은 색을 고리 모양으로 배열한 도구다. 스펙트럼은 빨강에서 보라로 끝나는 직선이지만, 양끝을 이어 붙이면 보라와 빨강 사이가 마젠타 계열로 자연스럽게 연결되며 원이 된다. 이 단순한 재배열 덕분에 '반대편 색', '이웃한 색' 같은 위치 관계로 배색을 설계할 수 있게 된다.",
      "색상환은 하나가 아니다. 회화 전통의 RYB 색상환은 빨강·노랑·파랑을 삼원색으로 놓고 그 혼합으로 원을 채운다. 물감의 감산 혼합 경험에 바탕한 배열이라 미술 교육에서 여전히 쓰인다. 반면 디지털 화면의 RGB/HSL 색상환은 빛의 가산 혼합을 기준으로 하며, 빨강(0°)·초록(120°)·파랑(240°)이 등간격으로 놓인다. 같은 '보색'이라도 어느 색상환을 쓰느냐에 따라 상대가 달라진다 — RYB에서 빨강의 보색은 초록이지만, RGB/HSL에서는 시안이다.",
      "이 사이트의 도구들은 모두 HSL/OKLCH의 색상각, 즉 디지털 색상환을 기준으로 한다. 화면에서 실제로 렌더링되는 색과 계산이 일치하기 때문이다. 인쇄나 회화의 혼색 감각과는 다를 수 있다는 점만 기억해 두면 된다.",
      "색상환에서 파생되는 개념들 — 보색, 유사색, 난색과 한색 — 은 각각의 이론 페이지에서 데모와 함께 다룬다.",
    ],
    links: [
      { href: "/theory/color-harmony/", label: "배색 조화의 원리" },
      { href: "/theory/warm-cool-colors/", label: "난색과 한색" },
      { href: "/tool/palette-generator/", label: "배색 팔레트 생성기" },
    ],
  },
  "color-harmony": {
    component: HarmonyDemo,
    body: [
      "배색 규칙의 대부분은 색상환 위의 기하학이다. 정반대(180°)를 고르면 보색, 이웃(±30°)을 고르면 유사색, 정삼각형(120° 간격)을 그리면 삼각 배색이 된다. 아래 데모에서 기준색을 바꿔 가며 다섯 가지 관계를 직접 확인할 수 있다.",
      "각 관계의 성격은 뚜렷하다. 보색 배색은 색상 대비가 최대가 되어 서로를 도드라지게 하지만, 같은 면적·같은 채도로 쓰면 부딪혀서 시선이 피로해진다. 유사 배색은 안정적이고 자연스러운 대신 단조로워지기 쉽다. 삼각 배색은 활기와 균형을 함께 노리는 절충안이고, 분할 보색은 보색의 긴장을 한 단계 누그러뜨린 형태다.",
      "주의할 것은 이 규칙들이 법칙이 아니라 관례적 지침이라는 점이다. 색상각은 배색의 뼈대일 뿐이고, 실제 인상은 명도와 채도 배분이 좌우한다. 실무에서 널리 쓰이는 요령은 지배색-보조색-강조색의 면적을 크게 차등하는 것(흔히 60:30:10으로 인용된다), 그리고 색상 대비가 강할수록 채도나 면적을 줄여 균형을 잡는 것이다.",
      "규칙으로 후보를 만들고, 명도·채도를 다듬고, 마지막으로 대비비 같은 접근성 조건을 검증하는 순서로 작업하면 배색 규칙을 실용적으로 쓸 수 있다.",
    ],
    links: [
      { href: "/tool/palette-generator/", label: "배색 팔레트 생성기" },
      { href: "/tool/shade-generator/", label: "명도 단계 생성기" },
      { href: "/theory/color-wheel/", label: "색상환의 원리" },
    ],
  },
  "warm-cool-colors": {
    component: WarmCoolDemo,
    body: [
      "빨강·주황·노랑 쪽을 난색, 파랑·청록 쪽을 한색이라 부른다. 불과 태양, 물과 얼음이라는 경험적 연상에 뿌리를 둔 색채학의 관례적 구분으로, 같은 레이아웃이라도 어느 쪽 팔레트를 쓰느냐에 따라 화면의 인상이 크게 달라진다. 아래 데모에서 직접 전환해 보자.",
      "이 구분을 쓸 때 흔한 혼동이 물리량인 색온도(켈빈)와의 혼용이다. 색온도에서는 촛불처럼 '따뜻해 보이는' 빛이 약 1,800K로 낮고, 파랗게 '차가워 보이는' 대낮 하늘광이 6,500K 이상으로 높다. 즉 지각적 '따뜻함'과 물리적 온도는 방향이 반대다. 디자인 문서에서 두 용어를 섞어 쓰면 소통 사고가 나기 쉽다.",
      "난색이 실제로 더 가까워 보이고(진출색) 한색이 물러나 보인다(후퇴색)는 서술은 색채학 교과서에서 오래 다뤄 온 경향성이지만, 효과의 크기는 명도·채도·배경에 크게 의존한다. '난색은 항상 진출한다'처럼 단정하기보다, 같은 화면 안에서 상대적인 경향으로 활용하는 것이 안전하다.",
      "실무 요령은 온도를 섞되 주도권을 정하는 것이다. 화면 전체를 난색이나 한색 한쪽으로 통일하면 인상은 명확해지지만 단조로워진다. 한쪽을 지배색으로 두고 반대 온도를 강조색으로 소량 쓰는 구성이 관례적으로 잘 통한다.",
    ],
    links: [
      { href: "/theory/color-harmony/", label: "배색 조화의 원리" },
      { href: "/theory/color-meaning/", label: "색의 연상과 문화적 의미" },
    ],
  },
  "color-spaces": {
    component: SpacesDemo,
    body: [
      "같은 색이라도 좌표계에 따라 다르게 기술된다. #3EB489라는 여섯 자리 코드, rgb(62, 180, 137)이라는 세 채널 값, '색상 158° · 채도 49% · 밝기 47%'라는 HSL 표현은 모두 같은 색을 가리킨다. 색공간은 색을 숫자로 다루기 위한 좌표계이고, 목적에 따라 좋은 좌표계가 달라진다.",
      "sRGB는 화면 출력의 표준이다. 디스플레이의 빨강·초록·파랑 채널 강도를 직접 지정하므로 기계에게는 정확하지만, 사람에게는 직관적이지 않다 — 채널 값을 봐서는 '더 밝게'나 '덜 쨍하게'를 어떻게 조작해야 할지 알기 어렵다.",
      "HSL은 그 조작 문제를 해결하려고 sRGB를 색상·채도·밝기 축으로 재배열한 것이다. 다만 수학적 재배열일 뿐 지각과는 어긋난다. HSL에서 밝기 50%의 노랑과 파랑을 나란히 놓으면 노랑이 훨씬 밝아 보인다. 이 어긋남 때문에 '지각적으로 고른' 색공간이 따로 발전했다. CIE LAB(1976)이 그 고전이고, OKLCH(2020)는 화면 색 작업에 맞게 다듬어져 CSS 표준에 채택된 최신 좌표계다.",
      "실무 감각으로 정리하면 이렇다. 저장·전달은 HEX/sRGB로, 코드에서 간단한 조작은 HSL로, 팔레트 단계·밝기 비교처럼 지각이 중요한 작업은 OKLCH로 한다. 아래 데모에서 OKLCH의 밝기 축만 움직여 보면, 색상이 유지된 채 밝기만 변하는 지각 균일 색공간의 감각을 확인할 수 있다.",
    ],
    links: [
      { href: "/tool/color-converter/", label: "색상 코드 변환기" },
      { href: "/tool/color-mixer/", label: "색 혼합기 (sRGB vs OKLab)" },
      { href: "/tool/shade-generator/", label: "명도 단계 생성기" },
    ],
  },
  "color-accessibility": {
    component: null,
    body: [
      "색을 쓰는 방식에 따라 어떤 사용자에게는 화면이 읽히지 않는다. 웹 접근성 표준 WCAG는 색과 관련해 크게 두 가지를 요구한다. 첫째, 정보를 색에만 의존해 전달하지 말 것(1.4.1). 둘째, 텍스트와 배경 사이에 충분한 밝기 대비를 확보할 것(1.4.3, 1.4.6).",
      "대비 기준은 수치로 정의된다. 일반 텍스트는 4.5:1(AA) 이상, 큰 텍스트는 3:1 이상이어야 하고, 강화 기준인 AAA는 각각 7:1과 4.5:1이다. 여기서 대비비는 두 색의 상대 휘도로 계산하는 표준 공식의 결과값이며, '어두워 보이니까 괜찮겠지' 같은 감각 판단과 자주 어긋난다. 예를 들어 흰 배경 위 주황 텍스트는 선명해 보여도 3:1을 밑도는 경우가 많다.",
      "색에만 의존하지 말라는 원칙은 색각 이상 사용자에게 특히 중요하다. 남성의 약 8%, 여성의 약 0.5%가 어떤 형태로든 색각 이상을 갖는 것으로 널리 인용된다. 빨강과 초록만으로 오류·성공을 구분하는 UI는 이들에게 동일한 회색 계열로 보일 수 있다. 아이콘·라벨·패턴 같은 비색채 단서를 병행하는 것이 표준적인 해법이다.",
      "링크 텍스트를 색만으로 구분하는 것, 필수 입력 표시를 빨간 별표에만 의존하는 것, 차트 계열을 유사한 채도의 다색으로만 구분하는 것이 실무에서 가장 흔한 위반 사례다. 이 사이트의 대비 검사기와 색각 이상 시뮬레이터로 실제 값을 확인하며 점검할 수 있다 — 해설 페이지인 이곳에는 같은 계산기를 중복으로 두지 않았다.",
    ],
    links: [
      { href: "/tool/contrast-checker/", label: "명도 대비 검사기" },
      { href: "/tool/colorblind-simulator/", label: "색각 이상 시뮬레이터" },
    ],
  },
  "color-meaning": {
    component: MeaningDemo,
    body: [
      "'파랑은 신뢰의 색'이라는 문장은 어디까지 사실일까. 색이 불러일으키는 연상은 실재하는 현상이지만, 그 내용은 색 자체의 속성이 아니라 문화·시대·맥락이 만든 관습이다. 이 페이지는 널리 통용되는 연상을 정리하되, 무엇이 기록으로 확인되는 사실이고 무엇이 통설인지 구분하는 것을 목표로 한다.",
      "같은 색이 문화권에 따라 반대 의미를 갖는 사례는 많다. 흰색은 서구 혼례의 색이면서 동아시아 전통 상례의 색이다. 빨강은 서구 금융 화면에서 손실을 뜻하지만 한국 증시에서는 상승이고, 중국 문화권에서는 경사의 색이다. '보라 = 고귀함' 같은 연상도 고대 염료의 희소성이라는 역사적 조건에서 비롯했다는 설명이 일반적이다 — 조건이 사라진 지금은 관습으로만 남아 있다.",
      "색채 심리 마케팅에서 흔히 인용되는 '빨강은 식욕을 자극한다', '파랑은 집중력을 높인다' 류의 명제는 개별 연구가 존재하더라도 효과 크기와 재현성에 대한 논쟁이 있는 영역이다. 단정적 근거로 삼기보다, 타깃 문화권의 관습에 어긋나지 않는지 확인하는 소극적 점검 도구로 쓰는 편이 실무적으로 안전하다.",
      "아래 데모에서 색을 골라 관례적 연상과 그에 대한 주석을 확인할 수 있다. 모든 서술은 참고용이며, 특정 색이 특정 효과를 보장한다는 의미가 아니다.",
    ],
    links: [
      { href: "/theory/warm-cool-colors/", label: "난색과 한색" },
      { href: "/family/red/", label: "빨강 계열 색 보기" },
    ],
  },
};

export function generateStaticParams() {
  return THEORIES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theory = getTheory(slug);
  if (!theory) return {};
  return {
    title: theory.name,
    description: DOCS[slug]?.body[0]?.slice(0, 90) ?? theory.computation,
  };
}

export default async function TheoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theory = getTheory(slug);
  const doc = DOCS[slug];
  if (!theory || !doc) notFound();
  const Demo = doc.component;

  return (
    <main>
      <nav className="crumbs" aria-label="현재 위치">
        <Link href="/">색채 실험실</Link> › 이론 › {theory.name}
      </nav>
      <h1>{theory.name}</h1>
      <p>{doc.body[0]}</p>
      {Demo && <Demo />}
      {doc.body.slice(1).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      <section>
        <h2>함께 보기</h2>
        <ul className="list-links">
          {doc.links.map((l) => (
            <li key={l.href}>
              <Link href={l.href}>
                <span className="t">{l.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
