import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { SampleBanner } from "@/components/SampleBanner";
import { Disclaimer } from "@/components/Disclaimer";
import { getDataSource } from "@/lib/data";
import { absUrl } from "@/lib/site";
import { FLAG_RULES } from "@/lib/factcheck";
import { Faq, type FaqItem } from "../screener/_components/Faq";
import { DATA_LABEL, MARKET_LABEL } from "../screener/_components/utils";
import { CheckSearchBox } from "./_components/CheckSearchBox";

export const revalidate = 3600;

const PATH = "/check";
const TITLE = "종목 팩트체크 — 종목 하나를 숫자로 확인 (PER·PBR·ROE·변동성·배당)";
const DESCRIPTION =
  "종목명을 입력하면 밸류에이션·재무·변동성·배당 지표와 전체 대비 백분위, 공개된 기준으로 계산한 확인 항목을 한 화면에 정리합니다. 판단 문장이나 매매 권유 없이 숫자만 보여 드립니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH },
};

const FAQ: FaqItem[] = [
  {
    q: "종목 팩트체크는 무엇을 해 주는 도구인가요?",
    a: "종목 하나를 골라 밸류에이션(PER·PBR), 재무(ROE·부채비율), 변동성·수익률(20·60·250거래일 수익률, 52주 최고·최저 대비 위치, 60일 변동성), 배당(배당수익률·DPS·배당성향·연속배당연수)을 한 화면에 모아 보여 줍니다. 각 지표가 전체 상장 종목 중 어디쯤인지 백분위로 함께 표시합니다.",
  },
  {
    q: "종합 점수나 등급은 왜 없나요?",
    a: "여러 지표를 하나의 점수로 압축하면 가중치를 정하는 순간 그것이 곧 판단이 됩니다. 스톡랩은 판단·추천·목표가를 제시하지 않으며, 대신 지표 원값과 백분위, 그리고 공개된 임계값에 해당하는지 여부만 표시합니다. 해석은 이용자 몫입니다.",
  },
  {
    q: "'확인 항목'은 무슨 뜻인가요?",
    a: `조건 충족 여부를 알려 주는 표시입니다. 예를 들어 부채비율 200% 초과, ROE 음수, 최근 20거래일 등락폭 30% 이상처럼 미리 공개한 ${FLAG_RULES.length}가지 조건 중 해당하는 것만 나열합니다. 좋다·나쁘다는 뜻이 아니라 '이 조건에 해당하니 원문 공시로 직접 확인해 보시라'는 안내입니다.`,
  },
  {
    q: "데이터는 언제 기준인가요?",
    a: "시세는 전일 종가 기준 지연 데이터이며, 재무 지표는 DART 전자공시의 최신 사업·분기보고서를 바탕으로 하루 한 번 갱신됩니다. 각 종목 화면 상단에 데이터 기준일이 표시되고, 장중 실시간 시세는 제공하지 않습니다.",
  },
  {
    q: "공시 이력이나 신용잔고도 볼 수 있나요?",
    a: "아직 제공하지 않습니다. 최근 주요 공시 목록, 소액주주 비율, 신용잔고 추이는 별도 데이터 파이프라인이 연결된 뒤 추가할 예정이며, 그 전까지 화면에 빈 값이나 임의의 수치를 채워 넣지 않습니다.",
  },
  {
    q: "이 화면을 근거로 사도 되나요?",
    a: "이 도구는 특정 종목의 매매를 권유하지 않으며 가격 방향도 예측하지 않습니다. 표시되는 것은 공개 데이터로 계산한 지표와 조건 충족 여부뿐이고, 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있습니다.",
  },
];

const SHOW_TABLE: { group: string; metrics: string; basis: string }[] = [
  { group: "밸류에이션", metrics: "PER · PBR · 전체 백분위 · 업종 중앙값", basis: "DART 공시 재무 + 전일 종가" },
  { group: "재무", metrics: "ROE · 부채비율 · 전체 백분위", basis: "DART 최신 사업·분기보고서" },
  { group: "변동성 · 수익률", metrics: "20 · 60 · 250거래일 수익률 · 52주 최고·최저 대비 위치 · 60일 변동성(연율)", basis: "일별 종가 시계열" },
  { group: "배당", metrics: "배당수익률 · DPS · 배당성향 · 연속배당연수 · 배당락(예상)일", basis: "DART 배당 공시" },
  { group: "확인 항목", metrics: `공개된 ${FLAG_RULES.length}가지 조건 중 해당 항목`, basis: "위 지표로 계산" },
];

