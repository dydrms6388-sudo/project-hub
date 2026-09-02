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
  CAPITAL_GAINS_BASIC_DEDUCTION,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
  LTHD_TABLE,
  ONE_HOUSE_EXEMPT_PRICE,
} from "@/data/rates-2026";
import { capitalGainsSimple } from "@/lib/calc/tax";
import { korMoney, num, won } from "@/lib/money";

type Input = {
  salePrice: number;
  buyPrice: number;
  expenses: number;
  holdYears: number;
  liveYears: number;
  isOneHouse: boolean;
  adjustedArea: boolean;
};

const RATES = [
  ONE_HOUSE_EXEMPT_PRICE,
  LTHD_TABLE,
  CAPITAL_GAINS_BASIC_DEDUCTION,
  INCOME_TAX_BRACKETS,
  LOCAL_INCOME_TAX_RATE,
];

export default function CapitalGainsSimple() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      salePrice: 1_400_000_000,
      buyPrice: 900_000_000,
      expenses: 20_000_000,
      holdYears: 6,
      liveYears: 6,
      isOneHouse: true,
      adjustedArea: false,
    },
    { holdYears: 10, liveYears: 10 },
  );

  const ra = useMemo(() => capitalGainsSimple(a), [a]);
  const rb = useMemo(() => capitalGainsSimple(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "보유/거주 기간", a: `${num(a.holdYears)}년 / ${num(a.liveYears)}년`, b: `${num(b.holdYears)}년 / ${num(b.liveYears)}년` },
    { label: "과세대상 양도차익", a: won(ra.taxableGain), b: won(rb.taxableGain) },
    { label: "장기보유특별공제", a: won(ra.longTermDeduction), b: won(rb.longTermDeduction) },
    {
      label: "예상 세액(지방세 포함)",
      a: won(ra.total),
      b: won(rb.total),
      better: ra.total <= rb.total ? "a" : "b",
    },
  ];

  return (
    <CalcFrame
      ab={ab}
      labelA="보유 6년"
      labelB="보유 10년"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          <strong>이 계산기는 &lsquo;1세대 1주택 비과세 요건을 충족하는지&rsquo; 확인하는 체크리스트가
          중심</strong>입니다. 다주택 중과, 단기보유 중과세율(1년 미만 70% 등), 조합원입주권·분양권,
          상속·증여받은 주택, 일시적 2주택 특례, 감면주택은 반영하지 않았습니다. 이런 경우는 세액
          차이가 수천만원 단위로 벌어지므로 반드시 세무사와 상담하세요. {TAX_DISCLAIMER}
        </>
      }
      inputs={
        <>
          <Fieldset legend="양도 정보">
            <Row>
              <NumberField
                label="양도가액(판 금액)"
                value={cur.salePrice}
                onChange={set("salePrice")}
                suffix="원"
                step={10_000_000}
                money
              />
              <NumberField
                label="취득가액(산 금액)"
                value={cur.buyPrice}
                onChange={set("buyPrice")}
                suffix="원"
                step={10_000_000}
                money
              />
            </Row>
            <NumberField
              label="필요경비"
              value={cur.expenses}
              onChange={set("expenses")}
              suffix="원"
              step={1_000_000}
              money
              hint="취득세, 법무사·중개수수료, 자본적 지출(발코니 확장·새시 교체 등). 도배·장판 같은 수익적 지출은 제외됩니다."
            />
          </Fieldset>
          <Fieldset legend="보유·거주 요건">
            <Row>
              <NumberField label="보유기간" value={cur.holdYears} onChange={set("holdYears")} suffix="년" step={1} max={30} />
              <NumberField label="거주기간" value={cur.liveYears} onChange={set("liveYears")} suffix="년" step={1} max={30} />
            </Row>
            <ToggleField
              label="1세대 1주택"
              checked={cur.isOneHouse}
              onChange={set("isOneHouse")}
              hint="세대 전원이 국내에 이 주택 하나만 보유한 경우입니다. 분양권·입주권도 주택 수에 포함될 수 있습니다."
            />
            <ToggleField
              label="조정대상지역 주택"
              checked={cur.adjustedArea}
              onChange={set("adjustedArea")}
              hint="2017.8.3. 이후 조정대상지역에서 취득했다면 2년 이상 실거주해야 비과세됩니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={r.exempt ? "판정" : "예상 양도소득세(지방소득세 포함)"}
          headline={r.exempt ? "비과세 요건 충족" : won(r.total)}
          sub={
            r.exempt
              ? `양도차익 ${korMoney(r.gain)} 전액이 비과세 대상으로 보입니다.`
              : `양도차익 ${won(r.gain)} 중 과세대상 ${won(r.taxableGain)}`
          }
          lines={
            r.exempt
              ? [
                  { label: "양도차익", value: won(r.gain) },
                  { label: "예상 세액", value: "0원", tone: "plus" },
                ]
              : [
                  { label: "양도차익", value: won(r.gain) },
                  { label: "과세대상 양도차익", value: won(r.taxableGain) },
                  { label: "장기보유특별공제", value: `-${won(r.longTermDeduction)}`, tone: "plus" },
                  { label: "양도소득 기본공제", value: `-${won(CAPITAL_GAINS_BASIC_DEDUCTION.value)}`, tone: "plus" },
                  { label: "과세표준", value: won(r.taxBase) },
                  { label: "양도소득세", value: won(r.incomeTax), tone: "minus" },
                  { label: "지방소득세", value: won(r.localTax), tone: "minus" },
                ]
          }
        >
          <div className="mt-4 rounded-xl bg-white/70 p-3">
            <p className="text-sm font-semibold text-slate-800">1세대 1주택 비과세 체크리스트</p>
            <ul className="mt-2 space-y-2">
              {r.checks.map((c) => (
                <li key={c.label} className="flex gap-2 text-[13px] leading-relaxed">
                  <span aria-hidden="true" className="shrink-0">
                    {c.ok ? "✅" : "❌"}
                  </span>
                  <span>
                    <span className={c.ok ? "font-medium text-slate-800" : "font-medium text-rose-700"}>
                      {c.label}
                    </span>
                    <span className="sr-only">{c.ok ? " 충족" : " 미충족"}</span>
                    <span className="block text-slate-500">{c.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ResultCard>
      }
    />
  );
}
