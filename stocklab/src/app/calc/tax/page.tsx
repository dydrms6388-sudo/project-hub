import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { Disclaimer } from "@/components/Disclaimer";
import { SITE, absUrl } from "@/lib/site";
import { TAX_PARAMS } from "@/lib/tax";
import { fmtManWon } from "@/lib/compound";
import { BASE_YEAR, REVIEW_ITEMS, TAX_TOOLS, faqJsonLd, type FaqItem } from "./_components/params";

const PATH = "/calc/tax";
const TITLE = "투자 세금 계산기 — 해외주식 양도세·금융소득종합과세·ISA·대주주 요건";
const DESC = `해외주식 양도세 손익통산, 금융소득종합과세 2,000만원 경계, ISA·연금저축 세후 자산 비교, 대주주 요건 체크를 한곳에서 계산합니다. ${BASE_YEAR}년 세법 기준의 참고용 계산이며 세무 상담이 아닙니다.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} | ${SITE.name}`, description: DESC, url: absUrl(PATH), type: "website" },
  twitter: { card: "summary_large_image", title: `${TITLE} | ${SITE.name}`, description: DESC },
};

const FAQ: FaqItem[] = [
  {
    q: "투자로 내는 세금은 크게 몇 종류인가요?",
    a: "개인 투자자가 만나는 세금은 대체로 세 갈래입니다. ① 판 차익에 붙는 양도소득세(해외주식·국내 대주주·파생상품), ② 받은 돈에 붙는 배당소득세·이자소득세(원천징수 15.4%, 연 2,000만원 초과 시 종합과세), ③ 팔 때 거래 자체에 붙는 증권거래세(국내 상장주식 매도 시)입니다. 이 허브의 계산기는 ①과 ②, 그리고 이를 줄이는 절세계좌를 다룹니다.",
  },
  {
    q: "국내 상장주식을 팔아 이익이 나면 세금을 내나요?",
    a: `소액주주가 장내에서 거래하는 국내 상장주식의 매매차익은 현재 양도소득세 과세 대상이 아닙니다. 다만 대주주에 해당하면 과세되고, 장외거래·비상장주식은 소액주주도 과세 대상입니다. 대주주 해당 여부는 종목당 보유액 ${TAX_PARAMS.majorShareholder.valueThreshold / 100_000_000}억원 또는 시장별 지분율 기준으로 판정하며, 대주주 요건 체크 계산기에서 확인할 수 있습니다.`,
  },
  {
    q: "해외주식은 이익이 조금만 나도 신고해야 하나요?",
    a: `해외주식 양도차익은 연간 손익을 통산한 뒤 기본공제 ${TAX_PARAMS.overseas.basicDeduction / 10_000}만원을 빼고 남은 금액에 ${TAX_PARAMS.overseas.ratePct}%(양도소득세 20% + 지방소득세 2%)를 부과합니다. 공제 후 과세표준이 0이라 낼 세금이 없더라도 양도가 있었다면 확정신고 대상이라는 것이 일반적인 해석이므로, 증권사 신고 대행 서비스나 홈택스에서 확인해 주세요.`,
  },
  {
    q: "배당을 많이 받으면 무조건 세금이 늘어나나요?",
    a: `연간 이자·배당 합계가 ${TAX_PARAMS.comprehensive.threshold / 10_000}만원 이하이면 15.4% 원천징수로 납세가 끝납니다. 초과분만 다른 종합소득과 합산되어 누진세율을 적용받고, 이때도 원천징수로 이미 낸 세액보다 적게 나올 수는 없도록 비교과세를 합니다. 즉 경계를 넘는 순간 전체 배당의 세금이 뛰는 것이 아니라 초과분에 대해 추가 부담이 생기는 구조입니다.`,
  },
  {
    q: "절세계좌는 무엇을 먼저 채우는 게 좋나요?",
    a: "정답은 사람마다 다릅니다. 세액공제가 필요한지(연말정산 환급), 돈을 언제 꺼내 쓸 것인지(ISA 의무가입 3년, 연금저축 55세), 수익 중 과세 대상 비중이 얼마인지에 따라 유리한 순서가 바뀝니다. ISA 비교 계산기에서 같은 조건을 세 계좌에 넣고 세후 자산 차이를 직접 확인한 뒤, 본인의 자금 사용 시점과 맞춰 판단하시기 바랍니다. 스톡랩은 특정 상품 가입을 권유하지 않습니다.",
  },
  {
    q: "계산 결과를 그대로 신고에 써도 되나요?",
    a: `아닙니다. 이 계산기들은 ${BASE_YEAR}년 세법 기준의 단순화된 참고 계산입니다. 실제 신고에서는 취득가액 계산 방식(선입선출·이동평균), 환율 적용 시점, 필요경비, 감면·공제, 다른 소득과의 관계 등에 따라 세액이 달라집니다. 세무 상담이 아니며, 최종 세액은 세무 전문가 또는 홈택스에서 확인해 주세요.`,
  },
  {
    q: "입력한 금액이 저장되나요?",
    a: "저장하지 않습니다. 모든 계산은 브라우저 안에서 이루어지고, 입력값은 주소창 URL 쿼리에만 반영됩니다. 실명·주민등록번호·계좌번호 같은 민감정보는 아예 입력받지 않으며, 계산 결과 링크를 공유하면 받는 사람도 같은 숫자를 볼 수 있으니 금액을 노출하고 싶지 않다면 링크 공유를 피하시기 바랍니다.",
  },
];

