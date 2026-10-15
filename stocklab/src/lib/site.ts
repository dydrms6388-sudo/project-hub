export const SITE = {
  name: "스톡랩",
  nameEn: "StockLab",
  tagline: "데이터로 찾고, 시뮬레이션으로 검증하고, 알림으로 놓치지 않는 개인 투자자용 도구",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://stocklab.tomatoeggcat.com",
  parent: { name: "TomatoEggCat", url: "https://tomatoeggcat.com" },
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-5567719201265106",
  contactEmail: "contact@tomatoeggcat.com",
  /** 모든 화면 하단 필수 면책 문구 — 문구 변경 시 docs/00-legal-expression-guide.md 동기화 */
  disclaimer:
    "본 서비스는 투자 판단의 참고 자료이며, 투자 결과에 대한 책임은 투자자 본인에게 있습니다. 스톡랩은 특정 종목의 매매를 권유하지 않으며, 제공되는 정보는 조건 기반 스크리닝 결과와 계산 결과입니다.",
  dataDisclaimer: "시세는 전일 종가 기준 지연 데이터이며, 재무 지표는 공시(DART) 기준 최신 사업·분기보고서를 바탕으로 일 1회 갱신됩니다.",
} as const;

export interface ToolMeta {
  href: string;
  label: string;
  desc: string;
  group: "찾기" | "검증" | "계산" | "시장";
  isNew?: boolean;
}

/** 전체 도구 레지스트리 — 헤더 메뉴 · /tools · 사이트맵 · 랜딩이 공유하는 단일 소스 */
export const TOOLS: ToolMeta[] = [
  { href: "/screener/value", label: "저평가 스크리너", desc: "PER·PBR·ROE·부채비율 조건으로 종목을 걸러냅니다.", group: "찾기" },
  { href: "/screener/dividend", label: "고배당 스크리너", desc: "배당수익률·연속배당연수·배당성향 조건 필터.", group: "찾기" },
  { href: "/today", label: "오늘의 주식", desc: "매일 06:00 기본 전략으로 선정된 조건 충족 종목 1개.", group: "찾기" },
  { href: "/check", label: "종목 팩트체크", desc: "종목 하나를 밸류에이션·재무·변동성·배당 숫자와 확인 항목으로 정리.", group: "검증", isNew: true },
  { href: "/dca", label: "적립식 타임머신", desc: "N년 전부터 매달 샀다면? 실제 주가 기반 적립식 vs 거치식.", group: "검증", isNew: true },
  { href: "/portfolio/xray", label: "포트폴리오 X-ray", desc: "섹터 편중·집중도(HHI)·상관관계·가중 밸류에이션.", group: "검증", isNew: true },
  { href: "/calc/compound", label: "복리 계산기", desc: "원금·월 적립·수익률·기간으로 미래 자산 계산.", group: "계산" },
  { href: "/dividend/planner", label: "배당 현금흐름 설계", desc: "월별 배당 캘린더와 '월 100만원 배당' 역산.", group: "계산", isNew: true },
  { href: "/plan/goal", label: "목표 역산 플래너", desc: "목표 금액까지 필요한 월 적립액과 달성 확률 시뮬레이션.", group: "계산", isNew: true },
  { href: "/calc/tax", label: "투자 세금 계산기", desc: "해외주식 양도세 손익통산·금융소득종합과세·ISA 비교·대주주 요건.", group: "계산", isNew: true },
  { href: "/market", label: "시장 온도계", desc: "코스피·코스닥 밸류에이션 분포를 숫자로.", group: "시장", isNew: true },
];

export const TOOL_GROUPS = (["찾기", "검증", "계산", "시장"] as const).map((g) => ({ label: g, items: TOOLS.filter((t) => t.group === g) }));

/** 헤더 1차 메뉴 */
export const NAV = [
  { href: "/screener/value", label: "스크리너" },
  { href: "/check", label: "팩트체크" },
  { href: "/dca", label: "타임머신" },
  { href: "/calc/compound", label: "계산기" },
  { href: "/tools", label: "전체 도구" },
] as const;

export function absUrl(path: string): string {
  return `${SITE.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
