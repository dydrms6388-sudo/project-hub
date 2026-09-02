"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import {
  CAR_AGE_DISCOUNT,
  CAR_ANNUAL_PREPAY_DISCOUNT,
  CAR_EDU_TAX_RATE,
  CAR_EV_FLAT_TAX,
  CAR_TAX_RATES,
} from "@/data/rates-2026";
import { carTax } from "@/lib/calc/tax";
import { num, pct, won } from "@/lib/money";

type Input = { cc: number; ageYears: number; isEv: boolean };

const RATES = [CAR_TAX_RATES, CAR_EDU_TAX_RATE, CAR_AGE_DISCOUNT, CAR_EV_FLAT_TAX, CAR_ANNUAL_PREPAY_DISCOUNT];

export default function CarTax() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { cc: 1998, ageYears: 0, isEv: false },
    { cc: 1598 },
  );

  const ra = useMemo(() => carTax(a.cc, a.ageYears, a.isEv), [a]);
  const rb = useMemo(() => carTax(b.cc, b.ageYears, b.isEv), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const compareRows: CompareRow[] = [
    { label: "배기량", a: a.isEv ? "전기·수소차" : `${num(a.cc)}cc`, b: b.isEv ? "전기·수소차" : `${num(b.cc)}cc` },
    { label: "차령", a: `${num(a.ageYears)}년`, b: `${num(b.ageYears)}년` },
    { label: "자동차세", a: won(ra.reducedTax), b: won(rb.reducedTax) },
    { label: "지방교육세", a: won(ra.eduTax), b: won(rb.eduTax) },
    { label: "연간 합계", a: won(ra.total), b: won(rb.total), better: ra.total <= rb.total ? "a" : "b" },
  ];

  const yearly = Array.from({ length: 13 }, (_, i) => ({
    age: i,
    tax: carTax(cur.cc, i, cur.isEv).total,
  }));

  return (
    <CalcFrame
      ab={ab}
      labelA="2000cc급"
      labelB="1600cc급"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          비영업용 승용자동차 기준입니다. 승합·화물·특수차, 영업용 차량은 세율 체계가 다릅니다.
          장애인·국가유공자 감면, 다자녀 감면, 지자체 조례 감면은 반영되어 있지 않으니 실제
          고지서와 다를 수 있습니다. 정확한 세액은 위택스(wetax) 또는 관할 지자체에서 확인하세요.
        </>
      }
      inputs={
        <>
          <Fieldset legend="차량 정보">
            <Row>
              <NumberField
                label="배기량"
                value={cur.cc}
                onChange={set("cc")}
                suffix="cc"
                step={100}
                hint="자동차등록증에 적힌 배기량을 그대로 넣으세요. 1,000cc 이하 80원 / 1,600cc 이하 140원 / 초과 200원."
                quick={[
                  { label: "998cc", delta: 998 - cur.cc },
                  { label: "1598cc", delta: 1598 - cur.cc },
                  { label: "1998cc", delta: 1998 - cur.cc },
                  { label: "2497cc", delta: 2497 - cur.cc },
                ]}
              />
              <NumberField
                label="차령(연식)"
                value={cur.ageYears}
                onChange={set("ageYears")}
                suffix="년"
                step={1}
                max={30}
                hint="최초 등록일로부터 지난 햇수. 3년째부터 매년 5%씩, 최대 50%까지 경감됩니다."
              />
            </Row>
            <ToggleField
              label="전기·수소차 (배기량 없음)"
              checked={cur.isEv}
              onChange={set("isEv")}
              hint="배기량이 없는 비영업용 승용차는 정액 10만원이 적용됩니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="연간 자동차세(지방교육세 포함)"
          headline={won(r.total)}
          sub={`6월·12월에 각 ${won(Math.round(r.total / 2))}씩 나눠 냅니다`}
          lines={[
            { label: "경감 전 자동차세", value: won(r.baseTax) },
            {
              label: "차령 경감",
              value: r.discountRate > 0 ? `-${pct(r.discountRate, 0)}` : "없음",
              tone: r.discountRate > 0 ? "plus" : undefined,
            },
            { label: "자동차세", value: won(r.reducedTax) },
            { label: "지방교육세 30%", value: won(r.eduTax) },
            { label: "연간 합계", value: won(r.total) },
            { label: "반기당 납부액", value: won(Math.round(r.total / 2)) },
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📉 차령별 자동차세 변화 ({cur.isEv ? "전기·수소차" : `${num(cur.cc)}cc`})
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">차령</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">연간 납부액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yearly.map((y) => (
                  <tr key={y.age} className={y.age === cur.ageYears ? "bg-teal-50 font-semibold" : undefined}>
                    <th scope="row" className="px-3 py-1.5 text-left font-normal text-slate-600">
                      {y.age === 0 ? "신차" : `${y.age}년`}
                    </th>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{won(y.tax)}</td>
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
