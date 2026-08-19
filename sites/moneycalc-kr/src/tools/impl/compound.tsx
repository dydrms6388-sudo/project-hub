"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, RadioGroup, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { INTEREST_TAX_RATE } from "@/data/rates-2026";
import { compoundGrowth } from "@/lib/calc/finance";
import { korMoney, num, pct, won } from "@/lib/money";

type Freq = "yearly" | "monthly";
type Input = {
  initial: number;
  monthly: number;
  ratePct: number;
  years: number;
  freq: Freq;
};

const RATES = [INTEREST_TAX_RATE];

const calc = (i: Input) =>
  compoundGrowth(i.initial, i.monthly, i.ratePct / 100, i.years, i.freq === "monthly" ? 12 : 1);

export default function Compound() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { initial: 10_000_000, monthly: 500_000, ratePct: 6, years: 20, freq: "monthly" },
    { ratePct: 3 },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "연 수익률", a: `${num(a.ratePct, 2)}%`, b: `${num(b.ratePct, 2)}%` },
    { label: "총 납입 원금", a: won(ra.totalPrincipal), b: won(rb.totalPrincipal) },
    { label: "누적 수익", a: won(ra.totalInterest), b: won(rb.totalInterest) },
    {
      label: "최종 평가액",
      a: won(ra.finalBalance),
      b: won(rb.finalBalance),
      better: ra.finalBalance >= rb.finalBalance ? "a" : "b",
    },
  ];

  const max = Math.max(...r.series.map((p) => p.balance), 1);

  return (
    <CalcFrame
      ab={ab}
      labelA="A 시나리오"
      labelB="B 시나리오"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          입력한 수익률이 <strong>매년 똑같이 난다고 가정한 단순 모델</strong>입니다. 실제 투자
          수익률은 변동하고 원금 손실이 날 수 있으며, 물가상승률·세금·수수료도 반영되어 있지
          않습니다. 특정 상품의 수익을 보장하거나 권유하는 것이 아닙니다.
        </>
      }
      inputs={
        <>
          <Fieldset legend="투자 조건">
            <Row>
              <NumberField
                label="초기 투자금"
                value={cur.initial}
                onChange={set("initial")}
                suffix="원"
                step={1_000_000}
                money
              />
              <NumberField
                label="매월 추가 납입"
                value={cur.monthly}
                onChange={set("monthly")}
                suffix="원"
                step={100_000}
                money
              />
            </Row>
            <Row>
              <NumberField label="연 수익률" value={cur.ratePct} onChange={set("ratePct")} suffix="%" step={0.5} />
              <NumberField
                label="기간"
                value={cur.years}
                onChange={set("years")}
                suffix="년"
                step={1}
                min={1}
                max={60}
              />
            </Row>
            <RadioGroup<Freq>
              label="복리 계산 주기"
              value={cur.freq}
              onChange={set("freq")}
              options={[
                { value: "monthly", label: "월복리(연이율÷12)" },
                { value: "yearly", label: "연복리" },
              ]}
              hint="월복리는 연이율을 12로 나눈 명목 이율을 매달 적용합니다. 연복리는 같은 연 수익률을 월 단위로 환산해 적용합니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={`${num(cur.years)}년 뒤 예상 평가액`}
          headline={won(r.finalBalance)}
          sub={korMoney(r.finalBalance)}
          lines={[
            { label: "총 납입 원금", value: won(r.totalPrincipal) },
            { label: "누적 수익", value: won(r.totalInterest), tone: "plus" },
            {
              label: "원금 대비",
              value: r.totalPrincipal > 0 ? `${num(r.finalBalance / r.totalPrincipal, 2)}배` : "-",
            },
            {
              label: "수익 비중",
              value: r.finalBalance > 0 ? pct(r.totalInterest / r.finalBalance, 1) : "-",
            },
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📈 연도별 자산 추이
          </summary>
          <div className="border-t border-slate-200 p-3 sm:p-4">
            <ul className="space-y-1.5" aria-label="연도별 자산 추이 그래프">
              {r.series
                .filter((_, idx, arr) => arr.length <= 21 || idx % Math.ceil(arr.length / 21) === 0 || idx === arr.length - 1)
                .map((p) => (
                  <li key={p.year} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">
                      {num(p.year)}년
                    </span>
                    <span className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
                      <span
                        className="absolute inset-y-0 left-0 bg-slate-300"
                        style={{ width: `${(p.principal / max) * 100}%` }}
                      />
                      <span
                        className="absolute inset-y-0 left-0 border-r-2 border-teal-600 bg-teal-500/50"
                        style={{ width: `${(p.balance / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-700 sm:w-28">
                      {korMoney(p.balance)}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-slate-300 align-middle" /> 납입 원금
              <span className="ml-3 mr-1 inline-block h-2 w-3 rounded-sm bg-teal-500/50 align-middle" /> 평가액
            </p>
          </div>
        </details>
      }
    />
  );
}
