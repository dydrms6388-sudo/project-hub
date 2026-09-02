import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { EmptyState } from "@/components/EmptyState";
import { SampleBanner } from "@/components/SampleBanner";
import { AdSlot } from "@/components/AdSlot";
import { Disclaimer } from "@/components/Disclaimer";
import { getDataSource } from "@/lib/data";
import { fmtEok, fmtPct, fmtWon } from "@/lib/format";
import { absUrl } from "@/lib/site";
import { ANON_DAILY_LIMIT, consumeScreenerUsage } from "@/lib/usage";
import type { DividendRow, UsageResult } from "@/lib/types";
import {
  DIVIDEND_LIMITS,
  DIVIDEND_PATH,
  DIVIDEND_PRESETS,
  DIVIDEND_SORTS,
  MARKETS,
  describeDividendFilters,
  dividendHref,
  isRun,
  matchDividendPreset,
  parseDividendFilters,
  type SearchParams,
} from "@/lib/screener-params";
import { PresetRow } from "../_components/PresetRow";
import { ResultSummary } from "../_components/ResultSummary";
import { StockLink } from "../_components/StockLink";
import { UsageExhausted } from "../_components/UsageExhausted";
import { Faq, type FaqItem } from "../_components/Faq";
import { DATA_LABEL, MARKET_LABEL } from "../_components/utils";

export const dynamic = "force-dynamic";

const TITLE = "고배당 주식 스크리너 — 배당수익률·연속배당·배당성향 조건 검색";
const DESCRIPTION =
  "배당수익률 하한, 연속배당연수, 배당성향 상한 조건으로 국내 상장 종목 중 조건 충족 종목을 찾는 무료 스크리너입니다. 전일 종가 기준 지연 시세와 공시 배당 데이터를 사용합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: DIVIDEND_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: DIVIDEND_PATH },
};

const RESULT_LIMIT = 100;

const FAQ: FaqItem[] = [
  {
    q: "고배당 스크리너는 무엇을 하는 도구인가요?",
    a: "배당수익률 하한, 연속배당연수 하한, 배당성향 상한 세 가지 조건을 모두 충족하는 종목만 골라 표로 보여 주는 필터 도구입니다. 특정 종목을 고르거나 매매를 권유하는 기능은 없으며, 조건에 맞는 종목의 목록과 배당 지표를 제공합니다.",
  },
  {
    q: "배당수익률은 어떻게 계산되나요?",
    a: "최근 결산 기준 주당배당금(DPS)을 전일 종가로 나눈 값(%)입니다. 시세가 전일 종가 기준 지연 데이터이므로 장중 가격 변동은 반영되지 않으며, 다음 결산의 배당이 같은 금액으로 유지된다는 보장도 없습니다.",
  },
  {
    q: "배당락(예정)일이 '예상'으로 표시되는 이유는 무엇인가요?",
    a: "표시되는 배당락일은 직전 결산의 배당기준일 패턴과 공시 정보를 바탕으로 추정한 예상 일자입니다. 실제 배당기준일·배당락일은 기업 이사회 결의와 공시로 확정되므로, 반드시 DART 공시 원문으로 확인하셔야 합니다.",
  },
  {
    q: "배당성향 상한을 0으로 두면 어떻게 되나요?",
    a: "0은 '제한 없음'을 뜻합니다. 배당성향 값이 없거나 100%를 넘는 종목도 결과에 포함됩니다. 이익보다 많은 배당을 지급하는 종목을 걸러 내고 싶다면 70~80% 같은 상한을 입력하세요.",
  },
  {
    q: "연속배당연수는 어떻게 산정하나요?",
    a: "최근 결산연도부터 거슬러 올라가며 현금배당(DPS 0 초과)이 끊기지 않고 이어진 햇수입니다. 배당을 한 해라도 건너뛰면 그 지점에서 계산이 멈춥니다. 상장 기간이 짧은 종목은 실제 배당 이력이 더 길더라도 데이터 범위 안에서만 계산됩니다.",
  },
  {
    q: "스크리닝 결과는 투자 권유인가요?",
    a: "아닙니다. 스크리닝 결과는 사용자가 입력한 수치 조건을 기계적으로 적용한 필터 결과일 뿐이며, 특정 종목의 매매를 권유하지 않습니다. 배당은 기업 결정에 따라 줄거나 중단될 수 있고, 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있습니다.",
  },
];

