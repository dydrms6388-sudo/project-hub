import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/lib/seo";
import { site } from "@/site.config";

const title = "카페인과 수면 — 몇 시까지 마셔야 잠을 지킬 수 있나";
const description =
  "카페인 반감기 5시간이 실제로 어떤 뜻인지, 취침 6시간 전 커피가 왜 문제가 되는지, 잔존량을 직접 계산해 보는 방법까지 정리했습니다.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["카페인 수면", "커피 몇 시까지", "카페인 반감기", "카페인 불면", "커피 끊는 시간"],
  alternates: { canonical: "/guide/caffeine-and-sleep/" },
  openGraph: {
    type: "article",
    locale: site.locale,
    siteName: site.name,
    url: "/guide/caffeine-and-sleep/",
    title: `${title} | ${site.name}`,
    description,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "ko-KR",
    url: `${site.url}/guide/caffeine-and-sleep/`,
    publisher: { "@type": "Organization", name: site.name },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${site.url}/` },
      { "@type": "ListItem", position: 2, name: "가이드", item: `${site.url}/guide/caffeine-and-sleep/` },
      { "@type": "ListItem", position: 3, name: title, item: `${site.url}/guide/caffeine-and-sleep/` },
    ],
  },
];

/** 반감기 5시간 기준 잔존량 표 (계산 결과를 그대로 박아둔 정적 표) */
const decayRows = [
  { h: 0, mg: 125 },
  { h: 2, mg: 95 },
  { h: 4, mg: 72 },
  { h: 5, mg: 63 },
  { h: 6, mg: 55 },
  { h: 8, mg: 41 },
  { h: 10, mg: 31 },
  { h: 12, mg: 24 },
];

export default function Guide() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <nav aria-label="경로" className="mb-3 text-xs text-slate-500">
          <Link href="/" className="hover:underline">
            홈
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">가이드</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{description}</p>

        <p
          role="note"
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
        >
          <span className="font-bold">의료 조언이 아닙니다 · </span>
          이 글은 공개된 연구와 공식 기준을 정리한 참고 자료입니다. 불면이 지속되거나 카페인 섭취
          후 심계항진·불안 등이 반복된다면 의료 전문가와 상담하세요.
        </p>

        <div className="mt-8 space-y-9 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">1. &lsquo;반감기 5시간&rsquo;이 실제로 뜻하는 것</h2>
            <p>
              카페인은 1차 소실(first-order elimination)을 따릅니다. 남은 양이 일정 시간마다 절반씩
              줄어든다는 뜻이고, 수식으로는 <b>C(t) = C₀ × (1/2)^(t ÷ T½)</b> 한 줄입니다. 건강한
              성인의 반감기 T½는 평균 약 5시간, 문헌 범위로는 3~7시간입니다.
            </p>
            <p className="mt-3">
              중요한 것은 &ldquo;5시간이 지나면 사라진다&rdquo;가 아니라 &ldquo;5시간마다 절반이 된다&rdquo;는
              점입니다. 오후 3시에 아메리카노(작은 컵, 약 125mg)를 마셨다면 밤 11시에도 40mg 안팎이
              남아 있습니다. 커피 3분의 1잔을 손에 든 채 잠자리에 드는 셈입니다.
            </p>
            <div className="mt-4 -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[280px] border-collapse">
                <caption className="mb-2 text-left text-xs text-slate-500">
                  아메리카노 125mg, 반감기 5시간일 때의 잔존량
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold text-slate-500">
                      마신 뒤
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right text-xs font-semibold text-slate-500">
                      남은 카페인
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-2 py-2 text-right text-xs font-semibold text-slate-500">
                      비율
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {decayRows.map((r) => (
                    <tr key={r.h}>
                      <td className="border-b border-slate-100 px-2 py-2 text-sm text-slate-700">{r.h}시간</td>
                      <td className="border-b border-slate-100 px-2 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {r.mg}mg
                      </td>
                      <td className="border-b border-slate-100 px-2 py-2 text-right text-sm tabular-nums text-slate-600">
                        {Math.round((r.mg / 125) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">2. 취침 6시간 전 커피도 수면을 줄인다</h2>
            <p>
              &ldquo;자기 직전만 피하면 된다&rdquo;는 통념과 달리, 2013년 <i>Journal of Clinical Sleep
              Medicine</i>에 실린 Drake 등의 연구는 카페인 400mg을 취침 0시간·3시간·6시간 전에 각각
              섭취했을 때 <b>세 조건 모두에서</b> 총 수면 시간이 유의하게 줄었다고 보고했습니다.
              6시간 전 조건에서도 약 1시간의 수면 손실이 관찰됐습니다.
            </p>
            <p className="mt-3">
              더 눈에 띄는 부분은 참가자들의 <b>주관적 인식</b>이었습니다. 6시간 전에 마신 조건에서
              참가자들은 수면의 질이 나빠졌다는 것을 스스로 잘 알아차리지 못했습니다. 즉 &ldquo;나는
              커피 마셔도 잘 자&rdquo;라는 느낌이 실제 수면 구조와 일치하지 않을 수 있습니다.
            </p>
            <p className="mt-3">
              카페인이 작동하는 방식을 보면 이해가 쉽습니다. 깨어 있는 동안 뇌에는 아데노신이
              쌓이고, 이 물질이 수용체에 붙으면서 졸음이 옵니다. 카페인은 아데노신과 구조가 비슷해
              같은 수용체를 대신 차지합니다. 아데노신이 사라지는 것이 아니라 &lsquo;신호가 가려지는&rsquo;
              것이라, 카페인이 빠지고 나면 쌓여 있던 졸음이 한꺼번에 몰려오기도 합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">3. 사람마다 다른 이유: CYP1A2</h2>
            <p>
              같은 커피를 마셔도 어떤 사람은 밤새 뒤척이고 어떤 사람은 멀쩡합니다. 가장 큰 원인은
              간에서 카페인을 분해하는 <b>CYP1A2 효소</b>의 활성 차이입니다. 이 효소가 빠르게 일하는
              사람은 반감기가 3시간대, 느린 사람은 7시간 이상까지 갑니다.
            </p>
            <div className="mt-4 -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold text-slate-500">
                      요인
                    </th>
                    <th scope="col" className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold text-slate-500">
                      반감기에 미치는 영향
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["흡연", "짧아짐 — 카페인 대사가 빨라진다고 알려져 있습니다"],
                    ["임신", "크게 길어짐 — 삼분기가 진행될수록 더 길어집니다"],
                    ["경구피임약 복용", "길어짐"],
                    ["일부 항생제(플루오로퀴놀론계)", "길어짐"],
                    ["간질환", "길어짐"],
                    ["신생아·영아", "성인보다 훨씬 김"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="border-b border-slate-100 px-2 py-2 text-sm font-semibold text-slate-800">{k}</td>
                      <td className="border-b border-slate-100 px-2 py-2 text-sm text-slate-700">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              본인의 반감기를 검사 없이 알 수는 없습니다. 대신{" "}
              <Link href="/tools/caffeine/" className="font-medium text-teal-700 underline underline-offset-2">
                카페인 반감기 계산기
              </Link>
              에서 반감기를 3시간과 7시간으로 각각 넣어보면, 같은 커피가 취침 시각에 얼마나 다른
              잔존량을 남기는지 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">4. 하루 400mg은 어느 정도인가</h2>
            <p>
              식품의약품안전처와 유럽식품안전청(EFSA)은 모두 건강한 성인의 1일 최대 섭취 권고량을{" "}
              <b>400mg</b>으로 제시합니다. 임신부는 300mg, 어린이·청소년은 체중 1kg당 2.5mg이 흔히
              인용되는 기준입니다. 다만 EFSA는 단회 섭취 200mg까지는 수면에 영향을 주지 않는다고
              보면서도, <b>취침에 가까운 시각의 100mg</b>은 일부 성인에서 수면에 영향을 줄 수 있다고
              덧붙였습니다. 총량과 타이밍은 별개의 문제라는 뜻입니다.
            </p>
            <p className="mt-3">
              참고로 커피전문점 아메리카노 한 잔은 작은 컵 기준 대략 125mg, 큰 컵은 190mg 안팎이지만
              매장과 추출 방식에 따라 두 배 이상 차이 나기도 합니다. 콜드브루는 같은 용량에서 더 높은
              편입니다. 정확한 값은 제품 표기를 확인하는 것이 가장 확실합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">5. 실제로 몇 시까지 마시면 되나</h2>
            <p>
              정해진 시각은 없습니다. 마신 양과 본인의 반감기, 그리고 취침 시각의 조합으로 정해집니다.
              계산은 간단합니다. 잔존량이 목표치까지 내려가는 데 걸리는 시간은{" "}
              <b>T½ × log₂(마신 양 ÷ 목표치)</b> 입니다.
            </p>
            <div className="mt-4 rounded-xl border border-slate-300 bg-slate-900 p-3">
              <p className="whitespace-pre font-mono text-[13px] leading-relaxed text-teal-200">
                {`예) 125mg 을 50mg 까지 낮추려면 (T½ = 5h)
