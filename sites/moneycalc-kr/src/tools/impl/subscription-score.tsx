"use client";

import { useMemo } from "react";
import { CalcFrame, ResultCard, type CompareRow } from "@/components/calc/CalcFrame";
import { Fieldset, NumberField, Row, ToggleField } from "@/components/calc/fields";
import { useABInputs } from "@/components/calc/useABInputs";
import { SUBSCRIPTION_SCORE_MAX } from "@/data/rates-2026";
import { subscriptionScore } from "@/lib/calc/property";
import { num } from "@/lib/money";

type Input = {
  noHouseYears: number;
  dependents: number;
  accountYears: number;
  isNoHouse: boolean;
};

const RATES = [SUBSCRIPTION_SCORE_MAX];

export default function SubscriptionScore() {
  const { ab, a, b, cur, set } = useABInputs<Input>(
    { noHouseYears: 5, dependents: 2, accountYears: 8, isNoHouse: true },
    { noHouseYears: 10, accountYears: 12 },
  );

  const ra = useMemo(() => subscriptionScore(a), [a]);
  const rb = useMemo(() => subscriptionScore(b), [b]);
  const r = ab.tab === "a" ? ra : rb;
  const max = SUBSCRIPTION_SCORE_MAX.value;

  const compareRows: CompareRow[] = [
    { label: "무주택기간", a: `${ra.noHouseScore}점`, b: `${rb.noHouseScore}점` },
    { label: "부양가족수", a: `${ra.dependentScore}점`, b: `${rb.dependentScore}점` },
    { label: "청약통장 가입기간", a: `${ra.accountScore}점`, b: `${rb.accountScore}점` },
    { label: "총점", a: `${ra.total}점`, b: `${rb.total}점`, better: ra.total >= rb.total ? "a" : "b" },
  ];

  const bars = [
    { label: "무주택기간", score: r.noHouseScore, max: max.noHouse },
    { label: "부양가족수", score: r.dependentScore, max: max.dependents },
    { label: "청약통장 가입기간", score: r.accountScore, max: max.account },
  ];

  return (
    <CalcFrame
      ab={ab}
      labelA="현재"
      labelB="5년 뒤"
      compareRows={compareRows}
      steps={r.steps}
      rates={RATES}
      disclaimer={
        <>
          가점 산정 기준은 세대 구성과 등본 이력에 따라 달라집니다. 특히 <strong>부양가족은 직계
          존속의 경우 3년 이상 동일 세대별 주민등록표에 등재</strong>되어야 하고, 만 30세 이상 미혼
          자녀는 1년 이상 등재 요건이 있습니다. 가점을 잘못 기재하면 부적격 처리되어 일정 기간 청약이
          제한되므로, 청약 전 청약홈에서 반드시 확인하세요.
        </>
      }
      inputs={
        <>
          <Fieldset legend="무주택 여부">
            <ToggleField
              label="현재 무주택 세대구성원"
              checked={cur.isNoHouse}
              onChange={set("isNoHouse")}
              hint="본인과 세대원 모두 무주택이어야 합니다. 주택을 소유했다면 무주택기간 점수는 0점입니다."
            />
          </Fieldset>
          <Fieldset legend="가점 항목">
            <Row>
              <NumberField
                label="무주택 기간"
                value={cur.noHouseYears}
                onChange={set("noHouseYears")}
                suffix="년"
                step={1}
                max={30}
                hint="만 30세부터(그전에 혼인했다면 혼인신고일부터) 계산합니다. 15년 이상이면 만점 32점."
              />
              <NumberField
                label="부양가족 수(본인 제외)"
                value={cur.dependents}
                onChange={set("dependents")}
                suffix="명"
                step={1}
                max={6}
                hint="배우자, 직계존속(3년 이상 동일 등본), 미혼 직계비속. 6명 이상이면 만점 35점."
              />
            </Row>
            <NumberField
              label="청약통장 가입기간"
              value={cur.accountYears}
              onChange={set("accountYears")}
              suffix="년"
              step={1}
              max={30}
              hint="주택청약종합저축 가입일 기준. 15년 이상이면 만점 17점."
            />
          </Fieldset>
        </>
      }
      result={
        <ResultCard
          headlineLabel="청약 가점"
          headline={`${r.total}점 / 84점`}
          sub={`무주택 ${r.noHouseScore} + 부양가족 ${r.dependentScore} + 통장 ${r.accountScore}`}
        >
          <ul className="mt-4 space-y-2.5" aria-label="항목별 가점">
            {bars.map((bar) => (
              <li key={bar.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-slate-700">{bar.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {bar.score} / {bar.max}점
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-teal-600"
                    style={{ width: `${(bar.score / bar.max) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={bar.score}
                    aria-valuemin={0}
                    aria-valuemax={bar.max}
                    aria-label={`${bar.label} ${bar.score}점`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-white/70 p-2.5 text-[13px] leading-relaxed text-slate-600">
            수도권 인기 단지의 당첨 가점은 보통 60점대 후반 이상에서 형성됩니다. 지역·면적·공급
            유형(가점제 비율)에 따라 크게 달라지므로 청약홈의 단지별 당첨 가점 통계를 함께 보세요.
          </p>
        </ResultCard>
      }
      extra={
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
            📗 가점 항목별 배점표
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">항목</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">배점 방식</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">만점</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">무주택기간</th>
                  <td className="px-3 py-2 text-slate-700">1년 미만 2점, 이후 1년마다 2점</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(max.noHouse)}점</td>
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">부양가족수</th>
                  <td className="px-3 py-2 text-slate-700">0명 5점, 1명마다 5점</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(max.dependents)}점</td>
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">청약통장 가입기간</th>
                  <td className="px-3 py-2 text-slate-700">6개월 미만 1점, 1년 미만 2점, 이후 1년마다 1점</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(max.account)}점</td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <th scope="row" className="px-3 py-2 text-left text-slate-700">합계</th>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{num(max.total)}점</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      }
    />
  );
}
