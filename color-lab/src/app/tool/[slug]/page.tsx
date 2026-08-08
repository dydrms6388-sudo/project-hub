import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContrastChecker, ColorConverter, ColorMixer } from "@/components/tools/basic";
import { PaletteGenerator, ShadeGenerator, GradientGenerator } from "@/components/tools/palette";
import { ImageExtractor, CvdSimulator, NameFinder } from "@/components/tools/advanced";
import { getTool, TOOLS } from "@/lib/data";

type ToolDoc = {
  component: React.ComponentType;
  intro: string[];
  faq: { q: string; a: string }[];
};

const DOCS: Record<string, ToolDoc> = {
  "contrast-checker": {
    component: ContrastChecker,
    intro: [
      "글자색과 배경색을 고르면 WCAG 2.1의 상대 휘도 공식으로 대비비를 계산하고, AA·AAA 기준 통과 여부를 판정합니다. 대비비는 (밝은 쪽 휘도 + 0.05) ÷ (어두운 쪽 휘도 + 0.05)로 정의되며, 근사값이 아니라 표준 공식 그대로의 계산 결과를 보여줍니다.",
      "일반 텍스트는 4.5:1(AA) / 7:1(AAA), 큰 텍스트(18pt 이상 또는 14pt 굵게)는 3:1(AA) / 4.5:1(AAA)이 기준입니다. 선택한 색은 URL에 저장되므로, 팀원에게 링크를 보내 같은 조합을 바로 보여줄 수 있습니다.",
    ],
    faq: [
      {
        q: "대비비 기준은 어디서 나온 값인가요?",
        a: "W3C의 웹 콘텐츠 접근성 지침 WCAG 2.1(§1.4.3, §1.4.6)에 정의된 기준입니다. 이 도구는 해당 문서의 상대 휘도 정의(sRGB 감마 역변환 포함)를 그대로 구현했습니다.",
      },
      {
        q: "AA만 통과하면 충분한가요?",
        a: "법적·정책적 요구 수준은 서비스마다 다르지만, 일반적으로 본문 텍스트는 AA(4.5:1)를 최소선으로 봅니다. 장문 콘텐츠나 저시력 사용자를 배려한다면 AAA(7:1)를 목표로 하는 것이 안전합니다.",
      },
    ],
  },
  "color-converter": {
    component: ColorConverter,
    intro: [
      "하나의 색을 HEX, RGB, HSL, CIE LAB, OKLCH 다섯 표기로 동시에 보여주는 변환기입니다. sRGB(IEC 61966-2-1)의 감마 역변환, D65 백색점 기준 CIE LAB 변환식, Björn Ottosson이 2020년 공개하고 CSS Color Module Level 4가 채택한 OKLab 변환식을 사용합니다.",
      "HSL은 코드에서 다루기 쉽지만 지각 균일하지 않아 같은 L값이라도 색상마다 밝기가 다르게 보입니다. 밝기를 일정하게 다루고 싶다면 OKLCH 값을 기준으로 삼는 편이 정확합니다.",
    ],
    faq: [
      {
        q: "LAB 값이 다른 사이트와 조금 다르게 나옵니다.",
        a: "CIE LAB은 기준 백색점에 따라 값이 달라집니다. 이 도구는 D65 백색점을 사용하며, CSS의 lab() 함수처럼 D50을 쓰는 구현과는 수치가 다를 수 있습니다. 어느 쪽도 틀린 것이 아니라 기준이 다른 것입니다.",
      },
      {
        q: "OKLCH는 왜 쓰나요?",
        a: "밝기(L)·채도(C)·색상(h)이 사람의 지각과 비슷하게 정렬된 색공간이어서, 팔레트 단계를 만들거나 밝기만 바꾸는 조작에 적합합니다. 최신 CSS에서 oklch() 문법으로 바로 쓸 수 있습니다.",
      },
    ],
  },
  "palette-generator": {
    component: PaletteGenerator,
    intro: [
      "기준색 하나를 고르면 색상환에서의 각도 관계로 다섯 가지 배색 — 보색(180°), 유사(±30°), 삼각(120° 간격), 분할 보색(150°/210°), 사각(90° 간격) — 을 한 번에 생성합니다.",
      "각 팔레트는 HEX 목록 복사와 PNG 다운로드를 지원합니다. 배색 규칙이 왜 이런 각도인지 궁금하다면 배색 조화 이론 페이지를 함께 읽어 보세요.",
    ],
    faq: [
      {
        q: "생성된 배색이 항상 예쁘지는 않은 것 같아요.",
        a: "각도 규칙은 출발점이지 완성이 아닙니다. 규칙으로 색상(hue)을 정한 뒤 명도·채도를 다듬는 것이 실무 배색의 일반적인 순서입니다. 명도 조정에는 명도 단계 생성기를 활용하세요.",
      },
      {
        q: "회색을 넣으면 팔레트가 이상해집니다.",
        a: "무채색은 색상각이 정의되지 않아 회전 결과가 의미를 갖지 않습니다. 채도가 있는 색을 기준색으로 사용하세요.",
      },
    ],
  },
  "shade-generator": {
    component: ShadeGenerator,
    intro: [
      "기준색의 색상과 채도 균형을 유지하면서 밝기 단계(틴트~셰이드)를 만드는 도구입니다. HSL의 L 대신 OKLCH의 L을 균등 보간해, 단계 사이의 밝기 차이가 지각적으로 고르게 느껴지도록 했습니다.",
      "디자인 시스템에서 흔히 쓰는 100~900 스케일 형식의 CSS 변수로 복사할 수 있고, PNG로도 내려받을 수 있습니다.",
    ],
    faq: [
      {
        q: "왜 HSL 밝기로 만들지 않나요?",
        a: "HSL의 L은 수학적 정의일 뿐 지각 밝기와 어긋납니다. 예컨대 HSL에서 같은 L=50%라도 노랑은 파랑보다 훨씬 밝게 보입니다. OKLCH의 L은 이 문제를 크게 줄여 줍니다.",
      },
      {
        q: "끝 단계에서 색이 살짝 바래 보입니다.",
        a: "아주 밝거나 어두운 영역에서는 원래 채도를 유지하면 sRGB로 표현 가능한 범위를 벗어나므로, 클리핑으로 인한 색상 왜곡을 줄이기 위해 채도를 점진적으로 낮춥니다.",
      },
    ],
  },
  "image-color-extractor": {
    component: ImageExtractor,
    intro: [
      "사진에서 대표색 6개를 뽑아 팔레트로 만들어 줍니다. 색 양자화의 고전 알고리즘인 median cut(Heckbert, 1982)으로 픽셀을 분할해 각 군집의 평균색을 계산합니다.",
      "모든 처리는 브라우저의 canvas 안에서 끝납니다. 이미지가 서버로 전송·저장되는 일은 없으며, 페이지를 닫으면 데이터도 사라집니다.",
    ],
    faq: [
      {
        q: "업로드한 사진은 어디에 저장되나요?",
        a: "어디에도 저장되지 않습니다. 이 사이트에는 서버 처리 자체가 없고, 이미지는 사용자의 브라우저 메모리 안에서만 분석됩니다.",
      },
      {
        q: "추출된 색이 사진의 인상과 조금 다릅니다.",
        a: "median cut은 픽셀 수 기준의 대표색을 찾기 때문에, 면적은 작지만 인상에 크게 기여하는 색(하이라이트 등)은 빠질 수 있습니다. 필요하면 사진을 잘라 원하는 영역만 분석해 보세요.",
      },
    ],
  },
  "colorblind-simulator": {
    component: CvdSimulator,
    intro: [
      "팔레트가 색각 이상 사용자에게 어떻게 보이는지 확인하는 도구입니다. 제1색각(적색맹)·제2색각(녹색맹)·제3색각(청색맹) 세 유형을 Machado, Oliveira & Fernandes(2009, IEEE TVCG)가 발표한 변환 행렬(중증도 1.0)로 시뮬레이션합니다.",
      "차트 계열색·상태 색처럼 서로 구분되어야 하는 색 묶음을 넣고, 세 유형 모두에서 구분이 유지되는지 확인하는 용도로 만들어졌습니다. 시뮬레이션은 통계적 모델에 따른 근사이며, 실제 개인의 지각을 재현하는 것도, 의료적 진단도 아닙니다.",
    ],
    faq: [
      {
        q: "이 결과로 색각 이상 여부를 확인할 수 있나요?",
        a: "아닙니다. 이 도구는 디자이너가 팔레트의 구분 가능성을 점검하기 위한 시뮬레이션이며 의료적 진단 도구가 아닙니다. 색각 검사는 의료기관에서 받으세요.",
      },
      {
        q: "변환 행렬의 출처는 무엇인가요?",
        a: "Machado, Oliveira & Fernandes, \"A Physiologically-based Model for Simulation of Color Vision Deficiency\"(IEEE TVCG, 2009)의 공개 행렬을 선형 RGB에 적용합니다.",
      },
    ],
  },
  "gradient-generator": {
    component: GradientGenerator,
    intro: [
      "선형·원형·원뿔형 그라디언트를 슬라이더로 조정하고 완성된 CSS 코드를 복사하는 도구입니다. CSS Images Module의 표준 그라디언트 문법을 그대로 출력합니다.",
      "설정은 URL에 저장되므로 마음에 드는 그라디언트를 링크로 공유할 수 있습니다.",
    ],
    faq: [
      {
        q: "중간이 탁해 보이는 그라디언트가 있습니다.",
        a: "CSS 그라디언트는 기본적으로 sRGB 공간에서 보간되어, 보색에 가까운 두 색 사이에서는 중간이 회색빛으로 가라앉을 수 있습니다. 최신 브라우저의 in oklch 보간 문법을 쓰거나 중간 정지점을 추가하면 개선됩니다. 색 혼합기 페이지에서 이 차이를 비교해 볼 수 있습니다.",
      },
      {
        q: "conic 그라디언트는 어디에 쓰나요?",
        a: "원뿔형은 각도를 따라 색이 도는 형태로, 색상환·도넛 차트·로딩 표시 같은 원형 UI에 주로 쓰입니다.",
      },
    ],
  },
  "color-mixer": {
    component: ColorMixer,
    intro: [
      "두 색을 고르고 비율을 움직이면 sRGB 보간과 OKLab 보간의 결과를 나란히 보여줍니다. 같은 '50% 섞기'라도 어느 색공간에서 섞느냐에 따라 중간색이 달라진다는 것을 눈으로 확인하는 도구입니다.",
      "sRGB 보간은 감마 인코딩된 값을 그대로 섞기 때문에 중간이 어둡고 탁해지기 쉽고, OKLab 보간은 지각적으로 자연스러운 경로를 지나갑니다. CSS의 color-mix() 함수가 이 개념의 표준 구현입니다.",
    ],
    faq: [
      {
        q: "물감을 섞은 결과와 같은가요?",
        a: "아닙니다. 물감 혼합은 감산 혼합이라 빛(화면)의 혼합과 원리가 다릅니다. 이 도구는 화면 색의 보간을 다룹니다.",
      },
      {
        q: "실무에서는 어느 쪽을 써야 하나요?",
        a: "그라디언트·트랜지션처럼 사람이 중간색을 보게 되는 경우 OKLab 계열 보간이 대체로 자연스럽습니다. 다만 브라우저 호환성과 기존 코드와의 일관성도 고려해 선택하세요.",
      },
    ],
  },
  "color-name-finder": {
    component: NameFinder,
    intro: [
      "아무 색이나 고르면 CSS 표준 색상명 가운데 가장 가까운 이름 5개를 찾아 줍니다. 입력색과 후보색을 모두 CIE LAB으로 변환한 뒤 색차 ΔE*ab(CIE76)를 계산해 정렬합니다.",
      "색상명의 실제 값은 하드코딩된 표가 아니라 사용 중인 브라우저의 색상명 해석을 통해 얻으므로, 표준 그대로의 값이 보장됩니다. '이 색을 뭐라고 부르지?'가 필요한 순간 — 변수 이름 짓기, 디자인 리뷰에서의 소통 — 에 쓰세요.",
    ],
    faq: [
      {
        q: "ΔE 값은 어떻게 읽나요?",
        a: "색차 ΔE*ab는 두 색이 지각적으로 얼마나 다른지를 나타내는 수치로, 대략 2.3 이하면 나란히 놓아도 구분하기 어려운 수준으로 봅니다. 값이 클수록 다른 색입니다.",
      },
      {
        q: "한국어 색이름으로도 찾아 주나요?",
        a: "현재는 CSS 표준 색상명(영문)만 지원합니다. 한국어 관용 색이름은 표준화된 색값 표가 없어, 잘못된 값을 단정하지 않기 위해 포함하지 않았습니다.",
      },
    ],
  },
};

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: `${tool.computation} 기준: ${tool.standardBasis}. 브라우저 안에서만 동작하는 무료 도구.`,
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  const doc = DOCS[slug];
  if (!tool || !doc) notFound();
  const Widget = doc.component;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: doc.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="crumbs" aria-label="현재 위치">
        <Link href="/">색채 실험실</Link> › 도구 › {tool.name}
      </nav>
      <h1>{tool.name}</h1>
      <p>{doc.intro[0]}</p>

      <Widget />

      {doc.intro.slice(1).map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      <section>
        <h2>자주 묻는 질문</h2>
        {doc.faq.map((f) => (
          <div className="faq-item" key={f.q}>
            <div className="q">{f.q}</div>
            <div className="a">{f.a}</div>
          </div>
        ))}
      </section>

      <p className="footnote">계산 기준: {tool.standardBasis}</p>
    </main>
  );
}
