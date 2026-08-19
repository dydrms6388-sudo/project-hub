"use client";

import { useMemo } from "react";
import {
  CalcFrame,
  ResultCard,
  TAX_DISCLAIMER,
  type CompareRow,
} from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row, SelectField, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  GIFT_DEDUCTIONS,
  GIFT_FILING_CREDIT,
  GIFT_GENERATION_SKIP_SURCHARGE,
  GIFT_MARRIAGE_DEDUCTION,
  GIFT_TAX_BRACKETS,
} from "@/data/rates-2026";
import { giftTax, GIFT_RELATION_LABEL, type GiftRelation } from "@/lib/calc/tax";
import { korMoney, pct, won } from "@/lib/money";

type Input = {
  amount: number;
  relation: GiftRelation;
  priorGifts: number;
  useMarriageDeduction: boolean;
  generationSkip: boolean;
  fileOnTime: boolean;
};

const RATES = [
  GIFT_TAX_BRACKETS,
  GIFT_DEDUCTIONS,
  GIFT_MARRIAGE_DEDUCTION,
  GIFT_FILING_CREDIT,
  GIFT_GENERATION_SKIP_SURCHARGE,
];

export default function GiftTax() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      amount: 300_000_000,
      relation: "linealAscendantToAdult",
      priorGifts: 0,
      useMarriageDeduction: false,
      generationSkip: false,
      fileOnTime: true,
    },
    { useMarriageDeduction: true },
  );

  const ra = useMemo(() => giftTax(a), [a]);
  const rb = useMemo(() => giftTax(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "증여재산가액", a: won(a.amount), b: won(b.amount) },
    { label: "적용 공제액", a: won(ra.usedDeduction), b: won(rb.usedDeduction) },
    { label: "과세표준", a: won(ra.taxBase), b: won(rb.taxBase) },
    {
      label: "납부할 증여세",
      a: won(ra.finalTax),
      b: won(rb.finalTax),
      better: ra.finalTax <= rb.finalTax ? "a" : "b",
    },
    { label: "실효세율", a: pct(ra.effectiveRate, 2), b: pct(rb.effectiveRate, 2) },
  ];

  const marriageAvailable =
    cur.relation === "linealAscendantToAdult" || cur.relation === "linealAscendantToMinor";

  return (
    <CalcFrame
      ab={ab}
      labelA="혼인공제 없음"
      labelB="혼인공제 사용"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          부동산·비상장주식은 시가 평가 방법(보충적 평가)에 따라 과세가액이 달라지고, 부담부증여
          (채무 인수)나 저가양수는 별도 규정이 적용됩니다. 증여세 신고는 증여일이 속하는 달의
          말일부터 3개월 이내입니다. {TAX_DISCLAIMER}
        </>
      }
      inputs={
        <>
          <Fieldset legend="증여 내용">
            <Row>
              <NumberField
                label="증여재산가액"
                value={cur.amount}
                onChange={set("amount")}
                suffix="원"
                step={10_000_000}
                money
                quick={[
                  { label: "+1,000만", delta: 10_000_000 },
                  { label: "+1억", delta: 100_000_000 },
                  { label: "-1,000만", delta: -10_000_000 },
                ]}
              />
              <SelectField<GiftRelation>
                label="증여자와의 관계"
                value={cur.relation}
                onChange={set("relation")}
                options={(Object.keys(GIFT_RELATION_LABEL) as GiftRelation[]).map((k) => ({
                  value: k,
                  label: `${GIFT_RELATION_LABEL[k]} (공제 ${korMoney(GIFT_DEDUCTIONS.value[k])})`,
                }))}
              />
            </Row>
            <NumberField
              label="최근 10년간 같은 그룹에서 받은 증여액"
              value={cur.priorGifts}
              onChange={set("priorGifts")}
              suffix="원"
              step={10_000_000}
              money
              hint="아버지·어머니·조부모는 모두 '직계존속' 한 그룹으로 묶어 10년간 합산합니다."
            />
          </Fieldset>
          <Fieldset legend="추가 조건">
            {marriageAvailable ? (
              <ToggleField
                label="혼인·출산 증여재산공제 적용 (최대 1억원)"
                checked={cur.useMarriageDeduction}
                onChange={set("useMarriageDeduction")}
                hint="혼인신고일 전후 2년 이내, 또는 자녀 출생·입양신고 후 2년 이내 직계존속에게 받은 증여에 적용됩니다. 혼인과 출산을 합쳐 평생 1억원 한도입니다."
              />
            ) : null}
            <ToggleField
              label="세대생략 증여 (조부모 → 손자녀)"
              checked={cur.generationSkip}
              onChange={set("generationSkip")}
              hint="부모를 건너뛰고 손자녀에게 직접 증여하면 산출세액의 30%가 할증됩니다."
            />
            <ToggleField
              label="신고기한 내 신고 (신고세액공제 3%)"
              checked={cur.fileOnTime}
              onChange={set("fileOnTime")}
              hint="증여일이 속하는 달의 말일부터 3개월 이내에 신고하면 3%를 공제받습니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="납부할 증여세(추정)"
          headline={won(r.finalTax)}
          sub={`실효세율 ${pct(r.effectiveRate, 2)} · 증여액 ${korMoney(cur.amount)}`}
          lines={[
            { label: "증여재산가액", value: won(cur.amount) },
            { label: "적용 공제액", value: `-${won(r.usedDeduction)}`, tone: "plus" },
            { label: "과세표준", value: won(r.taxBase) },
            { label: "산출세액", value: won(r.calculatedTax), tone: "minus" },
            ...(r.surcharge > 0
              ? [{ label: "세대생략 할증 30%", value: `+${won(r.surcharge)}`, tone: "minus" as const }]
              : []),
            { label: "신고세액공제", value: `-${won(r.filingCredit)}`, tone: "plus" },
            { label: "실수령액(증여액 − 세금)", value: won(cur.amount - r.finalTax) },
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📗 증여세 세율표와 공제 한도
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">과세표준</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">세율</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">누진공제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {GIFT_TAX_BRACKETS.value.map((br) => (
                  <tr key={String(br.upTo)}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">
                      {br.upTo === null ? "30억원 초과" : `${korMoney(br.upTo)} 이하`}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(br.rate, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{won(br.deduction ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full min-w-[320px] border-t border-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">관계</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">10년 공제 한도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.keys(GIFT_RELATION_LABEL) as GiftRelation[]).map((k) => (
                  <tr key={k}>
                    <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">
                      {GIFT_RELATION_LABEL[k]}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{won(GIFT_DEDUCTIONS.value[k])}</td>
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
