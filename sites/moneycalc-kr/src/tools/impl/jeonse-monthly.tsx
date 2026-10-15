"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, RadioGroup, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  BOK_BASE_RATE,
  JEONSE_CONVERSION_CAP,
  JEONSE_CONVERSION_SPREAD,
} from "@/data/rates-2026";
import { actualConversionRate, jeonseToMonthly, monthlyToJeonse } from "@/lib/calc/property";
import { num, pct, won } from "@/lib/money";

type Direction = "toMonthly" | "toDeposit";
type Input = {
  direction: Direction;
  convertAmount: number;
  monthlyRent: number;
  baseRatePct: number;
  useCustomRate: boolean;
  customRatePct: number;
};

const RATES = [JEONSE_CONVERSION_CAP, JEONSE_CONVERSION_SPREAD, BOK_BASE_RATE];

const calc = (i: Input) => {
  const custom = i.useCustomRate ? i.customRatePct / 100 : null;
  return i.direction === "toMonthly"
    ? jeonseToMonthly(i.convertAmount, i.baseRatePct / 100, custom)
    : monthlyToJeonse(i.monthlyRent, i.baseRatePct / 100, custom);
};

export default function JeonseMonthly() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      direction: "toMonthly",
      convertAmount: 100_000_000,
      monthlyRent: 500_000,
      baseRatePct: BOK_BASE_RATE.value * 100,
      useCustomRate: false,
      customRatePct: 6,
    },
    { useCustomRate: true },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "적용 전환율", a: pct(ra.actualRate, 2), b: pct(rb.actualRate, 2) },
    { label: "월세", a: won(ra.monthlyRent), b: won(rb.monthlyRent), better: ra.monthlyRent <= rb.monthlyRent ? "a" : "b" },
    { label: "보증금", a: won(ra.convertedDeposit), b: won(rb.convertedDeposit) },
  ];

  const actual =
    cur.direction === "toMonthly"
      ? actualConversionRate(cur.convertAmount, r.monthlyRent)
      : actualConversionRate(r.convertedDeposit, cur.monthlyRent);

  return (
    <CalcFrame
      ab={ab}
      labelA="법정 전환율"
      labelB="직접 입력"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          법정 전환율 상한은 <strong>기존 계약의 보증금을 월세로 바꿀 때</strong> 적용됩니다(주택
          임대차보호법 제7조의2). 계약이 끝나고 새로 맺는 신규 계약에는 강제되지 않아 시장 전환율이
          더 높은 경우가 많습니다. 분쟁이 생기면 대한법률구조공단 주택임대차분쟁조정위원회에 조정을
          신청할 수 있습니다.
        </>
      }
      inputs={
        <>
          <Fieldset legend="전환 방향">
            <RadioGroup<Direction>
              label="무엇을 계산할까요?"
              value={cur.direction}
              onChange={set("direction")}
              options={[
                { value: "toMonthly", label: "보증금 → 월세" },
                { value: "toDeposit", label: "월세 → 보증금" },
              ]}
            />
          </Fieldset>
          <Fieldset legend="금액">
            {cur.direction === "toMonthly" ? (
              <NumberField
                label="월세로 전환할 보증금"
                value={cur.convertAmount}
                onChange={set("convertAmount")}
                suffix="원"
                step={10_000_000}
                money
                hint="전세보증금 전부가 아니라, 월세로 돌릴 금액만 넣으세요."
                quick={[
                  { label: "+1,000만", delta: 10_000_000 },
                  { label: "+1억", delta: 100_000_000 },
                ]}
              />
            ) : (
              <NumberField
                label="보증금으로 되돌릴 월세"
                value={cur.monthlyRent}
                onChange={set("monthlyRent")}
                suffix="원"
                step={50_000}
                money
              />
            )}
          </Fieldset>
          <Fieldset legend="전환율">
            <Row>
              <NumberField
                label="한국은행 기준금리"
                value={cur.baseRatePct}
                onChange={set("baseRatePct")}
                suffix="%"
                step={0.25}
                hint="금융통화위원회 회의마다 바뀝니다. 최신 값으로 직접 수정하세요."
              />
              <NumberField
                label="직접 입력할 전환율"
                value={cur.customRatePct}
                onChange={set("customRatePct")}
                suffix="%"
                step={0.5}
                hint="실제 계약에 쓰인 전환율을 넣어 법정 상한과 비교해 보세요."
              />
            </Row>
            <ToggleField
              label="법정 전환율 대신 직접 입력한 값 사용"
              checked={cur.useCustomRate}
              onChange={set("useCustomRate")}
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={cur.direction === "toMonthly" ? "월세" : "환산 보증금"}
          headline={cur.direction === "toMonthly" ? won(r.monthlyRent) : won(r.convertedDeposit)}
          sub={`적용 전환율 연 ${pct(r.actualRate, 2)} · 법정 상한 연 ${pct(r.legalRate, 2)}`}
          lines={[
            { label: "법정 전환율", value: pct(r.legalRate, 2), hint: `기준금리 ${num(cur.baseRatePct, 2)}% + 2%` },
            { label: "적용 전환율", value: pct(r.actualRate, 2) },
            { label: "보증금", value: won(r.convertedDeposit) },
            { label: "월세", value: won(r.monthlyRent) },
            { label: "연간 임대료", value: won(r.monthlyRent * 12) },
            { label: "실제 전환율(역산)", value: pct(actual, 2) },
          ]}
        >
          {r.overLegal ? (
            <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-[13px] font-medium leading-relaxed text-rose-800">
              ⚠️ 적용 전환율 {pct(r.actualRate, 2)}가 법정 상한 {pct(r.legalRate, 2)}를 넘습니다.
              기존 계약의 전세→월세 전환이라면 초과분은 무효를 주장할 수 있습니다.
            </p>
          ) : null}
        </ResultCard>
      }
    />
  );
}
