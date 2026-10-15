import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { SITE, absUrl } from "@/lib/site";
import {
  DEFAULT_INPUT,
  decodeParams,
  fmtManWon,
  fmtWonFull,
  ruleOf72,
  exactDoublingYears,
  simulate,
  type SearchParamsLike,
} from "@/lib/compound";
import { CompoundCalculator } from "../_components/CompoundCalculator";

const PATH = "/calc/compound";
const TITLE = "복리 계산기 — 원금·월 적립·수익률·기간으로 미래 자산 계산";
const DESC =
  "원금·월 적립액·연 수익률·기간을 넣으면 연도별 자산 성장과 총 이자를 즉시 계산합니다. 월복리/연복리, 기초/기말 적립, 세금·물가 옵션, 목표 금액 역산, 72의 법칙까지. 결과는 링크로 공유할 수 있습니다.";

const SHARE_KEYS = ["p", "m", "r", "y", "c", "t", "i", "x"] as const;

function hasShareParams(sp: SearchParamsLike): boolean {
  return SHARE_KEYS.some((k) => sp[k] !== undefined);
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParamsLike> }): Promise<Metadata> {
  const sp = await searchParams;
  let description = DESC;
  if (hasShareParams(sp)) {
    const res = simulate(decodeParams(sp));
    const i = res.input;
    description = `원금 ${fmtManWon(i.principal)} · 월 ${fmtManWon(i.monthly)} · 연 ${i.annualRatePct}% · ${i.years}년 가정 시 최종 자산 ${fmtManWon(res.totals.balance)} (총 투자원금 ${fmtManWon(res.totals.invested)}). 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다.`;
  }
  return {
    title: TITLE,
    description,
    alternates: { canonical: PATH },
    openGraph: { title: `${TITLE} | ${SITE.name}`, description, url: absUrl(PATH), type: "website" },
    twitter: { card: "summary_large_image", title: `${TITLE} | ${SITE.name}`, description },
  };
}

const EXAMPLES = [
  { label: "월 30만원 · 20년 · 연 7%", input: { principal: 0, monthly: 300_000, annualRatePct: 7, years: 20 } },
  { label: "1억원 거치 · 10년 · 연 5%", input: { principal: 100_000_000, monthly: 0, annualRatePct: 5, years: 10 } },
  { label: "원금 1,000만원 + 월 50만원 · 30년 · 연 8%", input: { principal: 10_000_000, monthly: 500_000, annualRatePct: 8, years: 30 } },
] as const;

