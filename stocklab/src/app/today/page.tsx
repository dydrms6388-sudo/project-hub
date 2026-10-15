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
import { formatKoreanDate, kstDateString } from "@/lib/kst";
import { absUrl } from "@/lib/site";
import type { DailyPick } from "@/lib/types";
import { CATEGORY_LABEL, ROTATION, executableStrategies, getStrategy, pickDaily, strategyForDate, strategyScreenerHref } from "@/lib/strategies";
import { Faq, type FaqItem } from "../screener/_components/Faq";
import { StockLink } from "../screener/_components/StockLink";
import { DATA_LABEL, MARKET_LABEL } from "../screener/_components/utils";

export const revalidate = 86400;

const PATH = "/today";
const TITLE = "오늘의 조건 충족 종목 — 매일 06:00 자동 선정";
const DESCRIPTION =
  "매일 아침 06:00(KST) 사전 정의된 가치·배당 전략 조건을 자동 적용해 상위 1개 조건 충족 종목과 근거 지표를 공개합니다. 사람의 개입 없이 계산된 스크리닝 결과이며 투자 권유가 아닙니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH },
};

type MetricKey = string;
const METRIC_DEFS: { key: MetricKey; label: string; fmt: (v: number | string | null) => string }[] = [
  { key: "price", label: "현재가 (전일 종가)", fmt: (v) => fmtWon(typeof v === "number" ? v : null) },
  { key: "market_cap", label: "시가총액", fmt: (v) => fmtEok(typeof v === "number" ? v : null) },
  { key: "per", label: "PER", fmt: (v) => `${fmtNum(typeof v === "number" ? v : null)}배` },
  { key: "pbr", label: "PBR", fmt: (v) => `${fmtNum(typeof v === "number" ? v : null)}배` },
  { key: "roe", label: "ROE", fmt: (v) => fmtPct(typeof v === "number" ? v : null) },
  { key: "debt_ratio", label: "부채비율", fmt: (v) => fmtPct(typeof v === "number" ? v : null, 0) },
  { key: "dividend_yield", label: "배당수익률", fmt: (v) => fmtPct(typeof v === "number" ? v : null, 2) },
  { key: "dps", label: "DPS", fmt: (v) => fmtWon(typeof v === "number" ? v : null) },
  { key: "payout_ratio", label: "배당성향", fmt: (v) => fmtPct(typeof v === "number" ? v : null) },
  { key: "consecutive_years", label: "연속배당연수", fmt: (v) => (typeof v === "number" ? `${v}년` : "–") },
  { key: "ex_dividend_date", label: "배당락(예상)일", fmt: (v) => (typeof v === "string" && v ? v : "–") },
  { key: "score_roe_over_pbr", label: "ROE ÷ PBR", fmt: (v) => fmtNum(typeof v === "number" ? v : null, 1) },
  { key: "per_x_pbr", label: "PER × PBR", fmt: (v) => fmtNum(typeof v === "number" ? v : null, 2) },
  { key: "rank_sum", label: "순위 합계", fmt: (v) => fmtNum(typeof v === "number" ? v : null, 0) },
];

const FAQ: FaqItem[] = [
  {
    q: "오늘의 조건 충족 종목은 어떻게 정해지나요?",
    a: "매일 06:00(KST) 서버 작업이 사전 정의된 4개 전략 중 그날의 전략을 날짜 규칙(연중 일수 ÷ 4의 나머지)으로 고르고, 전 종목 재무·배당 데이터에 그 전략의 필터를 적용한 뒤 정렬 기준 1위 종목을 기록합니다. 사람이 종목을 고르거나 수정하는 단계는 없습니다.",
  },
  {
    q: "왜 매일 다른 전략이 적용되나요?",
    a: "한 가지 조건만 반복하면 같은 종목이 계속 나오기 쉽고, 특정 지표에 치우친 인상을 줄 수 있습니다. 가치(저PBR+고ROE, 그레이엄), 복합(매직 포뮬러 라이트), 배당(배당 귀족 라이트) 전략을 순환시켜 서로 다른 관점의 조건 충족 결과를 보여 드립니다.",
  },
  {
    q: "조건을 충족하는 종목이 하나도 없으면 어떻게 되나요?",
    a: "그날 전략에서 후보가 없으면 로테이션의 다음 전략을 순서대로 시도합니다. 네 전략 모두 후보가 없으면 그날은 '조건 충족 종목 없음'으로 표시되며, 임의로 종목을 채우지 않습니다.",
  },
  {
    q: "이전 날짜의 기록도 볼 수 있나요?",
    a: "과거 기록 목록(히스토리)은 다음 단계에서 제공할 예정입니다. 현재는 당일(또는 가장 최근) 결과만 표시하며, 검증되지 않은 과거 성과 수치는 게시하지 않습니다.",
  },
  {
    q: "오늘의 조건 충족 종목은 투자 권유인가요?",
    a: "아닙니다. 공개된 규칙을 기계적으로 적용한 스크리닝 결과 1건이며, 해당 종목의 매매를 권유하거나 가격 방향을 예측하지 않습니다. 시세는 전일 종가 기준 지연 데이터이고, 투자 판단과 결과의 책임은 투자자 본인에게 있습니다.",
  },
];

