"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, Warnings } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, Segmented, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

type MaxMode = "classic" | "tanaka";

export default function HeartRate() {
  const [age, setAge] = useState("30");
  const [rest, setRest] = useState("65");
  const [maxMode, setMaxMode] = useState<MaxMode>("classic");

  const A = H.toNum(age);
  const R = H.toNum(rest);
  const ok = A > 0 && A < 120 && R >= 30 && R <= 120;

  const hrMax = useMemo(
    () => (maxMode === "classic" ? H.hrMaxClassic(A) : H.hrMaxTanaka(A)),
    [maxMode, A],
  );
  const hrr = hrMax - R;

  const warns: H.Warn[] = [];
  if (ok && R > 100)
    warns.push({
      level: "warn",
      text: "안정 시 심박수가 분당 100회를 넘습니다(빈맥 범위). 카페인·발열·긴장 등 일시적 원인일 수도 있지만, 반복해서 이렇게 나온다면 운동 강도를 정하기 전에 의료진 진료를 받아보세요.",
    });
  if (ok && R < 40)
    warns.push({
      level: "warn",
      text: "안정 시 심박수가 분당 40회 미만입니다. 지구력 훈련이 많은 사람에게 나타나기도 하지만, 어지럼·실신이 동반된다면 의료진 상담이 필요합니다.",
    });
  if (ok && hrr <= 0)
    warns.push({ level: "warn", text: "안정 시 심박수가 최대 심박수보다 높게 입력되었습니다. 값을 확인해 주세요." });

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Grid>
        <Field label="나이" htmlFor="hr-age">
          <NumberInput id="hr-age" value={age} onChange={setAge} min={1} max={120} suffix="세" ariaLabel="나이" />
        </Field>
        <Field
          label="안정 시 심박수"
          htmlFor="hr-rest"
          hint="아침에 눈뜬 직후 누운 채로 1분간 재는 것이 가장 정확합니다."
        >
          <NumberInput id="hr-rest" value={rest} onChange={setRest} min={30} max={120} suffix="bpm" ariaLabel="안정 시 심박수" />
        </Field>
      </Grid>

      <Field label="최대 심박수 추정식" htmlFor="hr-mode">
        <Segmented
          label="최대 심박수 추정식"
          value={maxMode}
          onChange={setMaxMode}
          options={[
            { value: "classic", label: "220 − 나이 (전통식)" },
            { value: "tanaka", label: "208 − 0.7 × 나이 (Tanaka 2001)" },
          ]}
        />
      </Field>

      {ok && hrr > 0 ? (
        <>
          <ResultCard>
            <BigStat
              caption="심박수 여유분 (HRR)"
              value={H.fmt(hrr, 0)}
              unit="bpm"
              sub={`최대 ${H.fmt(hrMax, 0)} − 안정 시 ${H.fmt(R, 0)}`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "추정 최대 심박수", value: `${H.fmt(hrMax, 0)} bpm`, sub: maxMode === "classic" ? "220 − 나이" : "208 − 0.7×나이" },
                  {
                    label: "중강도 (60~70%)",
                    value: `${H.fmt(H.karvonen(hrMax, R, 0.6), 0)}~${H.fmt(H.karvonen(hrMax, R, 0.7), 0)}`,
                    sub: "bpm",
                  },
                  {
                    label: "고강도 (80~90%)",
                    value: `${H.fmt(H.karvonen(hrMax, R, 0.8), 0)}~${H.fmt(H.karvonen(hrMax, R, 0.9), 0)}`,
                    sub: "bpm",
                  },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">강도 구간별 목표 심박수</h3>
            <TableWrap>
              <table className="w-full min-w-[320px] border-collapse">
                <thead>
                  <tr>
                    <Th>구간</Th>
                    <Th right>강도</Th>
                    <Th right>카보넨</Th>
                    <Th right>단순 %HRmax</Th>
                  </tr>
                </thead>
                <tbody>
                  {H.HR_ZONES.map((z) => (
                    <tr key={z.key}>
                      <Td strong>{z.label}</Td>
                      <Td right>
                        {Math.round(z.lo * 100)}~{Math.round(z.hi * 100)}%
                      </Td>
                      <Td right>
                        {H.fmt(H.karvonen(hrMax, R, z.lo), 0)}~{H.fmt(H.karvonen(hrMax, R, z.hi), 0)}
                      </Td>
                      <Td right>
                        {H.fmt(hrMax * z.lo, 0)}~{H.fmt(hrMax * z.hi, 0)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <ul className="mt-3 space-y-1 text-xs leading-relaxed text-slate-500">
              {H.HR_ZONES.map((z) => (
                <li key={z.key}>
                  <b className="text-slate-700">{z.label}</b> — {z.desc}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              카보넨 방식은 안정 시 심박수를 반영하기 때문에, 같은 나이라도 심폐 능력이 좋아 안정 시
              심박수가 낮은 사람은 목표 심박수가 더 낮게 계산됩니다. 단순 %HRmax 방식보다 개인차를
              잘 반영한다고 알려져 있습니다.
            </p>
          </section>

          <FormulaBox
            formula={[
              "최대 심박수(HRmax)",
              "  전통식   : 220 − 나이",
              "  Tanaka식 : 208 − 0.7 × 나이",
              "심박수 여유분(HRR) = HRmax − 안정 시 심박수",
              "카보넨 목표 심박수 = HRR × 강도(%) + 안정 시 심박수",
            ]}
            steps={[
              {
                label: `최대 심박수 (${maxMode === "classic" ? "전통식" : "Tanaka"})`,
                expr: maxMode === "classic" ? `220 − ${H.fmt(A, 0)}` : `208 − 0.7 × ${H.fmt(A, 0)}`,
                value: `${H.fmt(hrMax, 1)} bpm`,
              },
              {
                label: "심박수 여유분",
                expr: `${H.fmt(hrMax, 1)} − ${H.fmt(R, 0)}`,
                value: `${H.fmt(hrr, 1)} bpm`,
              },
              {
                label: "60% 목표",
                expr: `${H.fmt(hrr, 1)} × 0.6 + ${H.fmt(R, 0)}`,
                value: `${H.fmt(H.karvonen(hrMax, R, 0.6), 1)} bpm`,
              },
              {
                label: "70% 목표",
                expr: `${H.fmt(hrr, 1)} × 0.7 + ${H.fmt(R, 0)}`,
                value: `${H.fmt(H.karvonen(hrMax, R, 0.7), 1)} bpm`,
              },
              {
                label: "85% 목표",
                expr: `${H.fmt(hrr, 1)} × 0.85 + ${H.fmt(R, 0)}`,
                value: `${H.fmt(H.karvonen(hrMax, R, 0.85), 1)} bpm`,
              },
              {
                label: "비교: 단순 %HRmax 70%",
                expr: `${H.fmt(hrMax, 1)} × 0.7`,
                value: `${H.fmt(hrMax * 0.7, 1)} bpm`,
              },
            ]}
            note="카보넨 공식은 핀란드 생리학자 마르티 카보넨의 1957년 연구에서 이름을 따왔습니다. 안정 시 심박수를 기준선으로 삼아 '움직일 수 있는 폭(HRR)'의 몇 %를 쓸지로 강도를 정하는 방식입니다."
            limits={[
              "'220 − 나이'는 여러 연구 자료를 눈으로 맞춰 만든 어림식이라, 같은 나이에서도 개인의 실제 최대 심박수는 ±10~12bpm 이상 흩어집니다.",
              "Tanaka식(208 − 0.7×나이)은 메타분석으로 만들어져 고령층에서 전통식보다 오차가 작다고 보고됩니다. 젊은 층에서는 두 식의 차이가 작습니다.",
              "베타차단제 등 심박수에 영향을 주는 약을 복용 중이면 이 계산은 성립하지 않습니다.",
              "심혈관 질환이 있거나 오랫동안 운동을 쉬었다면, 목표 심박수를 스스로 정하기 전에 운동부하검사 등 의학적 평가를 먼저 받는 것이 안전합니다.",
            ]}
            sources={[
              {
                label: "Tanaka H 외, Age-predicted maximal heart rate revisited, J Am Coll Cardiol 2001 — doi:10.1016/S0735-1097(00)01054-8",
                url: "https://doi.org/10.1016/S0735-1097(00)01054-8",
              },
              {
                label: "Karvonen MJ 외, The effects of training on heart rate, Ann Med Exp Biol Fenn 1957 (카보넨 공식의 원 논문)",
                url: "https://pubmed.ncbi.nlm.nih.gov/13470504/",
              },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          나이(1~120)와 안정 시 심박수(30~120bpm)를 입력하세요.
        </p>
      )}
    </div>
  );
}
