"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { DateField, Fieldset, NumberField, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { ANNUAL_LEAVE_RULES, WEEKLY_HOLIDAY_MIN_HOURS } from "@/data/rates-2026";
import { annualLeave, leaveDaysForYears } from "@/lib/calc/labor";
import { num, won } from "@/lib/money";

type Input = { joinDate: string; baseDate: string; dailyWage: number };

const RATES = [ANNUAL_LEAVE_RULES, WEEKLY_HOLIDAY_MIN_HOURS];

export default function AnnualLeave() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { joinDate: "2023-04-01", baseDate: "2026-08-19", dailyWage: 0 },
    { joinDate: "2020-04-01" },
  );

  const ra = useMemo(() => annualLeave(a.joinDate, a.baseDate), [a]);
  const rb = useMemo(() => annualLeave(b.joinDate, b.baseDate), [b]);
  const r = ab.tab === "a" ? ra : rb;
  const dailyWage = cur.dailyWage;

  const compareRows: CompareRow[] = [
    { label: "만 근속", a: `${num(ra.years)}년 ${num(ra.months % 12)}개월`, b: `${num(rb.years)}년 ${num(rb.months % 12)}개월` },
    {
      label: "입사일 기준 연차",
      a: `${num(ra.joinBasis, 1)}일`,
      b: `${num(rb.joinBasis, 1)}일`,
      better: ra.joinBasis >= rb.joinBasis ? "a" : "b",
    },
    { label: "회계연도 기준 연차", a: `${num(ra.fiscalBasis, 1)}일`, b: `${num(rb.fiscalBasis, 1)}일` },
  ];

  const table = [1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 21, 25];

  return (
    <CalcFrame
      ab={ab}
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          출근율 80% 미만이거나 육아휴직·병가가 섞이면 발생 일수가 달라집니다. 회계연도 방식은
          회사가 관리 편의를 위해 쓰는 방식이며, <strong>퇴직 시 입사일 기준보다 적으면 차액을
          정산해 주어야</strong> 합니다(고용노동부 행정해석).
        </>
      }
      inputs={
        <>
          <Fieldset legend="근속 기간">
            <Row>
              <DateField label="입사일" value={cur.joinDate} onChange={set("joinDate")} />
              <DateField
                label="기준일"
                value={cur.baseDate}
                onChange={set("baseDate")}
                hint="이 날짜 시점에 쓸 수 있는 연차를 계산합니다."
              />
            </Row>
          </Fieldset>
          <Fieldset legend="연차수당 환산(선택)">
            <NumberField
              label="1일 통상임금"
              value={cur.dailyWage}
              onChange={set("dailyWage")}
              suffix="원"
              step={10_000}
              hint="입력하면 미사용 연차를 수당으로 환산해 보여줍니다. 0이면 생략합니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="입사일 기준 연차"
          headline={`${num(r.joinBasis, 1)}일`}
          sub={`만 ${num(r.years)}년 ${num(r.months % 12)}개월 근속 · 회계연도 기준은 ${num(r.fiscalBasis, 1)}일`}
          lines={[
            { label: "총 근속 개월", value: `${num(r.months)}개월` },
            { label: "입사일 기준", value: `${num(r.joinBasis, 1)}일` },
            { label: "회계연도(1/1) 기준", value: `${num(r.fiscalBasis, 1)}일` },
            ...(dailyWage > 0
              ? [
                  {
                    label: "전부 미사용 시 연차수당",
                    value: won(r.joinBasis * dailyWage),
                    hint: "입사일 기준",
                  },
                ]
              : []),
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📗 근속연수별 연차 일수 표 (근로기준법 제60조)
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">계속근로</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">연차 일수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">1년 미만</th>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">1개월 개근당 1일 (최대 11일)</td>
                </tr>
                {table.map((y) => (
                  <tr key={y}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">{y}년</th>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{leaveDaysForYears(y)}일</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      }
    />
  );
}