export default async function DividendScreenerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseDividendFilters(sp);
  const run = isRun(sp);
  const source = getDataSource();
  const activePreset = matchDividendPreset(filters);

  let usage: UsageResult | null = null;
  let rows: DividendRow[] = [];
  let asOf: string | null = null;

  if (run) {
    usage = await consumeScreenerUsage("dividend");
    if (usage.allowed) {
      rows = await source.screenDividend(filters, RESULT_LIMIT);
      asOf = rows[0]?.as_of ?? (await source.dataAsOf());
    }
  } else {
    asOf = await source.dataAsOf();
  }

  const presets = DIVIDEND_PRESETS.map((p) => ({ key: p.key, label: p.label, description: p.description, href: dividendHref(p.filters) }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: DIVIDEND_PATH, label: "고배당 스크리너" }]} />

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">고배당 주식 스크리너</h1>
        <p className="text-sm text-muted">
          배당수익률 · 연속배당연수 · 배당성향 조건을 입력하면 조건 충족 종목을 표로 보여 드립니다. {DATA_LABEL}
          {asOf && <> · 데이터 기준일 <time dateTime={asOf}>{asOf}</time></>}
        </p>
      </header>

      <SampleBanner />

      {/* ── 필터 폼 (GET) ── */}
      <form method="get" action={DIVIDEND_PATH} className="card space-y-4" aria-labelledby="filter-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="filter-heading" className="text-base font-bold">필터 조건</h2>
          <Link href={DIVIDEND_PATH} className="text-xs text-muted hover:text-fg">기본값으로 초기화</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">배당수익률 하한 (%)</span>
            <input className="field tnum" type="number" name="yieldMin" inputMode="decimal" defaultValue={filters.yieldMin}
              min={DIVIDEND_LIMITS.yieldMin.min} max={DIVIDEND_LIMITS.yieldMin.max} step={DIVIDEND_LIMITS.yieldMin.step} required />
            <span className="mt-1 block text-xs text-muted">DPS ÷ 전일 종가 기준</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">연속배당연수 하한 (년)</span>
            <input className="field tnum" type="number" name="yearsMin" inputMode="numeric" defaultValue={filters.yearsMin}
              min={DIVIDEND_LIMITS.yearsMin.min} max={DIVIDEND_LIMITS.yearsMin.max} step={DIVIDEND_LIMITS.yearsMin.step} required />
            <span className="mt-1 block text-xs text-muted">끊김 없이 현금배당을 이어 온 햇수</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">배당성향 상한 (%)</span>
            <input className="field tnum" type="number" name="payoutMax" inputMode="numeric" defaultValue={filters.payoutMax}
              min={DIVIDEND_LIMITS.payoutMax.min} max={DIVIDEND_LIMITS.payoutMax.max} step={DIVIDEND_LIMITS.payoutMax.step} required />
            <span className="mt-1 block text-xs text-muted">0 = 제한 없음</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">시장</span>
            <select className="field" name="market" defaultValue={filters.market}>
              {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">정렬</span>
            <select className="field" name="sort" defaultValue={filters.sort}>
              {DIVIDEND_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <input type="hidden" name="run" value="1" />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary">스크리닝 실행</button>
          <span className="text-xs text-muted">실행 시 무료 조회 1회가 사용됩니다 (하루 {ANON_DAILY_LIMIT}회)</span>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted">프리셋으로 바로 실행</p>
          <PresetRow presets={presets} activeKey={activePreset} />
        </div>
      </form>

      {/* ── 결과 / 미리보기 ── */}
      {!run && (
        <section aria-labelledby="preview-heading" className="card bg-surface-2">
          <h2 id="preview-heading" className="text-sm font-bold">현재 조건 미리보기</h2>
          <p className="mt-1 text-sm text-muted">{describeDividendFilters(filters)}</p>
          <p className="mt-2 text-xs text-muted">
            아직 실행되지 않았습니다. 위 조건으로 <strong className="text-fg">스크리닝 실행</strong>을 누르시면 조건 충족 종목이 표로 표시되며,
            결과 화면 주소를 복사해 같은 조건을 공유할 수 있습니다.
          </p>
        </section>
      )}

      {run && usage && !usage.allowed && <UsageExhausted usage={usage} resetHref={DIVIDEND_PATH} />}

      {run && usage && usage.allowed && (
        <section aria-labelledby="results-heading" className="space-y-4">
          <h2 id="results-heading" className="sr-only">스크리닝 결과</h2>
          <ResultSummary count={rows.length} asOf={asOf} usage={usage} limit={RESULT_LIMIT} />
          <p className="text-xs text-muted">적용 조건: {describeDividendFilters(filters)}</p>

          {rows.length === 0 ? (
            <EmptyState
              title="조건 충족 종목이 없습니다"
              description="배당수익률 하한을 낮추거나 연속배당연수를 줄이고, 배당성향 상한을 0(제한 없음)으로 바꿔 보세요. 아래 프리셋으로 바로 다시 실행할 수도 있습니다."
              action={<PresetRow presets={presets} activeKey={activePreset} />}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[880px] text-sm">
                <caption className="sr-only">고배당 스크리너 조건 충족 종목 {rows.length}개 — {DATA_LABEL}</caption>
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left">종목</th>
                    <th scope="col" className="px-3 py-2 text-left">시장</th>
                    <th scope="col" className="px-3 py-2 text-left">섹터</th>
                    <th scope="col" className="px-3 py-2 text-right">현재가<span className="block font-normal">(전일 종가)</span></th>
                    <th scope="col" className="px-3 py-2 text-right">시가총액</th>
                    <th scope="col" className="px-3 py-2 text-right">DPS</th>
                    <th scope="col" className="px-3 py-2 text-right">배당수익률</th>
                    <th scope="col" className="px-3 py-2 text-right">배당성향</th>
                    <th scope="col" className="px-3 py-2 text-right">연속배당</th>
                    <th scope="col" className="px-3 py-2 text-right">배당락(예상)일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.code} className="hover:bg-surface-2/60">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-normal">
                        <StockLink code={r.code} name={r.name} />
                      </th>
                      <td className="px-3 py-2">{MARKET_LABEL[r.market] ?? r.market}</td>
                      <td className="px-3 py-2 text-muted">{r.sector ?? "–"}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtWon(r.price)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtEok(r.market_cap)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtWon(r.dps)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtPct(r.dividend_yield, 2)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtPct(r.payout_ratio)}</td>
                      <td className="tnum px-3 py-2 text-right">{r.consecutive_years}년</td>
                      <td className="tnum px-3 py-2 text-right">
                        {r.ex_dividend_date ? <time dateTime={r.ex_dividend_date}>{r.ex_dividend_date}</time> : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted">
            배당락(예상)일은 직전 결산 패턴 기반 추정치이며 실제 일정은 공시로 확정됩니다. 종목명을 누르면 외부 정보 페이지(네이버 금융)가 새 창으로 열립니다.
          </p>
          <Disclaimer compact />
          <AdSlot />
        </section>
      )}

      {/* ── 본문 콘텐츠 ── */}
      <article className="prose-kr max-w-3xl">
        <h2>고배당 스크리너란</h2>
        <p>
          고배당 스크리너는 국내 상장 종목의 배당 지표에 사용자가 정한 숫자 조건을 적용해, 조건을 모두 충족하는 종목만 골라내는 도구입니다.
          배당수익률만 높은 종목은 주가가 크게 내려 수익률이 일시적으로 높아진 경우도 있기 때문에, 연속배당연수와 배당성향을 함께 조건으로 걸어 배당의 지속 가능성을 같이 보도록 설계했습니다.
          결과는 조건 충족 목록일 뿐, 특정 종목이 앞으로도 같은 배당을 유지한다는 판단은 아닙니다.
        </p>

        <h2>지표 설명</h2>
        <h3>배당수익률</h3>
        <p>
          최근 결산 주당배당금(DPS)을 전일 종가로 나눈 비율(%)입니다. 가격이 내리면 수익률은 올라가므로, 수익률이 유난히 높다면 주가 하락 원인을 먼저 확인하는 것이 좋습니다.
          한계: 과거 배당을 기준으로 하므로 다음 결산 배당이 줄거나 없어질 가능성은 반영되지 않습니다.
        </p>
        <h3>DPS (주당배당금)</h3>
        <p>
          한 주당 지급된 현금배당 금액(원)입니다. 중간·분기배당을 시행하는 기업은 연간 합산 금액을 사용합니다.
          한계: 특별배당이 포함된 해는 평년보다 크게 나올 수 있습니다.
        </p>
        <h3>배당성향</h3>
        <p>
          배당 총액을 순이익으로 나눈 비율(%)입니다. 이익 중 얼마를 주주에게 배당으로 돌려주는지 보여 주며, 100%를 넘으면 이익보다 많은 배당을 지급했다는 뜻입니다.
          한계: 순이익이 일시적으로 줄면 배당성향이 급격히 높아질 수 있어 단년도 수치만으로 판단하기 어렵습니다.
        </p>
        <h3>연속배당연수</h3>
        <p>
          현금배당을 끊김 없이 이어 온 햇수입니다. 배당 정책의 일관성을 보는 간접 지표입니다.
          한계: 배당 금액의 증감은 반영하지 않으며(같은 금액을 유지해도 연수는 늘어남), 데이터 보유 기간을 넘는 이력은 계산되지 않습니다.
        </p>
        <h3>배당락(예상)일</h3>
        <p>
          배당을 받을 권리가 사라지는 첫 거래일의 예상 일자입니다. 직전 결산의 배당기준일 패턴으로 추정한 값이므로 실제 일정과 다를 수 있고, 기업 공시로만 확정됩니다.
        </p>

        <h2>사용법 3단계</h2>
        <ol>
          <li><strong>조건 입력</strong> — 배당수익률 하한, 연속배당연수 하한, 배당성향 상한(0 = 제한 없음)을 입력하고 시장·정렬을 고릅니다. 프리셋을 누르면 자주 쓰는 조합이 자동 입력·실행됩니다.</li>
          <li><strong>스크리닝 실행</strong> — 실행 버튼을 누르면 조건 충족 종목이 표로 나옵니다(최대 {RESULT_LIMIT}개). 비로그인 사용자는 하루 {ANON_DAILY_LIMIT}회 실행할 수 있습니다.</li>
          <li><strong>결과 확인·공유</strong> — 종목명을 눌러 외부 정보 페이지에서 배당 공시를 확인하고, "조건 링크 복사"로 같은 조건을 저장·공유하세요.</li>
        </ol>

        <h2>함께 보면 좋은 도구</h2>
        <ul>
          <li><Link href="/screener/value">저평가 스크리너</Link> — PER·PBR·ROE·부채비율 조건으로 스크리닝</li>
          <li><Link href="/today">오늘의 조건 충족 종목</Link> — 매일 자동 로테이션되는 전략 조건과 그 결과 1종목</li>
        </ul>

        <Faq items={FAQ} />
      </article>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "스톡랩 고배당 주식 스크리너",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url: absUrl(DIVIDEND_PATH),
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
          inLanguage: "ko",
        }}
      />
    </div>
  );
}
