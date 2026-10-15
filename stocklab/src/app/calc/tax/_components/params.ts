import { TAX_PARAMS } from "@/lib/tax";
import { SITE, absUrl } from "@/lib/site";

/** 투자 세금 계산기 전체가 공유하는 기준연도 — src/lib/tax.ts 의 TAX_PARAMS.baseYear */
export const BASE_YEAR = TAX_PARAMS.baseYear;

export const TAX_ROOT = "/calc/tax";

/**
 * TAX_PARAMS 안에서 "확인 필요" 로 표시된 항목.
 * 각 페이지의 "주의" 섹션에 관련 항목을 노출해, 세법 개정으로 값이 달라졌을 수 있음을 알린다.
 */
export interface ReviewItem {
  /** 어떤 계산기에서 노출할지 */
  scope: "overseas" | "fin" | "isa" | "major" | "all";
  title: string;
  body: string;
}

export const REVIEW_ITEMS: ReviewItem[] = [
  {
    scope: "all",
    title: `금융투자소득세 — ${TAX_PARAMS.financialInvestmentIncomeTax.status}`,
    body:
      "금융투자소득세는 2025년 시행 예정이었다가 폐지 법안이 통과된 것으로 알려져 있습니다. 재도입 논의가 다시 진행되면 해외주식 양도세와 대주주 과세 구조 자체가 달라지므로, 계산 결과를 그대로 신뢰하기 전에 최신 소득세법과 국세청 안내를 확인해 주세요.",
  },
  {
    scope: "fin",
    title: `배당가산(Gross-up)율 ${TAX_PARAMS.comprehensive.grossUpPct}% — 개정 여부 확인 필요`,
    body:
      "배당가산율과 배당세액공제율은 법인세·소득세 이중과세 조정 방식이 바뀌면 함께 조정될 수 있습니다. 이 계산기는 배당가산 10%, 같은 금액의 배당세액공제를 가정합니다.",
  },
  {
    scope: "fin",
    title: "종합소득세 누진세율 구간 — 개정 여부 확인 필요",
    body:
      "6%~45% 8단계 누진세율표는 2023년 귀속분부터 적용된 값을 사용합니다. 과세표준 구간이나 세율이 개정되면 예상 추가 세액이 달라집니다.",
  },
  {
    scope: "isa",
    title: "ISA 납입·비과세 한도 — 확대 개정안 시행 여부 확인 필요",
    body:
      `현재 계산은 연 ${TAX_PARAMS.isa.annualLimit / 10_000}만원·총 ${TAX_PARAMS.isa.totalLimit / 100_000_000}억원 납입한도, 비과세 일반형 ${TAX_PARAMS.isa.taxFreeGeneral / 10_000}만원·서민형 ${TAX_PARAMS.isa.taxFreeSeomin / 10_000}만원을 기준으로 합니다. 한도를 연 4,000만원·비과세 500만원으로 확대하는 개정안이 논의된 바 있어, 시행 여부에 따라 결과가 달라집니다.`,
  },
  {
    scope: "isa",
    title: `연금 수령액 종합과세 기준 ${TAX_PARAMS.pension.pensionComprehensiveThreshold / 10_000}만원 — 확인 필요`,
    body:
      "사적연금 수령액이 기준금액을 넘으면 종합과세와 분리과세 중 선택하게 됩니다. 기준금액과 분리과세율은 개정 이력이 있으므로 실제 수령 시점의 규정을 확인해야 합니다.",
  },
  {
    scope: "major",
    title: `대주주 기준 금액 ${TAX_PARAMS.majorShareholder.valueThreshold / 100_000_000}억원 — 개정 여부 확인 필요`,
    body:
      "종목당 보유액 기준은 10억원 → 50억원으로 상향된 이력이 있고, 이후에도 조정 논의가 이어졌습니다. 판정 기준일(직전 사업연도 종료일) 시점에 유효한 시행령을 반드시 확인해 주세요.",
  },
];

export function reviewItemsFor(scope: ReviewItem["scope"]): ReviewItem[] {
  return REVIEW_ITEMS.filter((r) => r.scope === scope || r.scope === "all");
}

/** 모든 세금 계산기 페이지가 공통으로 표시하는 한 줄 고지 (문장은 페이지마다 앞뒤 문맥이 다르다) */
export const NOT_TAX_ADVICE =
  `${BASE_YEAR}년 세법 기준의 참고용 계산이며 세무 상담이 아닙니다. 실제 신고 세액은 세무 전문가 상담이나 홈택스에서 확인해 주세요.`;

export interface FaqItem { q: string; a: string }

export function faqJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function softwareJsonLd({ path, name, description, featureList }: {
  path: string; name: string; description: string; featureList: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url: absUrl(path),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    publisher: { "@type": "Organization", name: SITE.parent.name, url: SITE.parent.url },
    featureList,
    isAccessibleForFree: true,
  };
}

/** 4개 하위 도구 레지스트리 — 허브 목록·페이지 하단 "함께 보기" 가 공유 */
export interface TaxTool {
  href: string;
  label: string;
  short: string;
  desc: string;
}

export const TAX_TOOLS: TaxTool[] = [
  {
    href: "/calc/tax/overseas",
    label: "해외주식 양도세 손익통산",
    short: "해외주식 양도세",
    desc: `실현손익을 합산해 기본공제 ${TAX_PARAMS.overseas.basicDeduction / 10_000}만원을 뺀 과세표준과 ${TAX_PARAMS.overseas.ratePct}% 세액을 계산하고, 미실현 손실을 실현했을 때 줄어드는 세액을 종목별로 보여 줍니다.`,
  },
  {
    href: "/calc/tax/financial-income",
    label: "금융소득종합과세 경계 계산기",
    short: "금융소득종합과세",
    desc: `배당과 이자를 합쳐 연 ${TAX_PARAMS.comprehensive.threshold / 10_000}만원 경계까지 얼마나 남았는지, 넘었다면 원천징수 대비 추가 세액이 얼마인지 계산합니다.`,
  },
  {
    href: "/calc/tax/isa",
    label: "ISA vs 일반계좌 vs 연금저축",
    short: "ISA 비교",
    desc: "같은 납입액·수익률을 세 계좌에 넣었을 때 세후 자산이 어떻게 갈리는지 표와 막대그래프로 비교합니다.",
  },
  {
    href: "/calc/tax/major-shareholder",
    label: "국내주식 대주주 요건 체크",
    short: "대주주 요건",
    desc: `종목별 보유 평가액과 지분율을 넣어 ${TAX_PARAMS.majorShareholder.valueThreshold / 100_000_000}억원·시장별 지분율 기준에 해당하는지, 여유분이 얼마인지 확인합니다.`,
  },
];
