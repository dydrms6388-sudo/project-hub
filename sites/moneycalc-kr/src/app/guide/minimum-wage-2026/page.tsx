import type { Metadata } from "next";
import Link from "next/link";
import GuideShell, {
  guideJsonLd,
  guideMetadata,
  H2,
  P,
  RateRow,
  RateTable,
  UL,
  type GuideMeta,
} from "@/components/guide/GuideShell";
import { JsonLd } from "@/lib/seo";
import {
  MIN_WAGE_HOURLY,
  MIN_WAGE_MONTHLY,
  MONTHLY_WORK_HOURS,
  WEEKLY_HOLIDAY_MIN_HOURS,
} from "@/data/rates-2026";
import { num, won } from "@/lib/money";
import { hourlyToMonthly } from "@/lib/calc/labor";

const meta: GuideMeta = {
  slug: "minimum-wage-2026",
  title: "2026년 최저임금 10,320원 — 월급 환산과 주휴수당",
  h1: "2026년 최저임금 정리",
  description:
    "2026년 최저임금은 시간급 10,320원, 월 환산 2,156,880원입니다. 주휴수당 포함 여부와 근로시간별 월급 환산표를 정리했습니다.",
  keywords: ["2026 최저임금", "최저임금 월급", "10320원", "주휴수당", "209시간"],
  updated: "2026-08-19",
  relatedTools: ["hourly-wage", "net-salary", "annual-leave"],
};

export const metadata: Metadata = guideMetadata(meta);

const HOURS = [40, 35, 30, 25, 20, 15, 14];

export default function Page() {
  return (
    <>
      <JsonLd data={guideJsonLd(meta)} />
      <GuideShell meta={meta}>
        <P>
          2026년 최저임금은 시간급 <strong>10,320원</strong>입니다. 2025년 9,860원에서 290원(2.9%)
          올랐고, 2008년 이후 17년 만에 노사 합의로 결정되었습니다. 업종 구분 없이 모든 사업장에
          동일하게 적용됩니다.
        </P>

        <H2>기본 수치</H2>
        <RateTable caption="2026년 최저임금 관련 기준값">
          <RateRow rate={MIN_WAGE_HOURLY} valueText={won(MIN_WAGE_HOURLY.value)} />
          <RateRow rate={MIN_WAGE_MONTHLY} valueText={won(MIN_WAGE_MONTHLY.value)} />
          <RateRow rate={MONTHLY_WORK_HOURS} valueText={`${num(MONTHLY_WORK_HOURS.value)}시간`} />
          <RateRow
            rate={WEEKLY_HOLIDAY_MIN_HOURS}
            valueText={`주 ${num(WEEKLY_HOLIDAY_MIN_HOURS.value)}시간`}
          />
        </RateTable>

        <H2>왜 월 209시간인가</H2>
        <P>
          1년은 365일 ÷ 7 = 52.14주입니다. 주 40시간 소정근로에 유급 주휴 8시간을 더하면 주
          48시간이고, 48 × 52.14 ÷ 12 = 208.57시간이 됩니다. 실무에서는 이를 반올림한{" "}
          <strong>209시간</strong>을 표준으로 씁니다. 10,320원 × 209시간 = 2,156,880원이 바로 고시된
          월 환산액입니다.
        </P>

        <H2>근로시간별 월급 환산표 (주휴수당 포함)</H2>
        <div className="my-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">주 소정근로</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">주휴시간</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">월 환산시간</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">월급(세전)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {HOURS.map((h) => {
                const r = hourlyToMonthly(MIN_WAGE_HOURLY.value, h, true);
                return (
                  <tr key={h}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">
                      {h}시간
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                      {num(r.weeklyHolidayHours, 1)}시간
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                      {num(r.monthlyHours)}시간
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {won(r.monthlyPay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs leading-relaxed text-slate-500">
            주 15시간 미만은 주휴수당이 발생하지 않아 주휴시간이 0입니다(근로기준법 제18조 제3항).
          </p>
        </div>

        <H2>최저임금에 포함되는 것과 안 되는 것</H2>
        <UL>
          <li>포함: 기본급, 매월 정기적으로 지급되는 고정수당(직책수당·기술수당 등)</li>
          <li>포함(단계적 확대 완료): 매월 지급되는 상여금과 현금성 복리후생비 전액</li>
          <li>제외: 연장·야간·휴일근로수당, 연차수당 등 소정근로 대가가 아닌 임금</li>
          <li>제외: 현물로 주는 식사, 기숙사 제공 등 비현금성 복리후생</li>
        </UL>

        <H2>수습기간 감액</H2>
        <P>
          1년 이상 근로계약을 맺은 경우에만 수습 시작 후 3개월 이내에 최저임금의 90%까지 감액할 수
          있습니다. 계약기간이 1년 미만이거나 고용노동부가 고시한 단순노무 직종(음식 배달, 주유원,
          매장 계산원 등)은 수습이어도 감액이 허용되지 않습니다.
        </P>

        <H2>내 시급이 최저임금에 미달하는지 확인하려면</H2>
        <P>
          월급을 209시간으로 나눠 보세요. 그 값이 10,320원보다 낮으면 최저임금 위반일 수 있습니다.
          다만 월급에 연장근로수당이 섞여 있으면 단순히 나누는 것만으로는 정확하지 않습니다.{" "}
          <Link href="/tools/hourly-wage/" className="text-teal-700 hover:underline">
            시급 월급 환산 계산기
          </Link>
          에서 소정근로시간을 넣고 확인하세요. 위반이 의심되면 고용노동부 고객상담센터(☎1350)에
          문의할 수 있습니다.
        </P>
      </GuideShell>
    </>
  );
}
