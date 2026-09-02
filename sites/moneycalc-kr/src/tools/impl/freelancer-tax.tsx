"use client";

import { useMemo } from "react";
import {
  CalcFrame,
  ResultCard,
  TAX_DISCLAIMER,
  type CompareRow,
} from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  FREELANCER_WITHHOLDING_RATE,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
} from "@/data/rates-2026";
import { freelancerTax } from "@/lib/calc/tax";
import { num, pct, won } from "@/lib/money";

type Input = {
  gross: number;
  monthsPerYear: number;
  expenseRate: number;
  deductions: number;
};

const RATES = [FREELANCER_WITHHOLDING_RATE, INCOME_TAX_BRACKETS, LOCAL_INCOME_TAX_RATE];

const calc = (i: Input) =>
  freelancerTax(i.gross, i.monthsPerYear, i.expenseRate / 100, i.deductions);

export default function FreelancerTax() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { gross: 3_000_000, monthsPerYear: 12, expenseRate: 60, deductions: 1_500_000 },
    { gross: 5_000_000 },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "계약금액", a: won(a.gross), b: won(b.gross) },
    { label: "원천징수 3.3%", a: won(ra.withheld), b: won(rb.withheld) },
    { label: "실수령액", a: won(ra.net), b: won(rb.net), better: ra.net >= rb.net ? "a" : "b" },
    { label: "연 환산 수입", a: won(ra.annualGross), b: won(rb.annualGross) },
    {
      label: ra.refundOrPay >= 0 ? "예상 환급" : "예상 추가납부",
      a: won(Math.abs(ra.refundOrPay)),
      b: won(Math.abs(rb.refundOrPay)),
    },
  ];

  return (
    <CalcFrame
      ab={ab}
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          필요경비율은 업종코드와 수입 규모에 따라 단순경비율·기준경비율·장부기장 중 무엇을
          적용받는지가 달라집니다. 여기서는 직접 입력한 경비율로만 추정하며 세액공제도 반영하지
          않았습니다. {TAX_DISCLAIMER}
        </>
      }
      inputs={
        <>
          <Fieldset legend="이번 달 정산">
            <Row>
              <NumberField
                label="계약금액(세전)"
                value={cur.gross}
                onChange={set("gross")}
                suffix="원"
                step={100_000}
                money
                hint="세금계산서·인적용역 사업소득 기준 지급총액입니다."
              />
              <NumberField
                label="연간 활동 개월 수"
                value={cur.monthsPerYear}
                onChange={set("monthsPerYear")}
                suffix="개월"
                min={1}
                max={12}
                hint="이만큼 같은 금액을 받는다고 가정해 5월 종합소득세를 추정합니다."
              />
            </Row>
          </Fieldset>
          <Fieldset legend="5월 종합소득세 추정용">
            <Row>
              <NumberField
                label="필요경비율"
                value={cur.expenseRate}
                onChange={set("expenseRate")}
                suffix="%"
                step={1}
                max={100}
                hint="단순경비율은 업종마다 다릅니다(예: 작가 58.7%, 강사 61.7% 등). 홈택스에서 본인 업종코드를 확인하세요."
              />
              <NumberField
                label="소득공제 합계"
                value={cur.deductions}
                onChange={set("deductions")}
                suffix="원"
                step={100_000}
                money
                hint="본인 기본공제 150만원 + 국민연금 보험료 등."
              />
            </Row>
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="이번 달 실수령액"
          headline={won(r.net)}
          sub={`계약금액 ${won(r.gross)} − 원천징수 ${won(r.withheld)} (${pct(FREELANCER_WITHHOLDING_RATE.value, 1)})`}
          lines={[
            { label: "소득세 3%", value: `-${won(r.incomeTax)}`, tone: "minus" },
            { label: "지방소득세 0.3%", value: `-${won(r.localTax)}`, tone: "minus" },
            { label: "연 환산 수입", value: won(r.annualGross) },
            { label: "추정 필요경비", value: won(r.estimatedExpense), hint: `${num(cur.expenseRate)}%` },
            { label: "연간 결정세액(추정)", value: won(r.estimatedFinalTax) },
            { label: "기납부 원천징수세액", value: won(r.withheld * cur.monthsPerYear) },
            {
              label: r.refundOrPay >= 0 ? "5월 예상 환급액" : "5월 예상 추가 납부액",
              value: won(Math.abs(r.refundOrPay)),
              tone: r.refundOrPay >= 0 ? "plus" : "minus",
            },
          ]}
        >
          <p className="mt-3 rounded-lg bg-white/70 p-2.5 text-[13px] leading-relaxed text-slate-600">
            3.3%는 세금이 확정된 것이 아니라 <strong>미리 떼어 둔 선납</strong>입니다. 수입이 적으면
            5월 종합소득세 신고로 상당 부분을 돌려받고, 수입이 크면 오히려 더 내야 합니다.
          </p>
        </ResultCard>
      }
    />
  );
}
