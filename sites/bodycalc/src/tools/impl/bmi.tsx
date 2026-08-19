"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote, Warnings } from "@/components/calc/Notice";
import Tracker from "@/components/calc/Tracker";
import { BigStat, Field, Grid, NumberInput, ResultCard, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

export default function BmiCalc() {
  const [h, setH] = useState("170");
  const [w, setW] = useState("65");

  const heightCm = H.toNum(h);
  const weightKg = H.toNum(w);
  const ok = heightCm > 50 && heightCm < 260 && weightKg > 10 && weightKg < 400;

  const value = useMemo(() => (ok ? H.bmi(weightKg, heightCm) : NaN), [ok, weightKg, heightCm]);
  const who = ok ? H.bandOf(H.BMI_WHO, value) : null;
  const asia = ok ? H.bandOf(H.BMI_ASIA, value) : null;
  const [nLo, nHi] = H.weightRangeForBmi(heightCm, 18.5, 22.9);
  const warns = ok ? H.bmiWarnings(value) : [];

  const m = heightCm / 100;

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Grid>
        <Field label="키" htmlFor="bmi-h">
          <NumberInput id="bmi-h" value={h} onChange={setH} min={50} max={260} step={0.1} suffix="cm" ariaLabel="키(cm)" />
        </Field>
        <Field label="체중" htmlFor="bmi-w">
          <NumberInput id="bmi-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="체중(kg)" />
        </Field>
      </Grid>

      {ok ? (
        <>
          <ResultCard>
            <BigStat
              caption="체질량지수 (BMI)"
              value={H.fmt(value, 1)}
              unit="kg/m²"
              sub={`아시아·태평양 기준 ${asia?.label} · WHO 국제 기준 ${who?.label}`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "아시아·태평양 기준", value: asia?.label ?? "—", sub: "대한비만학회 채택" },
                  { label: "WHO 국제 기준", value: who?.label ?? "—", sub: "전 세계 공통 분류" },
                  {
                    label: "BMI 18.5~22.9 구간 체중",
                    value: `${H.fmt(nLo, 1)}~${H.fmt(nHi, 1)}kg`,
                    sub: "키에서 역산한 참고 범위",
                  },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />
          <NoCoachingNote />

          <Scale value={value} />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">두 기준의 구간 표</h3>
            <p className="mb-2 text-xs leading-relaxed text-slate-500">
              같은 BMI라도 어떤 기준표를 쓰느냐에 따라 분류가 달라집니다. 한국·일본·중국 등에서는
              같은 BMI에서도 대사질환 위험이 더 일찍 올라간다는 관찰에 따라 낮은 절단점을 씁니다.
            </p>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>구간</Th>
                    <Th right>아시아·태평양</Th>
                    <Th right>WHO 국제</Th>
                  </tr>
                </thead>
                <tbody>
                  <BandRows />
                </tbody>
              </table>
            </TableWrap>
          </section>

          <FormulaBox
            formula={[
              "BMI = 체중(kg) ÷ 키(m)²",
              "정상 체중 범위(kg) = BMI 하한 × 키(m)²  ~  BMI 상한 × 키(m)²",
            ]}
            steps={[
              { label: "키를 m로", expr: `${H.fmt(heightCm, 1)}cm ÷ 100`, value: `${H.fmt(m, 3)} m` },
              { label: "키의 제곱", expr: `${H.fmt(m, 3)} × ${H.fmt(m, 3)}`, value: `${H.fmt(m * m, 4)} m²` },
              {
                label: "BMI",
                expr: `${H.fmt(weightKg, 1)} ÷ ${H.fmt(m * m, 4)}`,
                value: `${H.fmt(value, 2)} kg/m²`,
              },
              {
                label: "BMI 18.5~22.9 에 해당하는 체중",
                expr: `18.5 × ${H.fmt(m * m, 4)}  ~  22.9 × ${H.fmt(m * m, 4)}`,
                value: `${H.fmt(nLo, 1)} ~ ${H.fmt(nHi, 1)} kg`,
              },
            ]}
            note="BMI는 1830년대 벨기에 통계학자 케틀레(Quetelet)가 만든 지수로, 원래 개인 진단이 아니라 인구 집단의 체격 분포를 기술하기 위한 도구였습니다."
            limits={[
              "근육량과 체지방을 구분하지 못합니다. 근육이 많은 사람은 체지방이 적어도 BMI가 높게 나옵니다.",
              "지방이 어디에 붙어 있는지(내장지방/피하지방)를 반영하지 못해 허리둘레와 함께 보는 것이 권장됩니다.",
              "성장기 어린이·청소년은 성인 기준표가 아니라 연령별 성장도표 백분위수를 써야 합니다.",
              "임신 중이거나 부종·복수가 있는 경우, 절단된 사지가 있는 경우에는 해석이 달라집니다.",
            ]}
            sources={[
              { label: "WHO — Body mass index 분류 (Global Health Observatory)", url: "https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index" },
              { label: "WHO Expert Consultation, Appropriate body-mass index for Asian populations (Lancet 2004) — doi:10.1016/S0140-6736(03)15268-3", url: "https://doi.org/10.1016/S0140-6736(03)15268-3" },
              { label: "대한비만학회 — 비만 진료지침", url: "https://general.kosso.or.kr/" },
            ]}
          />

          <Tracker kind="weight" />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          키(50~260cm)와 체중(10~400kg)을 입력하면 계산됩니다.
        </p>
      )}
    </div>
  );
}

