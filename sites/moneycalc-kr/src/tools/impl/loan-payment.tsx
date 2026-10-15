"use client";

import { useMemo, useState } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, RadioGroup, Row } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { BOK_BASE_RATE } from "@/data/rates-2026";
import { loanSchedule, type RepaymentType } from "@/lib/calc/finance";
import { num, pct, won } from "@/lib/money";

type Input = {
  principal: number;
  annualRatePct: number;
  years: number;
  graceMonths: number;
  type: RepaymentType;
  prepayMonth: number;
  prepayAmount: number;
  prepayFeePct: number;
};

const RATES = [BOK_BASE_RATE];

const calc = (i: Input) =>
  loanSchedule({
    principal: i.principal,
    annualRate: i.annualRatePct / 100,
    months: Math.round(i.years * 12),
    graceMonths: i.graceMonths,
    type: i.type,
    prepayMonth: i.prepayAmount > 0 ? i.prepayMonth : undefined,
    prepayAmount: i.prepayAmount,
    prepayFeeRate: i.prepayFeePct / 100,
  });

export default function LoanPayment() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    {
      principal: 300_000_000,
      annualRatePct: 4.2,
      years: 30,
      graceMonths: 0,
      type: "equalPayment",
      prepayMonth: 24,
      prepayAmount: 0,
      prepayFeePct: 1.2,
    },
    { type: "equalPrincipal" },
  );
  const [showAll, setShowAll] = useState(false);

  const ra = useMemo(() => calc(a), [a]);
  const rb = useMemo(() => calc(b), [b]);
  const r = ab.tab === "a" ? ra : rb;

  const noPrepay = useMemo(() => calc({ ...cur, prepayAmount: 0 }), [cur]);
  const saved = cur.prepayAmount > 0 ? noPrepay.totalInterest - r.totalInterest : 0;

  const compareRows: CompareRow[] = [
    { label: "대출금액", a: won(a.principal), b: won(b.principal) },
    { label: "상환방식", a: TYPE_LABEL[a.type], b: TYPE_LABEL[b.type] },
    { label: "첫 회 상환액", a: won(ra.firstPayment), b: won(rb.firstPayment) },
    { label: "마지막 회 상환액", a: won(ra.lastPayment), b: won(rb.lastPayment) },
    {
      label: "총 이자",
      a: won(ra.totalInterest),
      b: won(rb.totalInterest),
      better: ra.totalInterest <= rb.totalInterest ? "a" : "b",
    },
    { label: "총 상환액", a: won(a.principal + ra.totalInterest), b: won(b.principal + rb.totalInterest) },
  ];

  const rows = showAll ? r.rows : r.rows.slice(0, 12);

  return (
    <CalcFrame
      ab={ab}
      labelA="원리금균등"
      labelB="원금균등"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          실제 대출은 변동금리·가산금리·우대금리, 중도상환수수료 면제 구간(보통 3년 경과 후 면제),
          체증식 상환 등 조건이 붙습니다. 은행 상환 스케줄과 원 단위 차이가 날 수 있는{" "}
          <strong>참고용 시뮬레이션</strong>입니다.
        </>
      }
      inputs={
        <>
          <Fieldset legend="대출 조건">
            <Row>
              <NumberField
                label="대출 원금"
                value={cur.principal}
                onChange={set("principal")}
                suffix="원"
                step={10_000_000}
                money
                quick={[
                  { label: "+1,000만", delta: 10_000_000 },
                  { label: "+1억", delta: 100_000_000 },
                  { label: "-1,000만", delta: -10_000_000 },
                ]}
              />
              <NumberField
                label="연 이자율"
                value={cur.annualRatePct}
                onChange={set("annualRatePct")}
                suffix="%"
                step={0.1}
                hint={`참고: 한국은행 기준금리 ${pct(BOK_BASE_RATE.value, 2)} (확인 필요)`}
              />
            </Row>
            <Row>
              <NumberField label="대출 기간" value={cur.years} onChange={set("years")} suffix="년" step={1} min={1} />
              <NumberField
                label="거치기간"
                value={cur.graceMonths}
                onChange={set("graceMonths")}
                suffix="개월"
                step={1}
                hint="이 기간에는 이자만 냅니다. 원금 상환이 미뤄져 총 이자가 늘어납니다."
              />
            </Row>
            <RadioGroup<RepaymentType>
              label="상환 방식"
              value={cur.type}
              onChange={set("type")}
              options={[
                { value: "equalPayment", label: "원리금균등" },
                { value: "equalPrincipal", label: "원금균등" },
                { value: "bullet", label: "만기일시" },
              ]}
              hint="원리금균등은 매달 같은 금액, 원금균등은 매달 줄어드는 금액, 만기일시는 이자만 내다 만기에 원금을 갚습니다."
            />
          </Fieldset>
          <Fieldset legend="중도상환 시뮬레이션 (선택)">
            <Row>
              <NumberField
                label="중도상환 금액"
                value={cur.prepayAmount}
                onChange={set("prepayAmount")}
                suffix="원"
                step={1_000_000}
                money
                hint="0이면 중도상환 없이 계산합니다."
              />
              <NumberField
                label="중도상환 시점"
                value={cur.prepayMonth}
                onChange={set("prepayMonth")}
                suffix="개월차"
                step={1}
                min={1}
              />
            </Row>
            <NumberField
              label="중도상환수수료율"
              value={cur.prepayFeePct}
              onChange={set("prepayFeePct")}
              suffix="%"
              step={0.1}
              hint="주택담보대출은 보통 1.2~1.4%에서 3년에 걸쳐 체감하고, 3년이 지나면 면제됩니다."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel={cur.type === "equalPayment" ? "매월 상환액" : "첫 회 상환액"}
          headline={won(r.firstPayment)}
          sub={`${TYPE_LABEL[cur.type]} · ${num(cur.years)}년(${num(Math.round(cur.years * 12))}회)${
            cur.graceMonths > 0 ? ` · 거치 ${num(cur.graceMonths)}개월` : ""
          }`}
          lines={[
            { label: "대출 원금", value: won(cur.principal) },
            { label: "총 이자", value: won(r.totalInterest), tone: "minus" },
            { label: "총 상환액", value: won(cur.principal + r.totalInterest) },
            { label: "마지막 회 상환액", value: won(r.lastPayment) },
            ...(cur.prepayAmount > 0
              ? [
                  { label: "중도상환수수료", value: won(r.prepayFee), tone: "minus" as const },
                  {
                    label: "중도상환으로 아낀 이자",
                    value: won(saved),
                    tone: "plus" as const,
                    hint: `수수료 차감 시 ${won(saved - r.prepayFee)}`,
                  },
                  { label: "상환 완료 시점", value: `${num(r.paidOffMonth)}개월차` },
                ]
              : []),
          ]}
        />
      }
      extra={
        <details className="rounded-xl border border-slate-200" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📊 상환 스케줄 표
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[420px] text-xs sm:text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left font-semibold text-slate-700 sm:px-3">회차</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold text-slate-700 sm:px-3">상환액</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold text-slate-700 sm:px-3">이자</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold text-slate-700 sm:px-3">원금</th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold text-slate-700 sm:px-3">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.month} className={row.prepay > 0 ? "bg-amber-50" : undefined}>
                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-600 sm:px-3">
                      {row.month}
                      {row.prepay > 0 ? " ⚡" : ""}
                    </th>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 sm:px-3">{won(row.payment)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-rose-700 sm:px-3">{won(row.interest)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-teal-700 sm:px-3">{won(row.principal)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 sm:px-3">{won(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.rows.length > 12 ? (
            <div className="border-t border-slate-200 px-4 py-2">
              <button
                type="button"
                aria-label={showAll ? "상환 스케줄 접기" : "상환 스케줄 전체 보기"}
                onClick={() => setShowAll((v) => !v)}
                className="text-sm font-medium text-teal-700 hover:underline"
              >
                {showAll ? "처음 12회차만 보기" : `전체 ${r.rows.length}회차 보기`}
              </button>
            </div>
          ) : null}
        </details>
      }
    />
  );
}

const TYPE_LABEL: Record<RepaymentType, string> = {
  equalPayment: "원리금균등",
  equalPrincipal: "원금균등",
  bullet: "만기일시",
};
