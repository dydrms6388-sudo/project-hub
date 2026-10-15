import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { EmptyState } from "@/components/EmptyState";
import { SampleBanner } from "@/components/SampleBanner";
import { AdSlot } from "@/components/AdSlot";
import { Disclaimer } from "@/components/Disclaimer";
import { getDataSource } from "@/lib/data";
import { fmtEok, fmtNum, fmtPct, fmtWon } from "@/lib/format";
import { absUrl } from "@/lib/site";
import { ANON_DAILY_LIMIT, consumeScreenerUsage } from "@/lib/usage";
import type { ScreenRow, UsageResult } from "@/lib/types";
import {
  MARKETS,
  VALUE_LIMITS,
  VALUE_PATH,
  VALUE_PRESETS,
  VALUE_SORTS,
  describeValueFilters,
  isRun,
  matchValuePreset,
  parseValueFilters,
  valueHref,
  type SearchParams,
} from "@/lib/screener-params";
import { PresetRow } from "../_components/PresetRow";
import { ResultSummary } from "../_components/ResultSummary";
import { StockLink } from "../_components/StockLink";
import { UsageExhausted } from "../_components/UsageExhausted";
import { Faq, type FaqItem } from "../_components/Faq";
import { DATA_LABEL, MARKET_LABEL } from "../_components/utils";

export const dynamic = "force-dynamic";

const TITLE = "저평가 주식 스크리너 — PER·PBR·ROE·부채비율 조건 검색";
const DESCRIPTION =
  "PER, PBR, ROE, 부채비율 조건을 직접 입력해 국내 상장 종목 중 조건 충족 종목을 찾는 무료 스크리너입니다. 전일 종가 기준 지연 시세와 DART 공시 재무 지표를 사용합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: VALUE_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: VALUE_PATH },
};

const RESULT_LIMIT = 100;

const FAQ: FaqItem[] = [
  {
    q: "저평가 스크리너는 무엇을 하는 도구인가요?",
    a: "PER·PBR·ROE·부채비율 네 가지 재무 지표에 대해 사용자가 정한 상한·하한 조건을 모두 충족하는 종목만 골라 표로 보여 주는 필터 도구입니다. 특정 종목을 고르거나 매매를 권유하는 기능은 없으며, 조건에 맞는 종목의 목록과 지표 값을 제공합니다.",
  },
  {
    q: "데이터는 언제 기준인가요?",
    a: "시세는 전일 종가 기준 지연 데이터이며, 재무 지표는 DART 전자공시의 최신 사업·분기보고서를 바탕으로 하루 한 번 갱신됩니다. 결과 상단에 데이터 기준일이 함께 표시됩니다. 장중 실시간 시세는 제공하지 않습니다.",
  },
  {
    q: "조건 충족 종목이 0개로 나오면 어떻게 하나요?",
    a: "조건이 서로 엄격하게 겹치면 결과가 비는 경우가 있습니다. PER 또는 PBR 상한을 조금 올리거나 ROE 하한을 낮추고, 부채비율 상한을 넓혀 보세요. 프리셋 버튼을 누르면 검증된 조합으로 바로 다시 실행할 수 있습니다.",
  },
  {
    q: "하루에 몇 번 조회할 수 있나요?",
    a: "비로그인 사용자는 저평가 스크리너를 하루 5회 실행할 수 있으며, 매일 자정(KST)에 초기화됩니다. 폼 화면을 열거나 조건을 바꾸는 것만으로는 횟수가 소모되지 않고, 실행 버튼을 눌러 결과를 조회할 때만 1회로 계산됩니다.",
  },
  {
    q: "PER이 낮으면 항상 저평가인가요?",
    a: "그렇지 않습니다. 일회성 이익으로 PER이 일시적으로 낮아지거나, 업황이 꺾여 이익 감소가 예상될 때도 PER은 낮게 나옵니다. PER은 다른 지표(PBR, ROE, 부채비율)와 함께 보아야 하며, 스크리닝 결과는 추가 분석의 출발점으로만 활용하시길 권합니다.",
  },
  {
    q: "스크리닝 결과는 투자 권유인가요?",
    a: "아닙니다. 스크리닝 결과는 사용자가 입력한 수치 조건을 기계적으로 적용한 필터 결과일 뿐이며, 특정 종목의 매매를 권유하지 않습니다. 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있습니다.",
  },
];