const FAQ: { q: string; a: string }[] = [
  {
    q: "복리 계산기는 어떤 공식으로 계산하나요?",
    a: "거치 원금은 A = P × (1 + r/n)^(n×t) 로, 월 적립액은 매월(월복리) 또는 매년(연복리) 입금 후 같은 이율로 굴리는 방식으로 누적합니다. 연도별 표의 잔액은 이 계산을 매 기간 반복한 결과이며, 반올림은 표시 단계에서만 합니다.",
  },
  {
    q: "월복리와 연복리는 어떤 차이가 있나요?",
    a: "월복리는 연 수익률을 12로 나눈 이율을 매월 적용해 이자가 이자를 낳는 횟수가 많고, 연복리는 1년에 한 번 적용합니다. 같은 연 수익률이라면 월복리 결과가 약간 더 크며, 기간이 길수록 차이가 벌어집니다. 실제 상품·투자 방식에 맞는 주기를 선택하세요.",
  },
  {
    q: "적립 시점의 기초와 기말은 무엇인가요?",
    a: "기초(선납)는 매 기간이 시작될 때 입금해 그 기간의 이자를 받는 방식이고, 기말(후납)은 기간이 끝날 때 입금해 그 기간 이자를 받지 않는 방식입니다. 월급 받은 뒤 바로 적립하면 기초에 가깝고, 월말 결제 뒤 남는 금액을 넣으면 기말에 가깝습니다.",
  },
  {
    q: "세금은 어떻게 반영되나요?",
    a: "고급 옵션에서 세율을 켜면 최종 누적 이자(수익)에 세율을 한 번 곱해 빼는 단순 계산을 합니다. 기본값은 국내 이자·배당소득 원천징수 세율 15.4%(소득세 14% + 지방소득세 1.4%)입니다. 비과세 상품, 분리과세, 금융소득종합과세, 주식 양도소득세 등 실제 과세 체계는 반영하지 않습니다.",
  },
  {
    q: "물가상승률을 넣으면 무엇이 달라지나요?",
    a: "실질가치 카드가 추가됩니다. 최종 잔액을 (1 + 물가상승률)^기간 으로 나눠 '지금 돈으로 얼마인지'를 보여 줍니다. 명목 금액이 커 보여도 물가를 반영하면 구매력은 그보다 작을 수 있습니다.",
  },
  {
    q: "72의 법칙은 무엇인가요?",
    a: "72를 연 수익률(%)로 나누면 자산이 2배가 되는 데 걸리는 연수를 어림할 수 있는 방법입니다. 예를 들어 연 6%면 약 12년, 연 8%면 약 9년입니다. 정확한 값은 ln2 ÷ ln(1 + r) 이며, 이 계산기는 두 값을 모두 표시합니다.",
  },
  {
    q: "계산 결과대로 실제 자산이 늘어나나요?",
    a: "아닙니다. 이 계산기는 입력한 수익률이 매년 일정하게 유지된다는 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다. 실제 투자는 수익률이 매년 변동하고 손실이 날 수도 있으며, 수수료·거래비용·세금이 발생합니다. 참고용 시나리오 비교 도구로만 사용하세요.",
  },
  {
    q: "입력값이 URL에 담기는데 개인정보가 저장되나요?",
    a: "아닙니다. 입력한 금액·수익률·기간은 브라우저 주소창(URL 쿼리)에만 반영되며 서버에 저장하지 않습니다. 링크를 공유하면 받는 사람이 같은 조건의 결과를 볼 수 있습니다. 실명·계좌 등 민감정보는 입력받지 않습니다.",
  },
];

