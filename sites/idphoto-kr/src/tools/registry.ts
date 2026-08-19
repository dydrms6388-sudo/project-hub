import { specs, specBySlug, mmToPx, type PhotoSpec } from "@/data/specs";

export type Faq = { q: string; a: string };

export type ToolMeta = {
  /** URL: /tools/<slug>/ */
  slug: string;
  /** <title> 에 들어가는 문구 */
  title: string;
  /** H1 — 한국어 검색어를 그대로 쓴다 */
  h1: string;
  description: string;
  keywords: string[];
  category: string;
  /** 사용법 단계 */
  howto: string[];
  /** 원리·근거 (문단 배열, 마크다운 아님 — 순수 텍스트) */
  principle: string[];
  /** 출처 링크 (선택) */
  sources?: { label: string; url: string }[];
  /** FAQ 5개 — JSON-LD FAQPage 로 나간다 */
  faq: Faq[];
  /** 관련 도구 slug */
  related: string[];
  /** 무거운 도구면 "PC 권장" 뱃지 */
  heavy?: boolean;
};

/* ── 규격 문단 자동 생성: specs.ts 를 유일한 수치 소스로 유지하기 위함 ── */

const px = (s: PhotoSpec) => `${mmToPx(s.mm.w)} × ${mmToPx(s.mm.h)} px`;

/** "규격 상세(머리 크기·배경)" 문단 — 모든 규격 페이지의 principle 첫 문단 */
function sizeParagraph(s: PhotoSpec): string {
  return (
    `${s.name}의 인쇄 크기는 ${s.sizeLabel} 입니다. 인쇄 규격을 픽셀로 옮길 때는 ` +
    `px = mm × dpi ÷ 25.4 공식을 씁니다. 인화소 표준인 300dpi 를 대입하면 ` +
    `${s.mm.w}mm × 300 ÷ 25.4 = ${((s.mm.w * 300) / 25.4).toFixed(1)}px, ` +
    `${s.mm.h}mm × 300 ÷ 25.4 = ${((s.mm.h * 300) / 25.4).toFixed(1)}px 이므로 ` +
    `이 도구는 ${px(s)} 로 출력합니다. 화면용 72dpi 로 만든 파일을 인화하면 ` +
    `실제 종이 위에서 규격보다 작거나 흐리게 나옵니다.`
  );
}

/** "머리 크기·표정 규정" 문단 */
function headParagraph(s: PhotoSpec): string {
  const r = s.headRatio;
  const eye = s.eyeFromBottom
    ? ` 눈높이는 사진 아래쪽 끝에서 ${s.eyeFromBottom.min}~${s.eyeFromBottom.max}mm 지점에 와야 합니다.`
    : " 눈높이 선은 공식 수치가 아니라 머리 위치에서 파생한 참고선입니다.";
  return (
    `머리 길이(정수리부터 턱까지)는 ${s.head.min}~${s.head.max}mm 이며, 세로 ${s.mm.h}mm 기준으로 ` +
    `사진 높이의 ${Math.round(r.min * 100)}~${Math.round(r.max * 100)}% 에 해당합니다. ` +
    `이 도구의 타원 가이드는 목표값 ${s.head.target}mm(${Math.round(r.target * 100)}%)에 맞춰 그려지고, ` +
    `허용 범위는 옅은 띠로 함께 표시됩니다. 정수리 위 여백은 ${s.topMargin.target}mm 안팎을 기준으로 잡습니다.` +
    eye
  );
}

/** 배경·처리 문단 */
function bgParagraph(s: PhotoSpec): string {
  return (
    `배경은 ${s.bgLabel} 이어야 합니다. 이 도구의 "배경 흰색으로 바꾸기" 는 브라우저에서 ` +
    `RMBG-1.4 분리 모델(약 40MB)을 내려받아 인물과 배경을 나눈 뒤 배경만 흰색 단색으로 칠하는 방식입니다. ` +
    `모델은 버튼을 누른 뒤에만 내려받고, 실패하거나 지원되지 않는 기기에서는 배경 제거만 건너뛰고 ` +
    `크롭·규격 맞춤·300dpi 저장·인화 배치는 그대로 동작합니다. 머리카락 경계가 지저분하면 ` +
    `원본을 흰 벽 앞에서 다시 찍는 편이 확실합니다.`
  );
}