export default async function ValueScreenerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseValueFilters(sp);
  const run = isRun(sp);
  const source = getDataSource();
  const activePreset = matchValuePreset(filters);

  let usage: UsageResult | null = null;
  let rows: ScreenRow[] = [];
  let asOf: string | null = null;

  if (run) {
    usage = await consumeScreenerUsage("value");
    if (usage.allowed) {
      rows = await source.screenValue(filters, RESULT_LIMIT);
      asOf = rows[0]?.as_of ?? (await source.dataAsOf());
    }
  } else {
    asOf = await source.dataAsOf();
  }

  const presets = VALUE_PRESETS.map((p) => ({ key: p.key, label: p.label, description: p.description, href: valueHref(p.filters) }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: VALUE_PATH, label: "저평가 스크리너" }]} />

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">저평가 주식 스크리너</h1>
        <p className="text-sm text-muted">
          PER · PBR · ROE · 부채비율 조건을 입력하면 조건 충족 종목을 표로 보여 드립니다. {DATA_LABEL}
          {asOf && <> · 데이터 기준일 <time dateTime={asOf}>{asOf}</time></>}
        </p>
      </header>

      <SampleBanner />

      {/* ── 필터 폼 (GET) ── */}
      <form method="get" action={VALUE_PATH} className="card space-y-4" aria-labelledby="filter-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="filter-heading" className="text-base font-bold">필터 조건</h2>
          <Link href={VALUE_PATH} className="text-xs text-muted hover:text-fg">기본값으로 초기화</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">PER 상한 (배)</span>
            <input className="field tnum" type="number" name="perMax" inputMode="decimal" defaultValue={filters.perMax}
              min={VALUE_LIMITS.perMax.min} max={VALUE_LIMITS.perMax.max} step={VALUE_LIMITS.perMax.step} required />
            <span className="mt-1 block text-xs text-muted">0 초과 ~ 상한 이하인 종목만 포함</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">PBR 상한 (배)</span>
            <input className="field tnum" type="number" name="pbrMax" inputMode="decimal" defaultValue={filters.pbrMax}
              min={VALUE_LIMITS.pbrMax.min} max={VALUE_LIMITS.pbrMax.max} step={VALUE_LIMITS.pbrMax.step} required />
            <span className="mt-1 block text-xs text-muted">0 초과 ~ 상한 이하인 종목만 포함</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">ROE 하한 (%)</span>
            <input className="field tnum" type="number" name="roeMin" inputMode="decimal" defaultValue={filters.roeMin}
              min={VALUE_LIMITS.roeMin.min} max={VALUE_LIMITS.roeMin.max} step={VALUE_LIMITS.roeMin.step} required />
            <span className="mt-1 block text-xs text-muted">하한 이상인 종목만 포함</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">부채비율 상한 (%)</span>
            <input className="field tnum" type="number" name="debtMax" inputMode="numeric" defaultValue={filters.debtMax}
              min={VALUE_LIMITS.debtMax.min} max={VALUE_LIMITS.debtMax.max} step={VALUE_LIMITS.debtMax.step} required />
            <span className="mt-1 block text-xs text-muted">상한 이하인 종목만 포함</span>
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
              {VALUE_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
          <p className="mt-1 text-sm text-muted">{describeValueFilters(filters)}</p>
          <p className="mt-2 text-xs text-muted">
            아직 실행되지 않았습니다. 위 조건으로 <strong className="text-fg">스크리닝 실행</strong>을 누르시면 조건 충족 종목이 표로 표시되며,
            결과 화면 주소를 복사해 같은 조건을 공유할 수 있습니다.
          </p>
        </section>
      )}

      {run && usage && !usage.allowed && <UsageExhausted usage={usage} resetHref={VALUE_PATH} />}

      {run && usage && usage.allowed && (
        <section aria-labelledby="results-heading" className="space-y-4">
          <h2 id="results-heading" className="sr-only">스크리닝 결과</h2>
          <ResultSummary count={rows.length} asOf={asOf} usage={usage} limit={RESULT_LIMIT} />
          <p className="text-xs text-muted">적용 조건: {describeValueFilters(filters)}</p>

          {rows.length === 0 ? (
            <EmptyState
              title="조건 충족 종목이 없습니다"
              description="PER·PBR 상한을 조금 올리거나 ROE 하한을 낮추고, 부채비율 상한을 넓혀 보세요. 아래 프리셋으로 바로 다시 실행할 수도 있습니다."
              action={<PresetRow presets={presets} activeKey={activePreset} />}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[880px] text-sm">
                <caption className="sr-only">저평가 스크리너 조건 충족 종목 {rows.length}개 — {DATA_LABEL}</caption>
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left">종목</th>
                    <th scope="col" className="px-3 py-2 text-left">시장</th>
                    <th scope="col" className="px-3 py-2 text-left">섹터</th>
                    <th scope="col" className="px-3 py-2 text-right">현재가<span className="block font-normal">(전일 종가)</span></th>
                    <th scope="col" className="px-3 py-2 text-right">시가총액</th>
                    <th scope="col" className="px-3 py-2 text-right">PER</th>
                    <th scope="col" className="px-3 py-2 text-right">PBR</th>
                    <th scope="col" className="px-3 py-2 text-right">ROE</th>
                    <th scope="col" className="px-3 py-2 text-right">부채비율</th>
                    <th scope="col" className="px-3 py-2 text-right">배당수익률</th>
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
                      <td className="tnum px-3 py-2 text-right">{fmtNum(r.per)}배</td>
                      <td className="tnum px-3 py-2 text-right">{fmtNum(r.pbr)}배</td>
                      <td className="tnum px-3 py-2 text-right">{fmtPct(r.roe)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtPct(r.debt_ratio, 0)}</td>
                      <td className="tnum px-3 py-2 text-right">{fmtPct(r.dividend_yield, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted">
            종목명을 누르면 외부 정보 페이지(네이버 금융)가 새 창으로 열립니다. 외부 사이트의 내용은 스톡랩과 무관합니다.
          </p>
          <Disclaimer compact />
          <AdSlot />
        </section>
      )}

      {/* ── 본문 콘텐츠 ── */}
      <article className="prose-kr max-w-3xl">
        <h2>저평가 스크리너란</h2>
        <p>
          저평가 스크리너는 국내 상장 종목(코스피·코스닥)의 재무 지표에 사용자가 정한 숫자 조건을 적용해, 조건을 모두 충족하는 종목만 골라내는 도구입니다.
          "저평가"라는 이름은 흔히 가치투자에서 쓰는 지표 묶음(PER·PBR·ROE·부채비율)을 다룬다는 뜻이며, 결과에 포함된 종목이 실제로 싸다거나 오를 것이라는 판단을 담고 있지는 않습니다.
          수천 개 종목을 일일이 확인하는 대신, 조건에 맞는 후보 목록을 빠르게 얻어 개별 분석의 출발점으로 삼는 용도입니다.
        </p>

        <h2>지표 설명</h2>
        <h3>PER (주가수익비율)</h3>
        <p>
          주가를 주당순이익(EPS)으로 나눈 값입니다. "이익 1원을 얻기 위해 몇 배의 가격을 내는가"를 뜻하며, 같은 업종 안에서 비교할 때 의미가 있습니다.
          한계: 일회성 이익·손실이 있으면 왜곡되고, 적자 기업은 계산할 수 없어 스크리너에서는 PER 0 초과인 종목만 다룹니다.
        </p>
        <h3>PBR (주가순자산비율)</h3>
        <p>
          주가를 주당순자산(BPS)으로 나눈 값입니다. 1배 미만이면 시가총액이 장부상 순자산보다 작다는 뜻입니다.
          한계: 장부가가 실제 자산 가치를 반영하지 못할 수 있고(무형자산·부실자산), 구조적으로 PBR이 낮은 업종(금융·지주 등)이 있어 업종 차이를 고려해야 합니다.
        </p>
        <h3>ROE (자기자본이익률)</h3>
        <p>
          순이익을 자기자본으로 나눈 값으로, 주주 자본을 얼마나 효율적으로 이익으로 바꾸는지 나타냅니다.
          한계: 부채를 크게 늘리면 자기자본이 작아져 ROE가 높게 보일 수 있어 부채비율과 함께 보아야 합니다. 일회성 이익도 ROE를 일시적으로 높입니다.
        </p>
        <h3>부채비율</h3>
        <p>
          총부채를 자기자본으로 나눈 비율(%)입니다. 낮을수록 재무 구조가 보수적이라고 볼 수 있습니다.
          한계: 업종에 따라 정상 범위가 크게 다릅니다(금융·건설·조선 등은 구조적으로 높음). 단일 기준으로 모든 업종을 평가하기는 어렵습니다.
        </p>

        <h2>사용법 3단계</h2>
        <ol>
          <li><strong>조건 입력</strong> — PER·PBR 상한, ROE 하한, 부채비율 상한을 입력하고 시장과 정렬 기준을 고릅니다. 프리셋을 누르면 자주 쓰는 조합이 자동 입력·실행됩니다.</li>
          <li><strong>스크리닝 실행</strong> — 실행 버튼을 누르면 조건 충족 종목이 표로 나옵니다(최대 {RESULT_LIMIT}개). 비로그인 사용자는 하루 {ANON_DAILY_LIMIT}회 실행할 수 있습니다.</li>
          <li><strong>결과 확인·공유</strong> — 표의 종목명을 눌러 외부 정보 페이지에서 상세 재무를 확인하고, "조건 링크 복사"로 같은 조건을 저장·공유하세요. 주소창의 파라미터가 그대로 조건입니다.</li>
        </ol>

        <h2>함께 보면 좋은 도구</h2>
        <ul>
          <li><Link href="/screener/dividend">고배당 스크리너</Link> — 배당수익률·연속배당연수·배당성향 조건으로 스크리닝</li>
          <li><Link href="/today">오늘의 조건 충족 종목</Link> — 매일 자동 로테이션되는 전략 조건과 그 결과 1종목</li>
        </ul>

        <Faq items={FAQ} />
      </article>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "스톡랩 저평가 주식 스크리너",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url: absUrl(VALUE_PATH),
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
          inLanguage: "ko",
        }}
      />
    </div>
  );
}
