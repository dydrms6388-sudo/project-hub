"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, Segmented, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

export default function IdealWeight() {
  const [sex, setSex] = useState<H.Sex>("male");
  const [h, setH] = useState("170");
  const [w, setW] = useState("68");

  const Hh = H.toNum(h);
  const W = H.toNum(w);
  const ok = Hh > 120 && Hh < 260;

  const results = useMemo(
    () => (ok ? H.IDEAL_FORMULAS.map((f) => ({ f, kg: f.calc(sex, Hh) })) : []),
    [ok, sex, Hh],
  );
  const values = results.map((r) => r.kg);
  const lo = values.length ? Math.min(...values) : NaN;
  const hi = values.length ? Math.max(...values) : NaN;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

  const [bmiLo, bmiHi] = H.weightRangeForBmi(Hh, 18.5, 22.9);
  const inch = Hh / 2.54 - 60;

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Field label="성별" htmlFor="iw-sex">
        <Segmented
          label="성별"
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "남성" },
            { value: "female", label: "여성" },
          ]}
        />
      </Field>

      <Grid>
        <Field label="키" htmlFor="iw-h">
          <NumberInput id="iw-h" value={h} onChange={setH} min={120} max={260} step={0.1} suffix="cm" ariaLabel="키" />
        </Field>
        <Field label="현재 체중(선택)" htmlFor="iw-w" hint="비교용으로만 씁니다. 목표를 제시하지 않습니다.">
          <NumberInput id="iw-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="현재 체중" />
        </Field>
      </Grid>

      {ok ? (
        <>
          <ResultCard>
            <BigStat
              caption="여섯 가지 공식이 만드는 폭"
              value={`${H.fmt(lo, 1)}~${H.fmt(hi, 1)}`}
              unit="kg"
              sub={`평균 ${H.fmt(avg, 1)}kg · 공식 간 차이 ${H.fmt(hi - lo, 1)}kg`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "BMI 18.5~22.9 구간", value: `${H.fmt(bmiLo, 1)}~${H.fmt(bmiHi, 1)}kg`, sub: "아시아·태평양 기준" },
                  {
                    label: "현재 체중의 BMI",
                    value: W > 10 ? H.fmt(H.bmi(W, Hh), 1) : "—",
                    sub: W > 10 ? "kg/m²" : "체중 미입력",
                  },
                  { label: "공식별 최대 차이", value: `${H.fmt(hi - lo, 1)}kg`, sub: "어떤 식을 쓰느냐의 폭" },
                ]}
              />
            </div>
          </ResultCard>

          <NoCoachingNote />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">공식별 결과</h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>공식</Th>
                    <Th right>표준체중</Th>
                    <Th right>현재와 차이</Th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.f.key}>
                      <Td strong>{r.f.label}</Td>
                      <Td right>{H.fmt(r.kg, 1)} kg</Td>
                      <Td right>{W > 10 ? `${W - r.kg >= 0 ? "+" : ""}${H.fmt(W - r.kg, 1)} kg` : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-500">
              {results.map((r) => (
                <li key={r.f.key}>
                  <b className="text-slate-700">{r.f.label}</b> — {r.f.note}
                </li>
              ))}
            </ul>
          </section>

          <FormulaBox
            formula={[
              "BMI 표준체중법 : 키(m)² × 22(남) / 21(여)",
              "브로카 변법     : (키cm − 100) × 0.9",
              "Devine  (1974) : 남 50   + 2.3×(키인치−60) / 여 45.5 + 2.3×(…)",
              "Robinson(1983) : 남 52   + 1.9×인치 / 여 49   + 1.7×인치",
              "Miller  (1983) : 남 56.2 + 1.41×인치 / 여 53.1 + 1.36×인치",
              "Hamwi   (1964) : 남 48   + 2.7×인치 / 여 45.5 + 2.2×인치",
              "  * 인치 = (키cm ÷ 2.54) − 60  (5피트 초과분)",
            ]}
            steps={[
              { label: "키를 인치로", expr: `${H.fmt(Hh, 1)} ÷ 2.54`, value: `${H.fmt(Hh / 2.54, 2)} in` },
              {
                label: "5피트(60인치) 초과분",
                expr: `${H.fmt(Hh / 2.54, 2)} − 60`,
                value: `${H.fmt(Math.max(0, inch), 2)} in`,
              },
              ...results.map((r) => ({
                label: r.f.label,
                expr: substitution(r.f.key, sex, Hh, Math.max(0, inch)),
                value: `${H.fmt(r.kg, 2)} kg`,
              })),
              {
                label: "BMI 18.5~22.9 로 환산한 체중 범위",
                expr: `18.5 × ${H.fmt((Hh / 100) ** 2, 4)}  ~  22.9 × ${H.fmt((Hh / 100) ** 2, 4)}`,
                value: `${H.fmt(bmiLo, 1)} ~ ${H.fmt(bmiHi, 1)} kg`,
              },
            ]}
            note="'표준체중' 공식들은 대부분 1960~80년대에 약물 용량 계산이나 식이요법 처방을 위해 만들어졌습니다. 같은 키에서도 공식에 따라 몇 kg씩 차이가 나는 이유는 각 식이 서로 다른 목적과 서로 다른 인구 집단을 기준으로 만들어졌기 때문입니다."
            limits={[
              "표준체중은 '건강한 체중'이 아니라 '통계적 기준값'입니다. 이 숫자와 다르다고 해서 건강에 문제가 있다는 뜻이 아닙니다.",
              "모든 식이 키만 입력받습니다. 골격 크기, 근육량, 나이, 인종 차이를 전혀 반영하지 못합니다.",
              "Devine·Robinson·Miller·Hamwi는 인치 기반이라 5피트(152.4cm) 미만에서는 정의가 불분명하거나 비현실적인 값이 나옵니다.",
              "체중보다 허리둘레·체력·혈압 같은 지표가 건강 상태를 더 잘 설명한다는 연구가 많습니다.",
            ]}
            sources={[
              {
                label: "Pai MP, Paloucek FP, The origin of the ideal body weight equations, Ann Pharmacother 2000 — doi:10.1345/aph.19381",
                url: "https://doi.org/10.1345/aph.19381",
              },
              { label: "대한비만학회 — 비만 진료지침", url: "https://general.kosso.or.kr/" },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          키(120~260cm)를 입력하면 계산됩니다.
        </p>
      )}
    </div>
  );
}

function substitution(key: string, sex: H.Sex, heightCm: number, inch: number): string {
  const m = heightCm / 100;
  const male = sex === "male";
  switch (key) {
    case "bmi":
      return `${H.fmt(m, 3)}² × ${male ? 22 : 21}`;
    case "broca":
      return `(${H.fmt(heightCm, 1)} − 100) × 0.9`;
    case "devine":
      return `${male ? 50 : 45.5} + 2.3 × ${H.fmt(inch, 2)}`;
    case "robinson":
      return `${male ? 52 : 49} + ${male ? 1.9 : 1.7} × ${H.fmt(inch, 2)}`;
    case "miller":
      return `${male ? 56.2 : 53.1} + ${male ? 1.41 : 1.36} × ${H.fmt(inch, 2)}`;
    case "hamwi":
      return `${male ? 48 : 45.5} + ${male ? 2.7 : 2.2} × ${H.fmt(inch, 2)}`;
    default:
      return "";
  }
}
