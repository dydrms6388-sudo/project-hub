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
  EI_RATE_EMPLOYEE,
  LTC_RATE_OF_HEALTH,
  LTC_RATE_OF_INCOME,
  NHIS_RATE_EMPLOYEE,
  NHIS_RATE_TOTAL,
  NPS_BASE_MAX,
  NPS_BASE_MIN,
  NPS_RATE_EMPLOYEE,
  NPS_RATE_TOTAL,
  WC_RATE_NOTE,
} from "@/data/rates-2026";
import { pct, won } from "@/lib/money";

const meta: GuideMeta = {
  slug: "four-insurance-2026",
  title: "2026년 4대보험 요율표 — 근로자 부담 정리",
  h1: "2026년 4대보험 요율표",
  description:
    "2026년 국민연금 9.5%, 건강보험 7.19%, 장기요양 13.14%, 고용보험 0.9%. 근로자가 실제로 부담하는 요율과 계산 순서를 출처와 함께 정리했습니다.",
  keywords: ["2026 4대보험 요율", "국민연금 9.5", "건강보험료율 7.19", "장기요양보험료율", "고용보험 요율"],
  updated: "2026-08-19",
  relatedTools: ["net-salary", "hourly-wage", "freelancer-tax"],
};

export const metadata: Metadata = guideMetadata(meta);

export default function Page() {
  return (
    <>
      <JsonLd data={guideJsonLd(meta)} />
      <GuideShell meta={meta}>
        <P>
          2026년은 4대보험 부담이 눈에 띄게 늘어난 해입니다. 2025년 국민연금법 개정으로 보험료율이
          18년 만에 올랐고, 건강보험과 장기요양보험도 함께 인상되었습니다. 아래 표는 <strong>근로자
          급여에서 실제로 빠지는 요율</strong>만 정리한 것입니다.
        </P>

        <H2>근로자 부담 요율 한눈에 보기</H2>
        <RateTable caption="2026년 직장가입자(근로자) 부담 요율">
          <RateRow rate={NPS_RATE_EMPLOYEE} valueText={pct(NPS_RATE_EMPLOYEE.value, 3)} />
          <RateRow rate={NHIS_RATE_EMPLOYEE} valueText={pct(NHIS_RATE_EMPLOYEE.value, 3)} />
          <RateRow rate={LTC_RATE_OF_HEALTH} valueText={`건강보험료 × ${pct(LTC_RATE_OF_HEALTH.value, 2)}`} />
          <RateRow rate={EI_RATE_EMPLOYEE} valueText={pct(EI_RATE_EMPLOYEE.value, 2)} />
          <RateRow rate={WC_RATE_NOTE} valueText="0% (전액 사업주)" />
        </RateTable>

        <H2>전체 요율(노사 합계)</H2>
        <RateTable caption="근로자와 사업주가 함께 부담하는 전체 요율">
          <RateRow rate={NPS_RATE_TOTAL} valueText={pct(NPS_RATE_TOTAL.value, 2)} />
          <RateRow rate={NHIS_RATE_TOTAL} valueText={pct(NHIS_RATE_TOTAL.value, 3)} />
          <RateRow rate={LTC_RATE_OF_INCOME} valueText={pct(LTC_RATE_OF_INCOME.value, 4)} />
        </RateTable>

        <H2>국민연금 기준소득월액 상·하한</H2>
        <P>
          국민연금은 소득 전체에 요율을 곱하지 않습니다. 기준소득월액에 상·하한이 있어, 상한을 넘는
          고소득자는 보험료가 고정됩니다. 상·하한액은 매년 7월에 조정됩니다.
        </P>
        <RateTable caption="2026년 7월 ~ 2027년 6월 적용">
          <RateRow rate={NPS_BASE_MIN} valueText={won(NPS_BASE_MIN.value)} />
          <RateRow rate={NPS_BASE_MAX} valueText={won(NPS_BASE_MAX.value)} />
        </RateTable>

        <H2>계산 순서</H2>
        <P>
          급여명세서의 공제 항목은 다음 순서로 계산됩니다. 모든 계산은 <strong>비과세를 뺀 과세대상
          급여</strong>를 기준으로 합니다.
        </P>
        <UL>
          <li>과세대상 급여 = 총급여 − 비과세(식대 월 20만원 등)</li>
          <li>국민연금 = min(max(과세대상 급여, 하한), 상한) × 4.75%</li>
          <li>건강보험 = 과세대상 급여 × 3.595%</li>
          <li>장기요양보험 = 건강보험료 × 13.14% (소득 대비로는 약 0.9448%)</li>
          <li>고용보험 = 과세대상 급여 × 0.9%</li>
          <li>산재보험 = 0원 (전액 사업주 부담)</li>
        </UL>

        <H2>2026년에 달라진 점</H2>
        <UL>
          <li>
            국민연금 보험료율이 9% → 9.5%로 올랐습니다. 2033년 13%가 될 때까지 매년 0.5%p씩
            인상됩니다. 근로자 부담은 4.5% → 4.75%입니다.
          </li>
          <li>건강보험료율이 7.09% → 7.19%로 0.10%p 인상되었습니다.</li>
          <li>
            장기요양보험료율은 소득 대비 0.9182% → 0.9448%로 올랐습니다. 건강보험료 대비로는
            12.95% → 13.14%입니다.
          </li>
          <li>고용보험(실업급여) 근로자 부담 0.9%는 유지되었습니다.</li>
        </UL>

        <H2>주의할 점</H2>
        <P>
          위 표에서 <strong>&ldquo;확인 필요&rdquo; 배지가 붙은 항목</strong>은 정부·공단의 1차
          출처에서 값을 직접 확인하지 못한 것입니다. 마지막으로 알려진 값을 그대로 적어 두었으니,
          중요한 판단에 쓰기 전에 출처 링크에서 원문을 확인해 주세요.
        </P>
        <P>
          실제 급여명세서와 원 단위 차이가 나는 것은 정상입니다. 보험료는 원 단위 절사 관행이 있고,
          매년 4월 건강보험 정산과 7월 국민연금 기준소득월액 조정이 반영되는 달에는 공제액이 크게
          달라집니다.{" "}
          <Link href="/tools/net-salary/" className="text-teal-700 hover:underline">
            연봉 실수령액 계산기
          </Link>
          에서 본인 조건으로 직접 계산해 보세요.
        </P>
      </GuideShell>
    </>
  );
}