const privacyParagraph =
  "업로드한 사진은 브라우저 메모리에서만 처리됩니다. 서버로 전송하거나 저장하지 않고, 자르기·배경 처리·PDF 생성이 모두 사용자의 기기에서 실행됩니다. 페이지를 닫으면 사진은 남지 않습니다.";

const printParagraph =
  "인화 배치 PDF 는 pdf-lib 로 만들며, 1pt = 1/72인치 단위로 실제 mm 크기를 계산해 배치합니다. 4×6인치(101.6 × 152.4mm) 인화지와 A4(210 × 297mm) 용지를 지원하고, 규격을 세워서/눕혀서 배치했을 때 더 많이 들어가는 쪽을 자동으로 고릅니다. 인쇄 대화상자에서 반드시 배율을 100%(실제 크기)로 두어야 규격이 맞습니다.";

const unverifiedParagraph = (s: PhotoSpec) =>
  `⚠️ 확인 필요: ${s.verifyNote ?? "공식 출처로 수치를 확정하지 못했습니다."}`;

const commonHowto = (s: PhotoSpec): string[] => [
  "사진을 끌어다 놓거나 클릭해서 선택합니다. 정면을 보고 찍은 밝은 사진이 가장 잘 나옵니다.",
  `화면의 타원 가이드에 얼굴을 맞춥니다. 정수리와 턱이 타원의 위·아래 선에 닿으면 머리 길이 ${s.head.min}~${s.head.max}mm 조건을 만족합니다.`,
  "필요하면 배경을 흰색으로 바꿉니다(선택). 모델을 처음 한 번 내려받으며 진행률이 표시됩니다.",
  `"300dpi JPG 저장" 을 누르면 ${px(s)} 규격 파일이 바로 받아집니다.`,
  "여러 장을 인화하려면 4×6인치 또는 A4 배치 PDF 를 만들어 사진관·집 프린터에서 실제 크기(100%)로 출력합니다.",
];

function glassesFaq(s: PhotoSpec): Faq {
  if (s.slug === "passport-photo" || s.slug === "license-photo") {
    return {
      q: "안경을 써도 되나요?",
      a: "여권 사진은 안경 착용이 불가합니다. 외교부 여권 사진 규격은 도수 안경과 선글라스를 모두 벗고 촬영하도록 정하고 있으며, 운전면허 사진도 여권용 규격을 그대로 적용합니다. 촬영 전에 안경을 벗으세요.",
    };
  }
  if (s.slug === "us-visa-photo") {
    return {
      q: "안경을 써도 되나요?",
      a: "미국 비자·여권 사진은 2016년 11월 1일부터 안경 착용 사진을 받지 않습니다. 의료상 안경을 벗을 수 없는 경우에만 의사 소견서를 첨부해 예외를 인정받을 수 있습니다. 일반적인 경우에는 벗고 촬영하세요.",
    };
  }
  if (s.slug === "china-visa-photo") {
    return {
      q: "안경을 써도 되나요?",
      a: "중국 비자 사진은 굵은 테, 색이 있는 렌즈, 빛을 반사하는 안경을 착용할 수 없습니다. 눈과 눈썹이 가려지지 않는 얇은 무색 안경은 허용되는 경우가 있으나, 반려 위험을 줄이려면 벗고 촬영하는 편이 안전합니다.",
    };
  }
  return {
    q: "안경을 써도 되나요?",
    a: `${s.name}에는 안경 관련 공식 금지 조항이 별도로 없지만, 눈과 눈썹이 가려지거나 렌즈에 빛이 반사되면 재촬영을 요구받을 수 있습니다. 여권·비자 사진은 안경 착용이 금지되어 있으므로, 같은 원본을 여러 용도로 쓸 계획이라면 벗고 찍는 것이 낫습니다.`,
  };
}