const OVERVIEW = [
  {
    kind: "양도소득 (판 차익)",
    scope: "해외주식·국내 대주주·비상장",
    rate: `해외주식 ${TAX_PARAMS.overseas.ratePct}%`,
    deduction: `연 ${TAX_PARAMS.overseas.basicDeduction / 10_000}만원 기본공제`,
    when: `${TAX_PARAMS.overseas.filingPeriod} 확정신고`,
    note: "같은 해 안에서만 손익통산, 이월공제 없음",
  },
  {
    kind: "배당소득 (받은 돈)",
    scope: "국내외 주식·ETF 분배금",
    rate: `원천징수 ${TAX_PARAMS.withholding.totalPct}%`,
    deduction: `이자와 합쳐 연 ${TAX_PARAMS.comprehensive.threshold / 10_000}만원까지 분리과세`,
    when: "초과 시 다음 해 5월 종합소득세 신고",
    note: "초과분은 다른 소득과 합산해 누진세율",
  },
  {
    kind: "이자소득 (받은 돈)",
    scope: "예금·채권·파킹통장",
    rate: `원천징수 ${TAX_PARAMS.withholding.totalPct}%`,
    deduction: "배당과 합산해 같은 경계 적용",
    when: "초과 시 다음 해 5월 종합소득세 신고",
    note: "배당가산(Gross-up) 대상이 아님",
  },
] as const;

