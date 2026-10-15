"use client";

import { useMemo } from "react";
import { CalcFrame, CompareTable, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { BOK_BASE_RATE, JEONSE_CONVERSION_CAP, JEONSE_CONVERSION_SPREAD } from "@/data/rates-2026";
import { rentVsBuy } from "@/lib/calc/property";
import { num, won } from "@/lib/money";

type Input = {
  jeonseDeposit: number;
  jeonseLoan: number;
  jeonseLoanRatePct: number;
  monthlyDeposit: number;
  monthlyRent: number;
  monthlyExtra: number;
  savingRatePct: number;
  months: number;
};

const RATES = [BOK_BASE_RATE, JEONSE_CONVERSION_CAP, JEONSE_CONVERSION_SPREAD];

const calc = (i: Input) =>
  rentVsBuy({
    jeonseDeposit: i.jeonseDeposit,
    jeonseLoan: i.jeonseLoan,
    jeonseLoanRate: i.jeonseLoanRatePct / 100,
    monthlyDeposit: i.monthlyDeposit,
    monthlyRent: i.monthlyRent,
    monthlyExtra: i.monthlyExtra,
    savingRate: i.savingRatePct / 100,
    months: i.months,
  });

export default function RentVsBuy() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      jeonseDeposit: 300_000_000,
      jeonseLoan: 200_000_000,
      jeonseLoanRatePct: 3.5,
      monthlyDeposit: 30_000_000,
      monthlyRent: 900_000,
      monthlyExtra: 0,
      savingRatePct: 3.0,
      months: 24,
    },
    { monthlyRent: 700_000 },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "전세 월 주거비", a: won(ra.jeonseMonthlyCost), b: won(rb.jeonseMonthlyCost) },
    { label: "월세 월 주거비", a: won(ra.monthlyCost), b: won(rb.monthlyCost) },
    {
      label: "유리한 쪽",
      a: ra.winner === "jeonse" ? "전세" : ra.winner === "monthly" ? "월세" : "동일",
      b: rb.winner === "jeonse" ? "전세" : rb.winner === "monthly" ? "월세" : "동일",
    },
  ];

  const mainRows: CompareRow[] = [
    {
      label: "월 실질 주거비",
      a: won(r.jeonseMonthlyCost),
      b: won(r.monthlyCost),
      better: r.jeonseMonthlyCost <= r.monthlyCost ? "a" : "b",
    },
    {
      label: `${num(cur.months)}개월 누적`,
      a: won(r.jeonseTotal),
      b: won(r.monthlyTotal),
      better: r.jeonseTotal <= r.monthlyTotal ? "a" : "b",
    },
    { label: "묶이는 목돈", a: won(cur.jeonseDeposit), b: won(cur.monthlyDeposit) },
  ];

  return (
    <CalcFrame
      ab={ab}
      labelA="월세 90만"
      labelB="월세 70만"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          이 비교는 <strong>현금 흐름과 기회비용만</strong> 봅니다. 전세보증금 미반환 위험(전세사기),
          전세보증금 반환보증 보험료, 월세 세액공제, 이사비·중개수수료, 집값·전세가 변동은 반영되어
          있지 않습니다. 전세를 고를 때는 등기부등본·보증보험 가입 가능 여부를 반드시 확인하세요.
        </>
      }
      inputs={
        <>
          <Fieldset legend="전세 조건">
            <Row>
              <NumberField
                label="전세보증금"
                value={cur.jeonseDeposit}
                onChange={set("jeonseDeposit")}
                suffix="원"
                step={10_000_000}
                money
              />
              <NumberField
                label="전세자금대출 금액"
                value={cur.jeonseLoan}
                onChange={set("jeonseLoan")}
                suffix="원"
                step={10_000_000}
                money
              />
            </Row>
            <NumberField
              label="전세대출 금리"
              value={cur.jeonseLoanRatePct}
              onChange={set("jeonseLoanRatePct")}
              suffix="%"
              step={0.1}
            />
          </Fieldset>
          <Fieldset legend="월세 조건">
            <Row>
              <NumberField
                label="월세 보증금"
                value={cur.monthlyDeposit}
                onChange={set("monthlyDeposit")}
                suffix="원"
                step={5_000_000}
                money
              />
              <NumberField
                label="월세"
                value={cur.monthlyRent}
                onChange={set("monthlyRent")}
                suffix="원"
                step={50_000}
                money
              />
            </Row>
            <NumberField
              label="월세 쪽 추가 비용(관리비 차액 등)"
              value={cur.monthlyExtra}
              onChange={set("monthlyExtra")}
              suffix="원"
              step={10_000}
              hint="월세 집의 관리비가 더 비싸면 그 차액을 넣으세요."
            />
          </Fieldset>
          <Fieldset legend="비교 기준">
            <Row>
              <NumberField
                label="여윳돈 운용 수익률"
                value={cur.savingRatePct}
                onChange={set("savingRatePct")}
                suffix="%"
                step={0.1}
                hint="보증금으로 묶이지 않았다면 예금·투자로 얻었을 연 수익률(기회비용)입니다."
              />
              <NumberField
                label="비교 기간"
                value={cur.months}
                onChange={set("months")}
                suffix="개월"
                step={12}
                min={1}
              />
            </Row>
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={`${num(cur.months)}개월 기준 유리한 쪽`}
          headline={r.winner === "jeonse" ? "전세" : r.winner === "monthly" ? "월세" : "거의 같음"}
          sub={r.winner === "tie" ? "두 선택지의 실질 주거비가 사실상 같습니다." : `누적 ${won(r.gap)} 차이`}
          lines={[
            { label: "전세 — 월 실질 주거비", value: won(r.jeonseMonthlyCost) },
            { label: "월세 — 월 실질 주거비", value: won(r.monthlyCost) },
            { label: `전세 — ${num(cur.months)}개월 누적`, value: won(r.jeonseTotal) },
            { label: `월세 — ${num(cur.months)}개월 누적`, value: won(r.monthlyTotal) },
          ]}
        />
      }
      extra={<CompareTable rows={mainRows} labelA="전세" labelB="월세" />}
    />
  );
}