function BandRows() {
  const rows: { label: string; asia: string; who: string }[] = [
    { label: "저체중", asia: "18.5 미만", who: "18.5 미만" },
    { label: "정상", asia: "18.5 ~ 22.9", who: "18.5 ~ 24.9" },
    { label: "과체중 / 비만 전 단계", asia: "23.0 ~ 24.9", who: "25.0 ~ 29.9" },
    { label: "1단계 비만", asia: "25.0 ~ 29.9", who: "30.0 ~ 34.9" },
    { label: "2단계 비만", asia: "30.0 ~ 34.9", who: "35.0 ~ 39.9" },
    { label: "3단계 비만", asia: "35.0 이상", who: "40.0 이상" },
  ];
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label}>
          <Td>{r.label}</Td>
          <Td right>{r.asia}</Td>
          <Td right>{r.who}</Td>
        </tr>
      ))}
    </>
  );
}

/** BMI 위치 막대 — 아시아·태평양 기준 */
function Scale({ value }: { value: number }) {
  const lo = 15;
  const hi = 35;
  const pct = Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
  const stops = [
    { at: 18.5, label: "18.5" },
    { at: 23, label: "23" },
    { at: 25, label: "25" },
    { at: 30, label: "30" },
  ];
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">아시아·태평양 기준에서 내 위치</p>
      <div className="relative h-7 w-full overflow-hidden rounded-lg">
        <div className="absolute inset-0 flex">
          <div className="bg-sky-300" style={{ width: `${((18.5 - lo) / (hi - lo)) * 100}%` }} />
          <div className="bg-emerald-400" style={{ width: `${((23 - 18.5) / (hi - lo)) * 100}%` }} />
          <div className="bg-amber-300" style={{ width: `${((25 - 23) / (hi - lo)) * 100}%` }} />
          <div className="bg-orange-400" style={{ width: `${((30 - 25) / (hi - lo)) * 100}%` }} />
          <div className="flex-1 bg-rose-400" />
        </div>
        <div
          className="absolute top-0 h-7 w-1 -translate-x-1/2 bg-slate-900"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="relative mt-1 h-4">
        {stops.map((s) => (
          <span
            key={s.at}
            className="absolute -translate-x-1/2 text-[10px] text-slate-500"
            style={{ left: `${((s.at - lo) / (hi - lo)) * 100}%` }}
          >
            {s.label}
          </span>
        ))}
      </div>
      <p className="sr-only">현재 BMI {H.fmt(value, 1)}</p>
    </div>
  );
}

