import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { SITE, TOOL_GROUPS, TOOLS, absUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "전체 도구 — 스크리너·팩트체크·타임머신·계산기·시장 온도계",
  description: "스톡랩의 모든 무료 주식 데이터 도구를 한 곳에서. 종목 찾기, 검증, 계산, 시장 지표 4개 그룹.",
  alternates: { canonical: "/tools" },
};

const GROUP_DESC: Record<string, string> = {
  찾기: "조건으로 종목을 걸러내고, 매일 조건 충족 종목을 확인합니다.",
  검증: "들은 종목·내 포트폴리오·적립 계획을 데이터로 검증합니다.",
  계산: "복리·배당·목표·세금을 숫자로 계산합니다.",
  시장: "시장 전체의 밸류에이션 분포를 봅니다.",
};

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ href: "/tools", label: "전체 도구" }]} />
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">전체 도구</h1>
        <p className="text-muted">{SITE.name}의 도구 {TOOLS.length}개. 모두 무료이며 회원가입 없이 사용할 수 있습니다. 추천이 아닌 데이터·계산 결과만 제공합니다.</p>
      </header>
      {TOOL_GROUPS.map((g) => (
        <section key={g.label} aria-labelledby={`g-${g.label}`} className="space-y-3">
          <div>
            <h2 id={`g-${g.label}`} className="text-lg font-bold">{g.label}</h2>
            <p className="text-sm text-muted">{GROUP_DESC[g.label]}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="card block h-full transition-colors hover:border-brand/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.label}</span>
                    {t.isNew && <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">NEW</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{t.desc}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "CollectionPage", name: "스톡랩 전체 도구", url: absUrl("/tools"),
        hasPart: TOOLS.map((t) => ({ "@type": "SoftwareApplication", name: t.label, url: absUrl(t.href), applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: 0, priceCurrency: "KRW" } })),
      }} />
    </div>
  );
}
