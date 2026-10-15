"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, RadioGroup, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { INTEREST_TAX_RATE } from "@/data/rates-2026";
import { requiredMonthlyDeposit, savings, type SavingsMode } from "@/lib/calc/finance";
import { num, pct, won } from "@/lib/money";

type Mode = "forward" | "goal";
type Input = {
  mode: Mode;
  product: SavingsMode;
  amount: number;
  goal: number;
  months: number;
  ratePct: number;
  taxed: boolean;
};

const RATES = [INTEREST_TAX_RATE];

const PRODUCT_LABEL: Record<SavingsMode, string> = {
  installmentSimple: "적금(단리)",
  installmentCompound: "적금(월복리)",
  depositSimple: "예금(단리)",
  depositCompound: "예금(월복리)",
};

const calc = (i: Input) => {
  if (i.mode === "goal") {
    const need = requiredMonthlyDeposit(
      i.goal,
      i.months,
      i.ratePct / 100,
      i.taxed,
      i.product === "installmentCompound",
    );
    const r = savings(
      i.product === "installmentCompound" ? "installmentCompound" : "installmentSimple",
      need,
      i.months,
      i.ratePct / 100,
      i.taxed,
    );
    return { need, ...r };
  }
  return { need: 0, ...savings(i.product, i.amount, i.months, i.ratePct / 100, i.taxed) };
};

export default function SavingsGoal() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      mode: "forward",
      product: "installmentSimple",
      amount: 500_000,
      goal: 30_000_000,
      months: 24,
      ratePct: 3.5,
      taxed: true,
    },
    { ratePct: 4.5 },
  );

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "연 이율", a: `${num(a.ratePct, 2)}%`, b: `${num(b.ratePct, 2)}%` },
    { label: "납입 원금", a: won(ra.principal), b: won(rb.principal) },
    { label: "세전 이자", a: won(ra.grossInterest), b: won(rb.grossInterest) },
    { label: "이자소득세", a: won(ra.tax), b: won(rb.tax) },
    {
      label: "만기 수령액",
      a: won(ra.maturity),
      b: won(rb.maturity),
      better: ra.maturity >= rb.maturity ? "a" : "b",
    },
  ];

  const isInstallment = cur.product.startsWith("installment");

  return (
    <CalcFrame
      ab={ab}
      labelA="A 상품"
      labelB="B 상품"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          은행이 광고하는 &ldquo;연 O%&rdquo;는 대부분 <strong>적금 단리</strong> 기준입니다.
          1,200만원을 12개월에 나눠 넣으면 평균 예치기간이 6.5개월뿐이라, 같은 금리의 예금보다
          이자가 절반 수준입니다. 우대금리 조건(급여이체·카드실적 등)을 충족하지 못하면 실제 이자는
          더 적습니다.
        </>
      }
      inputs={
        <>
          <Fieldset legend="무엇을 계산할까요?">
            <RadioGroup<Mode>
              label="계산 방향"
              value={cur.mode}
              onChange={set("mode")}
              options={[
                { value: "forward", label: "만기 수령액 계산" },
                { value: "goal", label: "목표액 역산" },
              ]}
              hint="목표액 역산은 원하는 만기 수령액을 맞추려면 매달 얼마를 넣어야 하는지 계산합니다."
            />
            <RadioGroup<SavingsMode>
              label="상품 종류"
              value={cur.product}
              onChange={set("product")}
              options={
                cur.mode === "goal"
                  ? [
                      { value: "installmentSimple", label: "적금(단리)" },
                      { value: "installmentCompound", label: "적금(월복리)" },
                    ]
                  : [
                      { value: "installmentSimple", label: "적금(단리)" },
                      { value: "installmentCompound", label: "적금(월복리)" },
                      { value: "depositSimple", label: "예금(단리)" },
                      { value: "depositCompound", label: "예금(월복리)" },
                    ]
              }
            />
          </Fieldset>
          <Fieldset legend="조건">
            <Row>
              {cur.mode === "goal" ? (
                <NumberField
                  label="목표 만기 수령액"
                  value={cur.goal}
                  onChange={set("goal")}
                  suffix="원"
                  step={1_000_000}
                  money
                />
              ) : (
                <NumberField
                  label={isInstallment ? "월 납입액" : "예치 금액"}
                  value={cur.amount}
                  onChange={set("amount")}
                  suffix="원"
                  step={100_000}
                  money
                />
              )}
              <NumberField
                label="기간"
                value={cur.months}
                onChange={set("months")}
                suffix="개월"
                step={1}
                min={1}
                quick={[
                  { label: "12개월", delta: 12 - cur.months },
                  { label: "24개월", delta: 24 - cur.months },
                  { label: "36개월", delta: 36 - cur.months },
                ]}
              />
            </Row>
            <Row>
              <NumberField label="연 이율" value={cur.ratePct} onChange={set("ratePct")} suffix="%" step={0.1} />
              <ToggleField
                label={`이자소득세 ${pct(INTEREST_TAX_RATE.value, 1)} 적용`}
                checked={cur.taxed}
                onChange={set("taxed")}
                hint="비과세종합저축·청년우대형 등 비과세 상품이면 해제하세요."
              />
            </Row>
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={cur.mode === "goal" ? "필요한 월 납입액" : "만기 수령액(세후)"}
          headline={cur.mode === "goal" ? won(r.need) : won(r.maturity)}
          sub={
            cur.mode === "goal"
              ? `${num(cur.months)}개월 뒤 ${won(cur.goal)}을 만들려면`
              : `${PRODUCT_LABEL[cur.product]} · ${num(cur.months)}개월 · 연 ${num(cur.ratePct, 2)}%`
          }
          lines={[
            { label: "납입 원금", value: won(r.principal) },
            { label: "세전 이자", value: won(r.grossInterest), tone: "plus" },
            {
              label: "이자소득세",
              value: `-${won(r.tax)}`,
              tone: "minus",
              hint: cur.taxed ? "15.4%" : "비과세",
            },
            { label: "세후 이자", value: won(r.netInterest), tone: "plus" },
            { label: "만기 수령액", value: won(r.maturity) },
            {
              label: "원금 대비 수익률",
              value: r.principal > 0 ? pct(r.netInterest / r.principal, 2) : "-",
            },
          ]}
        />
      }
    />
  );
}
