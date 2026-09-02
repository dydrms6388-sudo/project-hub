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

export const NAV = [
  { href: "/screener/value", label: "저평가 스크리너" },
  { href: "/screener/dividend", label: "고배당 스크리너" },
  { href: "/calc/compound", label: "복리 계산기" },
  { href: "/today", label: "오늘의 주식" },
  { href: "/about", label: "소개" },
] as const;

export function absUrl(path: string): string {
  return `${SITE.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