function homeFaq(s: PhotoSpec): Faq {
  const strict = s.slug === "passport-photo" || s.slug === "license-photo" || s.slug.endsWith("visa-photo");
  return {
    q: "집에서 찍어도 되나요?",
    a: strict
      ? `규정은 촬영 장소가 아니라 사진의 조건(크기, 머리 길이, 배경, 표정, 6개월 이내 촬영)을 정하고 있으므로 집에서 찍은 사진도 조건을 만족하면 사용할 수 있습니다. 다만 흰 벽 앞에서 정면·자연광으로 찍고 그림자와 렌즈 왜곡을 피해야 합니다. 스마트폰을 얼굴 가까이 대면 코가 커지는 왜곡이 생기므로, 1.5~2m 떨어져 찍고 확대하는 편이 좋습니다. 접수처에서 최종 판단하므로 중요한 신청이라면 사진관을 권합니다.`
      : `네, 가능합니다. ${s.name}은 법정 규격이 아니라 제출처가 정하는 경우가 많아 조건이 비교적 느슨합니다. 흰 벽 앞에서 정면으로, 얼굴에 그림자가 지지 않도록 찍은 뒤 이 도구로 규격에 맞춰 자르면 됩니다. 스마트폰은 1.5~2m 떨어져 찍고 확대해야 얼굴 왜곡이 없습니다.`,
  };
}

function accuracyFaq(s: PhotoSpec): Faq {
  return s.verified
    ? {
        q: "여기 적힌 규격 수치는 믿을 수 있나요?",
        a: `${s.name} 수치는 아래 '출처' 링크의 발급 기관 공식 안내를 근거로 넣었습니다. 다만 규정은 개정될 수 있으므로 신청 직전에 출처 링크에서 한 번 더 확인하시길 권합니다. 최종 적합 여부는 접수 기관이 판단합니다.`,
      }
    : {
        q: "여기 적힌 규격 수치는 믿을 수 있나요?",
        a: `${s.name}은 공식 고시가 없거나 출처마다 값이 달라, 이 페이지에서는 '확인 필요' 배지를 띄우고 있습니다. ${s.verifyNote ?? ""} 제출처가 안내한 규격이 있으면 그 값을 우선하세요.`,
      };
}

function bgFaq(): Faq {
  return {
    q: "배경 흰색 바꾸기가 안 되거나 너무 느립니다.",
    a: "배경 분리 모델은 약 40MB 를 처음 한 번 내려받고, WebGPU 를 지원하는 최신 크롬·엣지에서 가장 빠릅니다. 지원하지 않는 기기는 WASM 으로 대체 실행되어 수십 초가 걸릴 수 있습니다. 모델을 못 받아도 자르기·규격 맞춤·300dpi 저장·인화 배치는 정상 동작하니, 급하면 배경 처리를 건너뛰고 흰 벽 앞에서 다시 촬영하세요.",
  };
}

function printFaq(s: PhotoSpec): Faq {
  return {
    q: "한 장에 몇 컷까지 들어가나요?",
    a: `${s.sizeLabel} 규격 기준으로 4×6인치 인화지와 A4 용지에 실제로 들어가는 최대 컷 수를 도구가 계산해 보여 줍니다. 예를 들어 35 × 45 mm 는 4×6인치 인화지에 눕혀 배치하면 8컷이 들어갑니다. 원하는 컷 수를 고르면 여백과 재단선을 넣은 PDF 가 만들어집니다.`,
  };
}

const CATEGORY: Record<string, string> = {
  "passport-photo": "여권·비자",
  "us-visa-photo": "여권·비자",
  "china-visa-photo": "여권·비자",
  "japan-visa-photo": "여권·비자",
  "license-photo": "신분증·자격증",
  "student-id-photo": "신분증·자격증",
  "resume-photo": "취업·이력서",
  "half-name-card": "취업·이력서",
};

/** 같은 카테고리 규격을 먼저, 그다음 나머지 규격 순으로 4개 */
const relatedFor = (slug: string): string[] => {
  const cat = CATEGORY[slug];
  const others = specs.map((s) => s.slug).filter((s) => s !== slug);
  const same = others.filter((s) => CATEGORY[s] === cat);
  const rest = others.filter((s) => CATEGORY[s] !== cat);
  return [...same, ...rest].slice(0, 4);
};

