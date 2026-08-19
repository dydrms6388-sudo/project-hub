"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, RadioGroup, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  MIN_WAGE_HOURLY,
  MIN_WAGE_MONTHLY,
  MONTHLY_WORK_HOURS,
  WEEKLY_HOLIDAY_MIN_HOURS,
} from "@/data/rates-2026";
import { hourlyToMonthly, monthlyToHourly } from "@/lib/calc/labor";
import { num, won } from "@/lib/money";

type Direction = "toMonthly" | "toHourly";
type Input = {
  direction: Direction;
  hourly: number;
  monthly: number;
  hoursPerWeek: number;
  includeWeeklyHoliday: boolean;
};

const RATES = [MIN_WAGE_HOURLY, MIN_WAGE_MONTHLY, MONTHLY_WORK_HOURS, WEEKLY_HOLIDAY_MIN_HOURS];

const calc = (i: Input) =>
  i.direction === "toMonthly"
    ? hourlyToMonthly(i.hourly, i.hoursPerWeek, i.includeWeeklyHoliday)
    : monthlyToHourly(i.monthly, i.hoursPerWeek, i.includeWeeklyHoliday);

export default function HourlyWage() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      direction: "toMonthly",
      hourly: MIN_WAGE_HOURLY.value,
      monthly: 2_500_000,
      hoursPerWeek: 40,
      includeWeeklyHoliday: true,
    },
    { hoursPerWeek: 20 },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "주 소정근로시간", a: `${num(a.hoursPerWeek, 1)}시간`, b: `${num(b.hoursPerWeek, 1)}시간` },
    { label: "월 환산 시간", a: `${num(ra.monthlyHours)}시간`, b: `${num(rb.monthlyHours)}시간` },
    { label: "시급", a: won(ra.hourly), b: won(rb.hourly) },
    {
      label: "월급(세전)",
      a: won(ra.monthlyPay),
      b: won(rb.monthlyPay),
      better: ra.monthlyPay >= rb.monthlyPay ? "a" : "b",
    },
  ];

  const below = r.hourly < MIN_WAGE_HOURLY.value && r.hourly > 0;

  return (
    <CalcFrame
      ab={ab}
      labelA="주 40시간"
      labelB="단시간 근로"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          연장·야간·휴일근로에는 통상임금의 50%가 가산됩니다(근로기준법 제56조). 이 계산기는 소정
          근로시간만 환산하므로 초과근로가 있으면 실제 급여는 더 큽니다. 수습기간이라도{" "}
          <strong>2026년부터 최저임금 감액은 1년 이상 근로계약을 맺은 경우에만</strong> 제한적으로
          허용됩니다.
        </>
      }
      inputs={
        <>
          <Fieldset legend="환산 방향">
            <RadioGroup<Direction>
              label="무엇을 계산할까요?"
              value={cur.direction}
              onChange={set("direction")}
              options={[
                { value: "toMonthly", label: "시급 → 월급" },
                { value: "toHourly", label: "월급 → 시급" },
              ]}
            />
          </Fieldset>
          <Fieldset legend="근로 조건">
            <Row>
              {cur.direction === "toMonthly" ? (
                <NumberField
                  label="시급"
                  value={cur.hourly}
                  onChange={set("hourly")}
                  suffix="원"
                  step={10}
                  hint={`2026년 최저임금은 ${won(MIN_WAGE_HOURLY.value)}입니다.`}
                  quick={[
                    { label: "최저임금", delta: MIN_WAGE_HOURLY.value - cur.hourly },
                    { label: "+1,000", delta: 1000 },
                  ]}
                />
              ) : (
                <NumberField
                  label="월급(세전)"
                  value={cur.monthly}
                  onChange={set("monthly")}
                  suffix="원"
                  step={10_000}
                  money
                  hint="비과세 수당을 포함한 세전 월급을 넣으세요."
                />
              )}
              <NumberField
                label="주 소정근로시간"
                value={cur.hoursPerWeek}
                onChange={set("hoursPerWeek")}
                suffix="시간"
                step={1}
                max={40}
                hint="법정 한도는 주 40시간입니다. 연장근로는 따로 계산하세요."
              />
            </Row>
            <ToggleField
              label="주휴수당 포함"
              checked={cur.includeWeeklyHoliday}
              onChange={set("includeWeeklyHoliday")}
              hint="주 15시간 이상 근무하고 소정근로일을 개근하면 유급 주휴일이 발생합니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={cur.direction === "toMonthly" ? "월급(세전)" : "시급"}
          headline={cur.direction === "toMonthly" ? won(r.monthlyPay) : won(r.hourly)}
          sub={`월 환산 ${num(r.monthlyHours)}시간 (소정 ${num(r.weeklyHours, 1)}시간 + 주휴 ${num(r.weeklyHolidayHours, 2)}시간 기준)`}
          lines={[
            { label: "시급", value: won(r.hourly) },
            { label: "주급", value: won(r.hourly * (r.weeklyHours + r.weeklyHolidayHours)) },
            { label: "월급(세전)", value: won(r.monthlyPay) },
            { label: "연봉(세전)", value: won(r.monthlyPay * 12) },
            {
              label: "2026년 최저임금 대비",
              value: below ? "미달" : `${num((r.hourly / MIN_WAGE_HOURLY.value) * 100, 1)}%`,
              tone: below ? "minus" : "plus",
            },
          ]}
        >
          {below ? (
            <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-[13px] font-medium leading-relaxed text-rose-800">
              ⚠️ 계산된 시급이 2026년 최저임금 {won(MIN_WAGE_HOURLY.value)}에 못 미칩니다. 최저임금
              위반이 의심되면 고용노동부 고객상담센터(☎1350)에 문의할 수 있습니다.
            </p>
          ) : null}
        </ResultCard>
      }
    />
  );
}
