import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SampleBanner } from "@/components/SampleBanner";
import { getDataSource } from "@/lib/data";
import { applyDividendFilters, applyValueFilters } from "@/lib/data/filters";
import { formatKoreanDate } from "@/lib/kst";
import { SITE, absUrl } from "@/lib/site";
import { fmtManWon, simulate } from "@/lib/compound";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — 저평가·고배당 스크리너, 복리 계산기, 오늘의 주식` },
  description: `${SITE.tagline}. DART·KRX 공개 데이터 기반 조건 스크리닝과 계산기를 무료로 제공합니다. 종목을 찍어주지 않습니다.`,
  alternates: { canonical: "/" },
  openGraph: { title: `${SITE.name} — 데이터로 찾고 직접 검증하는 개인 투자자용 도구`, description: SITE.tagline, url: absUrl("/"), type: "website" },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "스톡랩은 어떤 서비스인가요?",
    a: "공개 데이터(DART 전자공시, KRX 시세, 한국투자증권 KIS API)를 바탕으로 이용자가 직접 조건을 정해 종목을 걸러 보고, 복리 계산기로 시나리오를 검증할 수 있게 돕는 데이터 도구입니다. 특정 종목의 매매를 권유하지 않습니다.",
  },
  {
    q: "종목을 찍어주거나 리딩을 하나요?",
    a: "아닙니다. 리딩방·종목 상담·유료 정보 제공을 하지 않습니다. '오늘의 주식'도 미리 공개된 규칙(예: 저PBR + 고ROE)에 따라 조건을 충족한 종목 1개를 매일 자동으로 기록하는 것이며, 매매를 권유하지 않습니다.",
  },
  {
    q: "데이터는 얼마나 자주, 어떤 기준으로 갱신되나요?",
    a: "시세는 전일 종가 기준 지연 데이터이고, 재무 지표는 DART 최신 사업·분기보고서를 기준으로 하루 1회(06:00 KST) 갱신합니다. 각 화면 상단에 데이터 기준일(as of)을 표시합니다.",
  },
  {
    q: "무료인가요? 회원가입이 필요한가요?",
    a: "현재 모든 도구는 회원가입 없이 무료입니다. 비로그인 상태에서는 스크리너 실행 횟수에 일일 제한이 있습니다. 베이직·프로 요금제는 준비 중이며 도입 시 별도로 고지합니다.",
  },
  {
    q: "스크리닝 결과를 그대로 투자해도 되나요?",
    a: "스크리닝 결과는 입력한 조건을 충족한 종목 목록일 뿐이며 투자 판단의 출발점에 불과합니다. 공시 원문, 사업 내용, 재무 추세를 직접 확인하시고, 투자 결과에 대한 책임은 투자자 본인에게 있습니다.",
  },
  {
    q: "계산 방식은 공개되어 있나요?",
    a: "예. 스크리너의 조건식, 오늘의 주식 선정 규칙, 복리 계산기의 공식은 각 페이지 본문과 소개 페이지에 공개합니다. 숨겨진 알고리즘이나 별도의 점수 체계를 쓰지 않습니다.",
  },
];

export default async function Home() {
  const ds = getDataSource();
  const [asOf, screenRows, dividendRows, pick] = await Promise.all([
    ds.dataAsOf().catch(() => null),
    ds.allScreenRows().catch(() => []),
    ds.allDividendRows().catch(() => []),
    ds.getLatestPick().catch(() => null),
  ]);
  const valueCount = applyValueFilters(screenRows, { perMax: 10, pbrMax: 1, roeMin: 10, debtMax: 150, market: "ALL", sort: "per" }).length;
  const dividendCount = applyDividendFilters(dividendRows, { yieldMin: 4, yearsMin: 3, payoutMax: 0, market: "ALL", sort: "dividend_yield" }).length;
  const total = screenRows.length;
  const demo = simulate({ principal: 0, monthly: 300_000, annualRatePct: 7, years: 20, compounding: "monthly", contributionTiming: "end" });

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      alternateName: SITE.nameEn,
      url: absUrl("/"),
      description: SITE.tagline,
      inLanguage: "ko-KR",
      publisher: { "@type": "Organization", name: SITE.parent.name, url: SITE.parent.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.parent.name,
      url: SITE.parent.url,
      email: SITE.contactEmail,
      brand: { "@type": "Brand", name: SITE.name },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="space-y-14">
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="pt-4 text-center sm:pt-10">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
          종목을 찍어주지 않습니다 · 조건과 계산만 제공합니다
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          데이터로 찾고, <span className="text-brand">직접 검증</span>하세요.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">{SITE.tagline}</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/screener/value" className="btn-primary w-full sm:w-auto">저평가 스크리너 열기</Link>
          <Link href="/calc/compound" className="btn-ghost w-full sm:w-auto">복리 계산기</Link>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="신뢰 요소" className="grid gap-3 sm:grid-cols-3">
        {[
          { t: "공개 데이터 출처", d: "DART 전자공시 · KRX 정보데이터시스템 · 한국투자증권 KIS. 화면마다 기준일 표시." },
          { t: "추천 없음, 조건만", d: "매매 권유·종목 상담을 하지 않습니다. 조건식과 계산식은 전부 공개합니다." },
          { t: "무료 · 회원가입 없음", d: "현재 모든 도구가 무료입니다. 비로그인 일일 실행 제한만 있습니다." },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-border bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold">{x.t}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">{x.d}</p>
          </div>
        ))}
      </section>

      {/* Features */}
      <section aria-labelledby="features">
        <h2 id="features" className="text-xl font-bold sm:text-2xl">도구</h2>
        <p className="mt-1 text-sm text-muted">각 도구는 입력 → 결과 → 근거 순서로 보여 주며, 결과 링크를 그대로 공유할 수 있습니다.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {/* 스크리너 */}
          <article className="card flex flex-col">
            <h3 className="text-base font-bold">스크리너 2종</h3>
            <p className="mt-1 text-sm leading-6 text-muted">PER·PBR·ROE·부채비율로 거르는 <strong className="text-fg">저평가</strong>, 배당수익률·연속배당·배당성향으로 거르는 <strong className="text-fg">고배당</strong>.</p>
            <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-xs tnum" aria-hidden>
              <div className="flex flex-wrap gap-1.5">
                {["PER ≤ 10", "PBR ≤ 1", "ROE ≥ 10%", "부채 ≤ 150%"].map((c) => (
                  <span key={c} className="rounded-full border border-border bg-surface px-2 py-0.5">{c}</span>
                ))}
              </div>
              <div className="mt-2 space-y-1 text-muted">
                <div className="flex justify-between"><span>조건 충족</span><span className="font-semibold text-fg">{valueCount}종목</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-border"><div className="h-full bg-brand" style={{ width: `${total ? Math.max(3, Math.round((valueCount / total) * 100)) : 0}%` }} /></div>
              </div>
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Link href="/screener/value" className="btn-ghost flex-1 !py-1.5 text-xs">저평가</Link>
              <Link href="/screener/dividend" className="btn-ghost flex-1 !py-1.5 text-xs">고배당</Link>
            </div>
          </article>

          {/* 복리 계산기 */}
          <article className="card flex flex-col">
            <h3 className="text-base font-bold">복리 계산기</h3>
            <p className="mt-1 text-sm leading-6 text-muted">원금·월 적립·수익률·기간으로 연도별 자산 성장을 계산합니다. 세금·물가 옵션, 목표 금액 역산, 링크 공유.</p>
            <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-xs tnum" aria-hidden>
              <p className="text-muted">월 30만원 · 20년 · 연 7% 가정</p>
              <p className="mt-1 text-lg font-extrabold">{fmtManWon(demo.totals.balance)}</p>
              <p className="text-muted">원금 {fmtManWon(demo.totals.invested)} + 이자 {fmtManWon(demo.totals.interest)}</p>
              <div className="mt-2 flex h-8 items-end gap-0.5">
                {demo.rows.filter((_, i) => i % 2 === 1).map((r) => (
                  <div key={r.year} className="flex-1 rounded-sm bg-brand/80" style={{ height: `${Math.max(4, (r.balance / demo.totals.balance) * 100)}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-auto pt-4">
              <Link href="/calc/compound?p=0&m=300000&r=7&y=20" className="btn-ghost w-full !py-1.5 text-xs">이 예시로 열기</Link>
            </div>
          </article>

          {/* 오늘의 주식 */}
          <article className="card flex flex-col">
            <h3 className="text-base font-bold">오늘의 주식</h3>
            <p className="mt-1 text-sm leading-6 text-muted">매일 06:00 KST, 미리 공개된 규칙으로 조건 충족 종목 1개를 자동 기록합니다. 왜 뽑혔는지 조건을 그대로 보여 줍니다.</p>
            <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-xs" aria-hidden>
              {pick ? (
                <>
                  <p className="text-muted">{formatKoreanDate(pick.pick_date)} · {pick.strategy_label}</p>
                  <p className="mt-1 text-base font-extrabold">{pick.name} <span className="text-xs font-medium text-muted">{pick.code}</span></p>
                  <ul className="mt-1 space-y-0.5 text-muted">
                    {pick.conditions.slice(0, 3).map((c) => <li key={c}>· {c}</li>)}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-muted">아직 기록된 종목이 없습니다</p>
                  <p className="mt-1 font-semibold">매일 06:00 KST 갱신</p>
                  <p className="mt-1 text-muted">규칙 예: 저PBR + 고ROE, 고배당 + 저부채</p>
                </>
              )}
            </div>
            <div className="mt-auto pt-4">
              <Link href="/today" className="btn-ghost w-full !py-1.5 text-xs">오늘의 주식 보기</Link>
            </div>
          </article>
        </div>
      </section>

      {/* Live widget */}
      <section aria-labelledby="live" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="live" className="text-xl font-bold sm:text-2xl">지금 데이터</h2>
          <p className="text-xs text-muted tnum">{asOf ? `데이터 기준일 ${formatKoreanDate(asOf)} · 전일 종가 기준 지연 데이터` : "데이터 기준일 확인 중"}</p>
        </div>
        <SampleBanner />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card">
            <dt className="text-xs text-muted">전체 종목</dt>
            <dd className="mt-1 text-2xl font-extrabold tnum">{total.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-muted">개</span></dd>
          </div>
          <div className="card">
            <dt className="text-xs text-muted">저평가 기본 조건 충족</dt>
            <dd className="mt-1 text-2xl font-extrabold tnum">{valueCount.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-muted">개</span></dd>
            <p className="mt-1 text-[11px] text-muted">PER≤10 · PBR≤1 · ROE≥10% · 부채≤150%</p>
          </div>
          <div className="card">
            <dt className="text-xs text-muted">고배당 기본 조건 충족</dt>
            <dd className="mt-1 text-2xl font-extrabold tnum">{dividendCount.toLocaleString("ko-KR")}<span className="ml-1 text-sm font-medium text-muted">개</span></dd>
            <p className="mt-1 text-[11px] text-muted">배당수익률≥4% · 연속배당≥3년</p>
          </div>
          <div className="card">
            <dt className="text-xs text-muted">오늘의 주식</dt>
            {pick ? (
              <>
                <dd className="mt-1 truncate text-lg font-extrabold">{pick.name}</dd>
                <p className="mt-1 text-[11px] text-muted">{formatKoreanDate(pick.pick_date)} · {pick.strategy_label}</p>
              </>
            ) : (
              <>
                <dd className="mt-1 text-lg font-extrabold text-muted">준비 중</dd>
                <p className="mt-1 text-[11px] text-muted">매일 06:00 KST 갱신</p>
              </>
            )}
          </div>
        </dl>
        <p className="text-xs text-muted">위 수치는 기본 조건에 해당하는 종목 수이며, 각 스크리너에서 조건을 직접 조정할 수 있습니다. 조건 충족이 매매 근거를 의미하지는 않습니다.</p>
      </section>

      {/* Roadmap / 요금제 preview */}
      <section aria-labelledby="plans" className="card">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plans" className="text-xl font-bold sm:text-2xl">요금제</h2>
          <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">준비 중</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          현재는 <strong className="text-fg">전부 무료</strong>입니다. 아래 유료 요금제는 준비 중인 안이며 결제 기능은 아직 없습니다. 도입 시 이용약관에 별도 고지합니다.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
            <p className="text-sm font-bold">무료 <span className="ml-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-fg">현재</span></p>
            <p className="mt-1 text-2xl font-extrabold tnum">₩0</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>· 저평가·고배당 스크리너 (일일 실행 제한)</li>
              <li>· 복리 계산기 무제한</li>
              <li>· 오늘의 주식 열람</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4 opacity-90">
            <p className="text-sm font-bold">베이직 <span className="ml-1 text-xs font-medium text-muted">준비 중</span></p>
            <p className="mt-1 text-2xl font-extrabold tnum">₩9,900<span className="text-sm font-medium text-muted">/월</span></p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>· 스크리너 실행 제한 해제</li>
              <li>· 조건 저장·내 스크리너</li>
              <li>· 과거 오늘의 주식 전체 기록</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4 opacity-90">
            <p className="text-sm font-bold">프로 <span className="ml-1 text-xs font-medium text-muted">준비 중</span></p>
            <p className="mt-1 text-2xl font-extrabold tnum">₩29,000<span className="text-sm font-medium text-muted">/월</span></p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>· 조건 백테스트(과거 구간 검증)</li>
              <li>· 조건 충족 알림(이메일)</li>
              <li>· 데이터 CSV 내려받기</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq">
        <h2 id="faq" className="text-xl font-bold sm:text-2xl">자주 묻는 질문</h2>
        <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="px-4 py-3 [&_summary]:cursor-pointer">
              <summary className="text-sm font-semibold sm:text-base">{f.q}</summary>
              <p className="mt-2 text-sm leading-7 text-fg/90">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          더 알아보기: <Link href="/about" className="underline underline-offset-2 hover:text-fg">소개</Link> · <Link href="/disclaimer" className="underline underline-offset-2 hover:text-fg">면책 고지</Link> · <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">개인정보처리방침</Link>
        </p>
      </section>
    </div>
  );
}