export default async function CompoundPage({ searchParams }: { searchParams: Promise<SearchParamsLike> }) {
  const sp = await searchParams;
  const shared = hasShareParams(sp);
  const initial = shared ? decodeParams(sp) : DEFAULT_INPUT;

  const examples = EXAMPLES.map((e) => ({ ...e, result: simulate({ ...e.input, compounding: "monthly", contributionTiming: "end" }) }));
  const ex0 = examples[0];
  const doubling = [3, 5, 7, 10, 12].map((r) => ({ r, approx: ruleOf72(r), exact: exactDoublingYears(r) }));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${SITE.name} 복리 계산기`,
      url: absUrl(PATH),
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: DESC,
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      publisher: { "@type": "Organization", name: SITE.parent.name, url: SITE.parent.url },
      featureList: ["월복리/연복리 선택", "기초/기말 적립 시점", "세금·물가 옵션", "연도별 표와 차트", "목표 금액 역산", "결과 링크 공유·PNG 저장"],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "복리 계산기로 미래 자산 계산하기",
      step: [
        { "@type": "HowToStep", name: "원금 입력", text: "지금 가진 거치 원금을 입력합니다. 없으면 0으로 두어도 됩니다." },
        { "@type": "HowToStep", name: "월 적립액 입력", text: "매월 추가로 넣을 금액을 입력합니다." },
        { "@type": "HowToStep", name: "수익률·기간 설정", text: "연 수익률(%)과 기간(년)을 정합니다. 3·5·7·10% 칩으로 시나리오를 비교해 보세요." },
        { "@type": "HowToStep", name: "옵션 선택", text: "월복리/연복리, 적립 시점, 필요하면 세율과 물가상승률을 켭니다." },
        { "@type": "HowToStep", name: "결과 확인·공유", text: "최종 자산, 총 이자, 연도별 차트를 확인하고 링크 복사나 PNG 저장으로 공유합니다." },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ href: "/calc/compound", label: "복리 계산기" }]} />
      <JsonLd data={jsonLd} />

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">복리 계산기</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          원금·월 적립액·연 수익률·기간을 넣으면 연도별 자산 성장과 총 이자를 바로 계산합니다. 월복리/연복리, 적립 시점, 세금·물가 옵션과 목표 금액 역산을 지원하며,
          결과는 URL 에 담겨 링크만으로 공유됩니다. 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다.
        </p>
      </header>

      <CompoundCalculator initial={initial} shared={shared} />

      <article className="prose-kr max-w-3xl">
        <h2 id="what-is-compound">복리란 무엇인가</h2>
        <p>
          복리(compound interest)는 원금에 붙은 이자를 다시 원금에 더해 다음 기간의 이자를 계산하는 방식입니다. 이자가 이자를 낳기 때문에 기간이 길어질수록 자산은 직선이 아닌 곡선으로 늘어납니다.
          반대로 단리(simple interest)는 항상 최초 원금에만 이자를 붙입니다.
        </p>
        <h3>거치식(원금만) 공식</h3>
        <p className="tnum">
          <code>A = P × (1 + r/n)<sup>n×t</sup></code> — P 는 원금, r 은 연 수익률(소수), n 은 연간 복리 횟수(월복리 12, 연복리 1), t 는 기간(년)입니다.
          예를 들어 1,000만원을 연 5% 월복리로 10년 굴리면 A = 10,000,000 × (1 + 0.05/12)<sup>120</sup> ≈ {fmtWonFull(simulate({ principal: 10_000_000, monthly: 0, annualRatePct: 5, years: 10 }).totals.balance)} 입니다.
        </p>
        <h3>적립식(매월 입금) 공식</h3>
        <p className="tnum">
          매월 M 원을 기말에 넣는 경우 <code>FV = M × [((1 + i)<sup>N</sup> − 1) / i]</code> (i = r/12, N = 12t) 이고, 기초 적립이면 여기에 (1 + i) 를 한 번 더 곱합니다.
          이 계산기는 원금의 성장분과 적립액의 성장분을 합산해 연도별 잔액을 만듭니다. 이자율이 0% 이면 단순히 M × N 이 됩니다.
        </p>

        <h2 id="how-to">사용법</h2>
        <ol>
          <li><strong>원금</strong>과 <strong>월 적립액</strong>을 입력합니다. 칩(100만/1,000만/1억, 10만/30만/50만/100만)으로 빠르게 넣을 수 있습니다.</li>
          <li><strong>연 수익률</strong>과 <strong>기간</strong>을 정합니다. 3·5·7·10% 를 번갈아 눌러 시나리오를 비교해 보세요.</li>
          <li><strong>복리 주기</strong>(월/연)와 <strong>적립 시점</strong>(기초/기말)을 선택합니다.</li>
          <li>필요하면 <strong>고급 옵션</strong>에서 세율(기본 15.4%)과 물가상승률을 켜 세후·실질가치를 함께 봅니다.</li>
          <li>결과 카드와 차트, 연도별 표를 확인하고 <strong>링크 복사</strong>·<strong>PNG 저장</strong>으로 공유합니다. 주소창의 URL 자체가 결과 링크입니다.</li>
        </ol>

        <h2 id="examples">예시 3가지</h2>
        <p>아래 수치는 이 페이지의 계산 함수로 직접 산출한 값(월복리·기말 적립·세금/물가 미반영)입니다.</p>
        <div className="overflow-x-auto">
          <table className="tnum">
            <thead>
              <tr><th scope="col">조건</th><th scope="col">총 투자원금</th><th scope="col">총 이자(수익)</th><th scope="col">최종 자산</th><th scope="col">원금 대비</th><th scope="col">열기</th></tr>
            </thead>
            <tbody>
              {examples.map((e) => (
                <tr key={e.label}>
                  <td>{e.label}</td>
                  <td>{fmtManWon(e.result.totals.invested)}</td>
                  <td>{fmtManWon(e.result.totals.interest)}</td>
                  <td className="font-semibold">{fmtManWon(e.result.totals.balance)}</td>
                  <td>{e.result.totals.multiple.toFixed(2)}배</td>
                  <td><Link href={`${PATH}?p=${e.input.principal}&m=${e.input.monthly}&r=${e.input.annualRatePct}&y=${e.input.years}`}>계산기에 넣기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ex0 && (
          <p className="tnum">
            첫 번째 예시를 보면 20년간 넣은 돈은 {fmtManWon(ex0.result.totals.invested)} 이지만 최종 자산은 {fmtManWon(ex0.result.totals.balance)} 로,
            이자가 원금의 {ex0.result.totals.interestRatioPct.toFixed(0)}% 에 이릅니다. 기간을 30년으로 늘리면 {fmtManWon(simulate({ ...ex0.input, years: 30 }).totals.balance)} 이 되어
            마지막 10년이 앞의 20년보다 더 큰 증가분을 만듭니다. 이것이 복리에서 시간이 가장 중요한 변수라고 말하는 이유입니다.
          </p>
        )}

        <h2 id="rule-of-72">72의 법칙</h2>
        <p>
          72를 연 수익률(%)로 나누면 자산이 2배가 되는 데 걸리는 연수를 암산할 수 있습니다. 정확한 값은 ln2 ÷ ln(1 + r) 이며, 수익률이 6~10% 구간에서 오차가 가장 작습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="tnum">
            <thead><tr><th scope="col">연 수익률</th><th scope="col">72의 법칙</th><th scope="col">정확한 값</th></tr></thead>
            <tbody>
              {doubling.map((d) => (
                <tr key={d.r}><td>{d.r}%</td><td>{d.approx?.toFixed(1)}년</td><td>{d.exact?.toFixed(1)}년</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="lump-vs-monthly">적립식 vs 거치식</h2>
        <p>
          <strong>거치식</strong>은 처음에 큰 원금을 한 번 넣고 굴리는 방식으로, 전액이 전 기간 동안 복리 효과를 받습니다.
          <strong>적립식</strong>은 매월 나눠 넣기 때문에 뒤에 넣은 돈은 굴러가는 기간이 짧아 같은 총액이라도 거치식보다 최종 금액이 작습니다.
          대신 목돈이 없어도 시작할 수 있고, 매입 시점이 분산되어 특정 시점 가격에 대한 의존이 줄어듭니다. 이 계산기에서 원금 또는 월 적립액 중 하나를 0으로 두면 두 방식을 각각 확인할 수 있습니다.
        </p>

        <h2 id="caveats">물가·세금·수수료 주의</h2>
        <ul>
          <li><strong>물가</strong>: 20~30년 뒤의 명목 금액은 지금의 구매력과 다릅니다. 고급 옵션의 물가상승률(예: 2%)을 켜서 실질가치를 함께 보세요.</li>
          <li><strong>세금</strong>: 이자·배당에는 15.4% 원천징수가 일반적이며, 상품과 소득 규모에 따라 비과세·분리과세·종합과세가 달라집니다. 이 계산기는 최종 이자에 세율을 한 번 적용하는 단순 방식만 제공합니다.</li>
          <li><strong>수수료·거래비용</strong>: 펀드 보수, 매매 수수료, 거래세 등은 반영하지 않습니다. 장기간 누적되면 결과에 상당한 차이를 만듭니다.</li>
          <li><strong>변동성</strong>: 실제 수익률은 매년 다르고 손실이 나는 해도 있습니다. 일정한 수익률 가정은 평균적인 경로를 보여 주는 것일 뿐, 실제 자산 경로를 예측하는 것은 아닙니다.</li>
        </ul>

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
          함께 보기: <Link href="/screener/value">저평가 스크리너</Link> · <Link href="/screener/dividend">고배당 스크리너</Link> · <Link href="/today">오늘의 주식</Link> · <Link href="/disclaimer">면책 고지</Link>
        </p>
      </article>
    </div>
  );
}