type PickSource = "today" | "latest" | "live";

async function resolvePick(today: string): Promise<{ pick: DailyPick | null; source: PickSource }> {
  const ds = getDataSource();
  const exact = await ds.getPick(today);
  if (exact) return { pick: exact, source: "today" };
  const latest = await ds.getLatestPick();
  if (latest) return { pick: latest, source: "latest" };
  const [rows, divRows] = await Promise.all([ds.allScreenRows(), ds.allDividendRows()]);
  return { pick: pickDaily(rows, divRows, today), source: "live" }; // 저장하지 않음 (크론이 정식 기록)
}

export default async function TodayPage() {
  const today = kstDateString();
  const { pick, source } = await resolvePick(today);
  const strategy = pick ? getStrategy(pick.strategy_key) : getStrategy(strategyForDate(today));
  const screenerHref = pick ? strategyScreenerHref(pick.strategy_key) : null;
  const rotation = executableStrategies();
  const todayKey = strategyForDate(today);
  const metricEntries = pick ? METRIC_DEFS.filter((d) => pick.metrics[d.key] !== undefined && pick.metrics[d.key] !== null) : [];
  const sector = pick && typeof pick.metrics.sector === "string" ? pick.metrics.sector : null;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: PATH, label: "오늘의 주식" }]} />

      <header className="space-y-2">
        <p className="text-sm text-muted">
          <time dateTime={pick?.pick_date ?? today}>{formatKoreanDate(pick?.pick_date ?? today)}</time>
          {source === "latest" && pick && pick.pick_date !== today && <span> · 가장 최근 기록 (오늘 06:00 선정 전)</span>}
          {source === "live" && <span> · 실시간 계산(캐시 전)</span>}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">오늘의 조건 충족 종목</h1>
        {strategy && (
          <p className="text-sm text-muted">
            <span className="mr-1 inline-block rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold text-fg">
              {CATEGORY_LABEL[strategy.category]} · {strategy.label}
            </span>
            {strategy.description}
          </p>
        )}
      </header>

      <SampleBanner />

      {pick && strategy ? (
        <section aria-labelledby="pick-heading" className="space-y-4">
          <h2 id="pick-heading" className="sr-only">선정 결과</h2>

          <div className="card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">전략 조건 정렬 1위</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  <StockLink code={pick.code} name={pick.name} />
                </p>
                <p className="mt-1 text-sm text-muted">
                  {MARKET_LABEL[pick.market] ?? pick.market}
                  {sector && <> · {sector}</>}
                </p>
              </div>
              <p className="text-xs text-muted">
                {DATA_LABEL} · 데이터 기준일 <time dateTime={pick.data_as_of}>{pick.data_as_of}</time>
              </p>
            </div>

            {metricEntries.length > 0 && (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="지표">
                {metricEntries.map((d) => (
                  <div key={d.key} className="rounded-xl border border-border bg-surface-2 px-3 py-2">
                    <dt className="text-[11px] text-muted">{d.label}</dt>
                    <dd className="tnum mt-0.5 text-base font-semibold">{d.fmt(pick.metrics[d.key] ?? null)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div>
              <h3 className="text-sm font-bold">충족 조건</h3>
              <ul className="mt-2 space-y-1.5 text-sm" aria-label="충족 조건 목록">
                {pick.conditions.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">✓</span>
                    <span className="tnum">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="text-sm font-bold">왜 이 조건인가</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{strategy.description}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                {strategy.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              {screenerHref && <Link href={screenerHref} className="btn-primary">내 필터로 직접 확인</Link>}
              <Link href="/screener/value" className="btn-ghost">저평가 스크리너</Link>
              <Link href="/screener/dividend" className="btn-ghost">고배당 스크리너</Link>
            </div>
          </div>

          <Disclaimer compact />
          <AdSlot />
        </section>
      ) : (
        <section aria-labelledby="pick-heading" className="space-y-4">
          <h2 id="pick-heading" className="sr-only">선정 결과</h2>
          <EmptyState
            title="오늘은 조건 충족 종목이 없습니다"
            description="네 가지 전략 조건 모두에서 후보가 나오지 않았습니다. 임의로 종목을 채우지 않으며, 다음 자동 선정은 내일 06:00(KST)에 실행됩니다."
            action={<Link href="/screener/value" className="btn-ghost">스크리너에서 직접 조건 조정</Link>}
          />
          <Disclaimer compact />
        </section>
      )}

      <article className="prose-kr max-w-3xl">
        <h2>오늘의 조건 충족 종목이란</h2>
        <p>
          매일 06:00(KST) 서버 작업(크론)이 사전 정의된 전략 조건을 전 종목 데이터에 적용하고, 정렬 기준 1위 종목 하나를 그날의 기록으로 남기는 자동 코너입니다.
          어떤 종목을 보여 줄지 사람이 고르거나 손보는 단계는 없습니다. 규칙은 이 페이지에 모두 공개되어 있고, 같은 데이터와 같은 규칙이면 누구나 같은 결과를 재현할 수 있습니다.
        </p>
        <p>
          결과는 "조건을 충족한 종목"일 뿐, 그 종목의 매매를 권유하거나 주가 방향을 예측하는 것이 아닙니다.
          시세는 전일 종가 기준 지연 데이터이며, 재무·배당 지표는 공시 기준으로 하루 한 번 갱신됩니다. 06:00 이전에 방문하시면 직전 일자의 기록이 표시될 수 있습니다.
        </p>

        <h2>전략 로테이션</h2>
        <p>연중 일수를 4로 나눈 나머지로 그날의 1순위 전략을 정합니다. 후보가 없으면 다음 순번 전략을 차례로 시도합니다.</p>
        <div className="overflow-x-auto">
          <table>
            <caption className="sr-only">오늘의 조건 충족 종목 전략 로테이션 4종</caption>
            <thead>
              <tr>
                <th scope="col">순번</th>
                <th scope="col">전략</th>
                <th scope="col">분류</th>
                <th scope="col">핵심 조건</th>
                <th scope="col">오늘</th>
              </tr>
            </thead>
            <tbody>
              {rotation.map((s, i) => (
                <tr key={s.key}>
                  <td className="tnum">{i + 1}</td>
                  <td>{s.label}</td>
                  <td>{CATEGORY_LABEL[s.category]}</td>
                  <td>{s.rules.join(" · ")}</td>
                  <td>{s.key === todayKey ? "1순위" : `${((ROTATION.indexOf(s.key) - ROTATION.indexOf(todayKey) + ROTATION.length) % ROTATION.length) + 1}순위`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          그 밖의 전략(골든크로스, 52주 신고가 돌파, 볼린저 회귀, RSI 회귀, 배당 성장, 저변동성 등)은 일별 시세 히스토리가 필요해 데이터 파이프라인 확장 후 순차적으로 추가됩니다.
        </p>

        <h2>이전 기록</h2>
        <p>
          날짜별 기록 목록(히스토리)은 다음 단계에서 제공할 예정입니다. 검증되지 않은 과거 성과 수치나 임의로 만든 기록은 게시하지 않습니다.
          현재 페이지는 당일 또는 가장 최근 기록 1건만 표시합니다.
        </p>

        <Faq items={FAQ} />
      </article>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "스톡랩 오늘의 조건 충족 종목",
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