export default async function CheckLandingPage() {
  const source = getDataSource();
  const [stocks, asOf] = await Promise.all([source.listStocks(), source.dataAsOf()]);
  const quick = stocks.slice(0, 6);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: PATH, label: "종목 팩트체크" }]} />

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">종목 팩트체크</h1>
        <p className="text-sm text-muted">
          어디선가 이름만 들은 종목을, 판단 문장 없이 공개 데이터의 숫자와 확인 항목으로 30초 만에 확인해 보세요. {DATA_LABEL}
          {asOf && (
            <>
              {" "}· 데이터 기준일 <time dateTime={asOf}>{asOf}</time>
            </>
          )}
        </p>
      </header>

      <SampleBanner />

      <section className="card space-y-4" aria-labelledby="search-heading">
        <h2 id="search-heading" className="text-base font-bold">종목 검색</h2>
        <CheckSearchBox />
        {quick.length > 0 && (
          <div>
            <p className="text-xs text-muted">바로 확인해 보기</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {quick.map((s) => (
                <li key={s.code}>
                  <Link
                    href={`/check/${s.code}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                  >
                    {s.name}
                    <span className="tnum font-normal text-muted">{s.code}</span>
                    <span className="font-normal text-muted">{MARKET_LABEL[s.market] ?? s.market}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Disclaimer compact />

      <article className="prose-kr max-w-3xl">
        <h2>무엇을 보여 드리나요</h2>
        <p>
          종목을 하나 고르면 아래 다섯 묶음이 한 화면에 정리됩니다. 각 숫자 옆에는 전체 상장 종목 중 위치(백분위)를 함께 표시해,
          그 값이 시장에서 흔한 값인지 드문 값인지 바로 가늠할 수 있게 했습니다.
        </p>
        <div className="overflow-x-auto">
          <table>
            <caption className="sr-only">종목 팩트체크가 표시하는 지표 묶음</caption>
            <thead>
              <tr>
                <th scope="col">묶음</th>
                <th scope="col">표시 지표</th>
                <th scope="col">근거 데이터</th>
              </tr>
            </thead>
            <tbody>
              {SHOW_TABLE.map((r) => (
                <tr key={r.group}>
                  <th scope="row">{r.group}</th>
                  <td>{r.metrics}</td>
                  <td>{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>무엇을 하지 않나요</h2>
        <ul>
          <li>판단·추천·목표가를 제시하지 않습니다. 종합 점수, 등급, 별점도 만들지 않습니다.</li>
          <li>주가가 오를지 내릴지 예측하지 않으며, 매수·매도 시점을 알려 드리지 않습니다.</li>
          <li>어떤 커뮤니티·채널·개인의 이름도 언급하거나 평가하지 않습니다.</li>
          <li>데이터가 없는 항목은 빈칸(–)으로 두고, 그럴듯한 수치로 채우지 않습니다.</li>
        </ul>

        <h2>사용법</h2>
        <ol>
          <li>위 검색창에 종목명이나 6자리 코드를 입력하고 목록에서 종목을 고릅니다.</li>
          <li>밸류에이션 · 재무 · 변동성 · 배당 네 장의 카드에서 값과 백분위 막대를 확인합니다.</li>
          <li>&lsquo;확인 항목&rsquo;에 걸린 조건이 있으면 그 항목의 원문(공시·재무제표)을 직접 열어 확인합니다.</li>
          <li>비슷한 조건의 다른 종목이 궁금하면 화면 아래 스크리너 링크로 이어서 검색합니다.</li>
          <li>결과 화면 주소가 곧 결과입니다. 링크를 복사하거나 카드 이미지를 저장해 공유할 수 있습니다.</li>
        </ol>

        <h2>확인 항목의 기준</h2>
        <p>
          확인 항목은 사람이 그때그때 고르는 것이 아니라, 아래 조건에 해당하는지를 기계적으로 계산한 결과입니다.
          기준은 모든 종목에 동일하게 적용되며 화면 하단에 항상 공개됩니다.
        </p>
        <ul>
          {FLAG_RULES.slice(0, 6).map((r) => (
            <li key={r.key}>{r.text}</li>
          ))}
          <li>이 밖에 {FLAG_RULES.length - 6}가지 조건이 더 있으며, 전체 목록은 각 종목 화면 하단 표에서 볼 수 있습니다.</li>
        </ul>

        <Faq items={FAQ} />
      </article>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "스톡랩 종목 팩트체크",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url: absUrl(PATH),
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
          inLanguage: "ko",
        }}
      />
    </div>
  );
}