export default function TaxHubPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${SITE.name} 투자 세금 계산기`,
      url: absUrl(PATH),
      description: DESC,
      inLanguage: "ko-KR",
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
      about: { "@type": "Thing", name: "대한민국 개인 투자자 세금" },
      hasPart: TAX_TOOLS.map((t) => ({
        "@type": "SoftwareApplication",
        name: t.label,
        url: absUrl(t.href),
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: t.desc,
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      })),
    },
    faqJsonLd(FAQ),
  ];

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ href: "/tools", label: "계산기" }, { href: PATH, label: "투자 세금" }]} />
      <JsonLd data={jsonLd} />

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">투자 세금 계산기</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          해외주식을 팔았을 때, 배당이 늘어났을 때, 절세계좌를 고를 때 필요한 숫자를 계산기 4개로 나눠 정리했습니다.
          모두 브라우저 안에서 계산되며 입력값을 서버에 보내지 않습니다. {BASE_YEAR}년 세법 기준의 참고용 계산이고 세무 상담이 아니므로,
          실제 신고 세액은 세무 전문가 상담이나 홈택스에서 확인해 주세요.
        </p>
      </header>

      <section aria-label="세금 계산기 목록" className="grid gap-3 sm:grid-cols-2">
        {TAX_TOOLS.map((t) => (
          <Link key={t.href} href={t.href}
            className="card group transition-colors hover:border-brand/50 hover:bg-surface-2">
            <h2 className="text-base font-bold group-hover:text-brand">{t.label}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">{t.desc}</p>
            <span aria-hidden className="mt-3 inline-block text-xs font-semibold text-brand">계산하러 가기 →</span>
          </Link>
        ))}
      </section>

      <article className="prose-kr max-w-3xl">
        <h2 id="overview">투자 세금 3종 개괄</h2>
        <p>
          투자로 생기는 소득은 세법에서 크게 <strong>양도소득</strong>(자산을 팔아 남긴 차익)과 <strong>배당소득·이자소득</strong>(보유하는 동안 받은 돈)으로 나뉩니다.
          두 갈래는 세율도, 신고 시점도, 손실을 반영하는 방식도 다릅니다. 양도소득은 같은 해 안에서 이익과 손실을 합칠 수 있지만,
          배당·이자는 손실이라는 개념 자체가 없어 받은 금액 전부가 과세 대상이 됩니다.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">주요 대상</th>
                <th scope="col">세율</th>
                <th scope="col">공제·경계</th>
                <th scope="col">신고 시점</th>
              </tr>
            </thead>
            <tbody>
              {OVERVIEW.map((o) => (
                <tr key={o.kind}>
                  <th scope="row" className="whitespace-nowrap">{o.kind}</th>
                  <td>{o.scope}</td>
                  <td className="tnum whitespace-nowrap">{o.rate}</td>
                  <td className="tnum">{o.deduction}</td>
                  <td>{o.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {OVERVIEW.map((o) => (
            <li key={o.kind}><strong>{o.kind}</strong> — {o.note}</li>
          ))}
        </ul>
        <p>
          여기에 국내 상장주식을 <em>팔 때</em> 붙는 증권거래세가 별도로 있습니다. 이익이 났든 손실이 났든 매도 금액에 정률로 부과되므로,
          이 허브의 계산기에서는 다루지 않습니다. 매매 회전이 잦다면 세금보다 거래비용의 누적이 더 큰 변수가 되기도 합니다.
        </p>

        <h2 id="which">어떤 계산기를 먼저 열어야 할까</h2>
        <ul>
          <li><strong>12월에 해외주식 평가손익을 정리하는 중</strong>이라면 <Link href="/calc/tax/overseas">해외주식 양도세 손익통산</Link>부터. 기본공제 여유분과, 손실 종목을 실현했을 때 줄어드는 세액을 종목별로 봅니다.</li>
          <li><strong>배당이 늘어 경계가 신경 쓰인다면</strong> <Link href="/calc/tax/financial-income">금융소득종합과세 경계 계산기</Link>. 연 {fmtManWon(TAX_PARAMS.comprehensive.threshold)}까지 남은 금액과 초과 시 추가 부담을 계산합니다.</li>
          <li><strong>계좌를 새로 만들지 고민 중</strong>이라면 <Link href="/calc/tax/isa">ISA vs 일반계좌 vs 연금저축</Link>. 같은 납입액을 세 계좌에 굴렸을 때의 세후 자산 차이를 봅니다.</li>
          <li><strong>한 종목 비중이 크게 늘었다면</strong> <Link href="/calc/tax/major-shareholder">대주주 요건 체크</Link>. 연말 기준으로 보유액·지분율이 기준에 닿는지 확인합니다.</li>
        </ul>

        <h2 id="caution">주의 — 기준연도와 확인 필요 항목</h2>
        <p>
          이 페이지의 모든 계산은 <strong>{BASE_YEAR}년 세법 기준</strong>입니다. 세법은 매년 바뀌고, 시행령·시행규칙은 연중에도 개정됩니다.
          아래 항목은 코드 안에서 &quot;확인 필요&quot;로 표시해 둔 값으로, 개정 여부에 따라 계산 결과가 달라질 수 있습니다.
        </p>
        <ul>
          {REVIEW_ITEMS.map((r) => (
            <li key={r.title}><strong>{r.title}</strong> — {r.body}</li>
          ))}
        </ul>
        <p>
          또한 이 계산기들은 공통적으로 다음을 반영하지 않습니다: 취득가액 산정 방식(선입선출·이동평균)과 증권사별 처리 차이, 매매 시점 환율과 결제일(T+2) 차이,
          매매 수수료·거래세 등 필요경비, 지방소득세 신고 절차, 다른 소득·공제와의 상호작용, 국가별 조세조약에 따른 외국납부세액공제.
          <strong> 세무 상담이 아니며 참고 자료입니다.</strong>
        </p>

        <h2 id="faq">자주 묻는 질문</h2>
        <div className="not-prose divide-y divide-border rounded-2xl border border-border">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3 [&_summary]:cursor-pointer">
              <summary className="font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm leading-7 text-fg/90">{f.a}</p>
            </details>
          ))}
        </div>

        <p className="text-sm text-muted">
          함께 보기: <Link href="/calc/compound">복리 계산기</Link> · <Link href="/dividend/planner">배당 현금흐름 설계</Link> · <Link href="/screener/dividend">고배당 스크리너</Link> · <Link href="/disclaimer">면책 고지</Link>
        </p>
      </article>

      <Disclaimer />
    </div>
  );
}
