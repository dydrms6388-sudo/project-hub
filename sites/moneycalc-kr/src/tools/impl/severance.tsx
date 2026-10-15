"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { DateField, Fieldset, NumberField, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { SEVERANCE_DAYS_PER_YEAR, SEVERANCE_MIN_MONTHS } from "@/data/rates-2026";
import { severanceCalc } from "@/lib/calc/labor";
import { num, won } from "@/lib/money";

type Input = {
  joinDate: string;
  leaveDate: string;
  lastThreeMonthsPay: number;
  annualBonus: number;
  annualLeaveAllowance: number;
  dailyOrdinaryWage: number;
};

const RATES = [SEVERANCE_MIN_MONTHS, SEVERANCE_DAYS_PER_YEAR];

export default function Severance() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      joinDate: "2021-03-02",
      leaveDate: "2026-03-02",
      lastThreeMonthsPay: 9_000_000,
      annualBonus: 0,
      annualLeaveAllowance: 0,
      dailyOrdinaryWage: 0,
    },
    { annualBonus: 6_000_000, annualLeaveAllowance: 1_000_000 },
  );

  const ra = useMemo(() => severanceCalc(a), [a]);
  const rb = useMemo(() => severanceCalc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;
  const eligible = r.serviceDays >= 365;

  const compareRows: CompareRow[] = [
    { label: "재직일수", a: `${num(ra.serviceDays)}일`, b: `${num(rb.serviceDays)}일` },
    { label: "1일 평균임금", a: won(ra.averageDailyWage), b: won(rb.averageDailyWage) },
    {
      label: "퇴직금",
      a: won(ra.severance),
      b: won(rb.severance),
      better: ra.severance >= rb.severance ? "a" : "b",
    },
  ];

  return (
    <CalcFrame
      ab={ab}
      labelA="연차수당 미포함"
      labelB="연차수당 포함"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          평균임금 산정기간에 산입·제외되는 임금 항목(육아휴직·업무상 부상 기간 등)은 사안마다
          다릅니다. 이 계산은 <strong>근로자퇴직급여 보장법의 기본 산식</strong>만 적용한
          참고값이며, 실제 지급액이 다르면 고용노동부 임금체불 상담(☎1350)이나 노무사와
          확인하세요.
        </>
      }
      inputs={
        <>
          <Fieldset legend="재직 기간">
            <Row>
              <DateField label="입사일" value={cur.joinDate} onChange={set("joinDate")} />
              <DateField
                label="퇴사일"
                value={cur.leaveDate}
                onChange={set("leaveDate")}
                hint="마지막 근무일의 다음 날을 넣으면 재직일수가 정확해집니다."
              />
            </Row>
          </Fieldset>
          <Fieldset legend="평균임금 산정 자료">
            <Row>
              <NumberField
                label="퇴직 전 3개월 임금 총액"
                value={cur.lastThreeMonthsPay}
                onChange={set("lastThreeMonthsPay")}
                suffix="원"
                step={100_000}
                money
                hint="기본급 + 고정수당 + 연장·야간·휴일수당까지 세전 기준으로 모두 더합니다."
              />
              <NumberField
                label="연간 상여금 총액"
                value={cur.annualBonus}
                onChange={set("annualBonus")}
                suffix="원"
                step={100_000}
                money
                hint="퇴직 전 1년간 받은 상여금. 이 중 3/12만 평균임금에 산입됩니다."
              />
            </Row>
            <Row>
              <NumberField
                label="연차수당(전년도 지급분)"
                value={cur.annualLeaveAllowance}
                onChange={set("annualLeaveAllowance")}
                suffix="원"
                step={100_000}
                money
                hint="퇴직 전전년도 출근율로 발생해 전년도에 받은 연차수당. 3/12만 산입됩니다."
              />
              <NumberField
                label="1일 통상임금(선택)"
                value={cur.dailyOrdinaryWage}
                onChange={set("dailyOrdinaryWage")}
                suffix="원"
                step={10_000}
                hint="0이면 비교하지 않습니다. 평균임금이 통상임금보다 적으면 통상임금을 씁니다."
              />
            </Row>
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="예상 퇴직금(세전)"
          headline={eligible ? won(r.severance) : "지급 대상 아님"}
          sub={
            eligible
              ? `1일 평균임금 ${won(r.usedDailyWage)} × 30일 × ${num(r.serviceDays)}일 ÷ 365`
              : "계속근로기간이 1년 미만이면 법정 퇴직금이 발생하지 않습니다."
          }
          lines={[
            { label: "재직일수", value: `${num(r.serviceDays)}일 (약 ${(r.serviceDays / 365).toFixed(2)}년)` },
            { label: "평균임금 산정기간", value: `${num(r.periodDays)}일` },
            { label: "1일 평균임금", value: won(r.averageDailyWage) },
            {
              label: "적용 임금",
              value: r.usedOrdinary ? `통상임금 ${won(r.usedDailyWage)}` : `평균임금 ${won(r.usedDailyWage)}`,
              hint: r.usedOrdinary ? "통상임금이 더 큼" : undefined,
            },
          ]}
        >
          {eligible ? (
            <p className="mt-3 rounded-lg bg-white/70 p-2.5 text-[13px] leading-relaxed text-slate-600">
              퇴직소득세는 근속연수공제·환산급여공제를 거쳐 따로 계산되며 위 금액에서 원천징수됩니다.
              근속기간이 길수록 실효세율이 크게 낮아집니다.
            </p>
          ) : null}
        </ResultCard>
      }
    />
  );
}