5 × log₂(125 ÷ 50)
= 5 × log₂(2.5)
= 5 × 1.32
= 6.6 시간`}
              </p>
            </div>
            <p className="mt-3">
              즉 밤 11시에 잠자리에 들 계획이고 취침 시 잔존량을 50mg 아래로 두고 싶다면, 마지막 잔은
              오후 4시 20분 무렵이 경계선이 됩니다. 여기서 50mg은 공인된 절단점이 아니라 &lsquo;커피 반
              잔&rsquo;을 가늠하기 위한 참고선이라는 점을 기억하세요.
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5">
              <li>잠이 예민한 편이라면 반감기를 6~7시간으로 놓고 계산하는 쪽이 안전합니다.</li>
              <li>디카페인도 0mg이 아닙니다. 한 잔에 5~15mg 정도가 남습니다.</li>
              <li>
                녹차·홍차·콜라·에너지드링크·초콜릿도 합산 대상입니다. 커피만 세면 총량을 과소평가하기
                쉽습니다.
              </li>
              <li>
                카페인을 줄일 때 갑자기 끊으면 두통·피로·집중력 저하 같은 금단 증상이 나타날 수
                있습니다. 며칠에 걸쳐 줄이는 방식이 흔히 안내됩니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">6. 직접 계산해 보기</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/tools/caffeine/"
                className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <span className="block font-semibold text-slate-800">카페인 반감기 계산기</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                  마신 시각과 양을 넣으면 취침 시 잔존량을 그래프로 보여줍니다.
                </span>
              </Link>
              <Link
                href="/tools/sleep-cycle/"
                className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <span className="block font-semibold text-slate-800">수면 사이클 계산기</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                  90분 주기로 취침·기상 시각을 역산합니다.
                </span>
              </Link>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">출처</h2>
            <ul className="space-y-1.5 text-sm">
              {[
                {
                  label: "Drake C 외, Caffeine Effects on Sleep Taken 0, 3, or 6 Hours before Going to Bed, J Clin Sleep Med 2013 — doi:10.5664/jcsm.3170",
                  url: "https://doi.org/10.5664/jcsm.3170",
                },
                {
                  label: "EFSA, Scientific Opinion on the safety of caffeine, EFSA Journal 2015 — doi:10.2903/j.efsa.2015.4102",
                  url: "https://doi.org/10.2903/j.efsa.2015.4102",
                },
                {
                  label: "Watson NF 외, Recommended Amount of Sleep for a Healthy Adult (AASM & SRS), J Clin Sleep Med 2015 — doi:10.5664/jcsm.4758",
                  url: "https://doi.org/10.5664/jcsm.4758",
                },
                { label: "식품안전나라 — 카페인 함량 정보", url: "https://www.foodsafetykorea.go.kr/" },
              ].map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-words text-teal-700 underline underline-offset-2 hover:text-teal-900"
                  >
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </>
  );
}
