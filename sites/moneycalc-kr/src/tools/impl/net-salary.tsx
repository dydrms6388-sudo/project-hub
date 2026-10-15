"use client";

import { useMemo } from "react";
import {
  CalcFrame,
  ResultCard,
  TAX_DISCLAIMER,
  type CompareRow,
} from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  EI_RATE_EMPLOYEE,
  EARNED_INCOME_DEDUCTION,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
  LTC_RATE_OF_HEALTH,
  NHIS_RATE_EMPLOYEE,
  NPS_BASE_MAX,
  NPS_BASE_MIN,
  NPS_RATE_EMPLOYEE,
  PERSONAL_DEDUCTION,
  SIMPLE_TAX_TABLE_METHOD,
  WC_RATE_NOTE,
  EARNED_INCOME_TAX_CREDIT,
} from "@/data/rates-2026";
import { netSalary } from "@/lib/calc/labor";
import { pct, won } from "@/lib/money";

type Input = {
  annualGross: number;
  nonTaxableMonthly: number;
  family: number;
  severanceSeparate: boolean;
};

const RATES = [
  NPS_RATE_EMPLOYEE,
  NPS_BASE_MIN,
  NPS_BASE_MAX,
  NHIS_RATE_EMPLOYEE,
  LTC_RATE_OF_HEALTH,
  EI_RATE_EMPLOYEE,
  WC_RATE_NOTE,
  EARNED_INCOME_DEDUCTION,
  PERSONAL_DEDUCTION,
  INCOME_TAX_BRACKETS,
  EARNED_INCOME_TAX_CREDIT,
  LOCAL_INCOME_TAX_RATE,
  SIMPLE_TAX_TABLE_METHOD,
];

export default function NetSalary() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { annualGross: 50_000_000, nonTaxableMonthly: 200_000, family: 1, severanceSeparate: true },
    { annualGross: 60_000_000 },
  );

  const ra = useMemo(() => netSalary(a), [a]);
  const rb = useMemo(() => netSalary(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "연봉(세전)", a: won(a.annualGross), b: won(b.annualGross) },
    { label: "월 세전 급여", a: won(ra.monthlyGross), b: won(rb.monthlyGross) },
    { label: "4대보험", a: won(ra.insurance.total), b: won(rb.insurance.total) },
    { label: "소득세+지방소득세", a: won(ra.tax.total), b: won(rb.tax.total) },
    {
      label: "월 실수령액",
      a: won(ra.monthlyNet),
      b: won(rb.monthlyNet),
      better: ra.monthlyNet >= rb.monthlyNet ? "a" : "b",
    },
    { label: "연 실수령액", a: won(ra.annualNet), b: won(rb.annualNet) },
    { label: "공제율", a: pct(ra.effectiveRate, 1), b: pct(rb.effectiveRate, 1) },
  ];

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <CalcFrame
      ab={ab}
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          국세청 근로소득 간이세액표 원본(월급여·부양가족수별 수천 행)을 그대로 담지 않고,{" "}
          <strong>간이세액표를 만드는 절차와 같은 방식으로 추정</strong>했습니다. 실제 원천징수액과
          월 수천 원 차이가 날 수 있으며 연말정산으로 정산됩니다. {TAX_DISCLAIMER}
        </>
      }
      inputs={
        <Fieldset legend="연봉 정보">
          <Row>
            <NumberField
              label="연봉(세전)"
              value={cur.annualGross}
              onChange={set("annualGross")}
              suffix="원"
              step={1_000_000}
              money
              quick={[
                { label: "+100만", delta: 1_000_000 },
                { label: "+500만", delta: 5_000_000 },
                { label: "-100만", delta: -1_000_000 },
              ]}
            />
            <NumberField
              label="월 비과세액"
              value={cur.nonTaxableMonthly}
              onChange={set("nonTaxableMonthly")}
              suffix="원"
              step={10_000}
              hint="식대는 월 20만원까지 비과세입니다. 자가운전보조금(월 20만원) 등이 있으면 더하세요."
            />
          </Row>
          <Row>
            <NumberField
              label="공제대상 가족 수(본인 포함)"
              value={cur.family}
              onChange={set("family")}
              suffix="명"
              min={1}
              max={11}
              hint="배우자·부양가족을 포함한 기본공제 대상 인원. 1인당 연 150만원이 공제됩니다."
            />
            <ToggleField
              label="퇴직금 별도 계약"
              checked={cur.severanceSeparate}
              onChange={set("severanceSeparate")}
              hint="체크하면 연봉을 12로, 해제하면 퇴직금 포함으로 보고 13으로 나눕니다."
            />
          </Row>
        </Fieldset>
      }
      result={
        <ResultCard
          headlineLabel="월 실수령액"
          headline={won(r.monthlyNet)}
          sub={`연 실수령액 ${won(r.annualNet)} · 공제율 ${pct(r.effectiveRate, 1)}`}
          lines={[
            { label: "월 세전 급여", value: won(r.monthlyGross) },
            { label: "국민연금", value: `-${won(r.insurance.pension)}`, tone: "minus", hint: "4.75%" },
            { label: "건강보험", value: `-${won(r.insurance.health)}`, tone: "minus", hint: "3.595%" },
            {
              label: "장기요양보험",
              value: `-${won(r.insurance.longTermCare)}`,
              tone: "minus",
              hint: "건보료의 13.14%",
            },
            { label: "고용보험", value: `-${won(r.insurance.employment)}`, tone: "minus", hint: "0.9%" },
            { label: "소득세", value: `-${won(r.tax.incomeTax)}`, tone: "minus" },
            { label: "지방소득세", value: `-${won(r.tax.localTax)}`, tone: "minus" },
            { label: "공제 합계", value: `-${won(r.deductionTotal)}`, tone: "minus" },
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📅 월별 실수령액 표
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">월</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">세전</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">공제</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">실수령</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((m) => (
                  <tr key={m}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">{m}월</th>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{won(r.monthlyGross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">-{won(r.deductionTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{won(r.monthlyNet)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <th scope="row" className="px-3 py-2 text-left text-slate-700">합계</th>
                  <td className="px-3 py-2 text-right tabular-nums">{won(r.monthlyGross * 12)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">-{won(r.deductionTotal * 12)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{won(r.annualNet)}</td>
                </tr>
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs leading-relaxed text-slate-500">
              성과급·연장근로수당이 있는 달은 실제 공제액이 달라집니다. 매달 같은 급여를 받는다고
              가정한 표입니다.
            </p>
          </div>
        </details>
      }
    />
  );
}