const TITLES: Record<string, { title: string; h1: string; keywords: string[] }> = {
  "passport-photo": {
    title: "여권사진 만들기 — 35×45mm 규격 자동 맞춤",
    h1: "여권사진 만들기",
    keywords: ["여권사진", "여권사진 규격", "여권사진 만들기", "35x45", "여권사진 셀프", "여권사진 배경 흰색"],
  },
  "us-visa-photo": {
    title: "미국 비자 사진 만들기 — 51×51mm(2×2인치) 규격",
    h1: "미국 비자 사진 만들기",
    keywords: ["미국비자 사진", "미국비자 사진 규격", "2x2 사진", "51x51", "DS-160 사진", "미국 여권사진"],
  },
  "license-photo": {
    title: "운전면허 사진 만들기 — 35×45mm 규격 맞춤",
    h1: "운전면허 사진 만들기",
    keywords: ["운전면허 사진", "운전면허 사진 규격", "면허증 사진", "운전면허 갱신 사진", "e운전면허 사진"],
  },
  "resume-photo": {
    title: "이력서 사진 만들기 — 35×45mm / 30×40mm",
    h1: "이력서 사진 만들기",
    keywords: ["이력서 사진", "이력서 사진 규격", "증명사진 만들기", "취업사진", "이력서 사진 크기"],
  },
  "half-name-card": {
    title: "반명함 사진 만들기 — 30×40mm 규격",
    h1: "반명함 사진 만들기",
    keywords: ["반명함", "반명함 사진", "반명함판", "3x4 사진", "반명함 규격"],
  },
  "student-id-photo": {
    title: "학생증 사진 만들기 — 30×40mm 규격",
    h1: "학생증 사진 만들기",
    keywords: ["학생증 사진", "학생증 사진 규격", "학생증 증명사진", "학번사진", "재학증명 사진"],
  },
  "china-visa-photo": {
    title: "중국 비자 사진 만들기 — 33×48mm 규격",
    h1: "중국 비자 사진 만들기",
    keywords: ["중국비자 사진", "중국비자 사진 규격", "33x48", "중국 비자 사진 크기", "중국비자 증명사진"],
  },
  "japan-visa-photo": {
    title: "일본 비자 사진 만들기 — 45×45mm 규격",
    h1: "일본 비자 사진 만들기",
    keywords: ["일본비자 사진", "일본비자 사진 규격", "45x45", "일본 비자 증명사진", "일본 사증 사진"],
  },
};

function buildTool(s: PhotoSpec): ToolMeta {
  const t = TITLES[s.slug];
  const principle = [
    sizeParagraph(s),
    headParagraph(s),
    bgParagraph(s),
    printParagraph,
    privacyParagraph,
  ];
  if (!s.verified) principle.splice(1, 0, unverifiedParagraph(s));

  return {
    slug: s.slug,
    title: t.title,
    h1: t.h1,
    description: `${s.name} 규격(${s.sizeLabel})에 맞춰 얼굴 가이드로 자르고 300dpi JPG 로 저장합니다. 4×6·A4 인화 배치 PDF 도 만들 수 있고 사진은 서버로 전송되지 않습니다.`,
    keywords: t.keywords,
    category: CATEGORY[s.slug],
    howto: commonHowto(s),
    principle,
    sources: s.source.length > 0 ? s.source : undefined,
    faq: [homeFaq(s), glassesFaq(s), accuracyFaq(s), bgFaq(), printFaq(s)],
    related: relatedFor(s.slug),
    // 자르기·규격 맞춤·300dpi 저장·인화 배치는 모바일에서도 가볍게 동작한다.
    // 무거운 것은 "배경 흰색화"(선택 기능)뿐이라 페이지 전체에 PC 권장 배지를 달지 않는다.
  };
}

export const tools: ToolMeta[] = specs.map(buildTool);

export const toolBySlug = (slug: string): ToolMeta | undefined =>
  tools.find((t) => t.slug === slug);

/** 도구 slug 에 대응하는 규격 데이터 */
export const specForTool = specBySlug;

export const toolsByCategory = (): { category: string; items: ToolMeta[] }[] => {
  const map = new Map<string, ToolMeta[]>();
  for (const t of tools) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
};
