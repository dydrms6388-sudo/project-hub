"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

/** 100g당 단백질(g) — 식품 표기·품종에 따라 편차가 있는 대표값 */
const FOODS = [
  { name: "닭가슴살(생)", per100: 23, unit: "100g" },
  { name: "소고기 안심", per100: 21, unit: "100g" },
  { name: "돼지 등심", per100: 22, unit: "100g" },
  { name: "연어", per100: 20, unit: "100g" },
  { name: "고등어", per100: 20, unit: "100g" },
  { name: "달걀 1개(약 50g)", per100: 12.5, unit: "50g" },
  { name: "두부(부침용)", per100: 9, unit: "100g" },
  { name: "우유", per100: 3.3, unit: "100mL" },
  { name: "그릭요거트(무가당)", per100: 9, unit: "100g" },
  { name: "검은콩(삶은 것)", per100: 9, unit: "100g" },
  { name: "귀리(생)", per100: 13, unit: "100g" },
  { name: "쌀밥", per100: 2.6, unit: "100g" },
];

export default function ProteinCalc() {
  const [w, setW] = useState("70");
  const [goalKey, setGoalKey] = useState(H.PROTEIN_GOALS[1].key);
  const [meals, setMeals] = useState("3");

  const W = H.toNum(w);
  const M = Math.max(1, Math.min(8, H.toNum(meals, 3)));
  const ok = W > 10 && W < 400;
  const goal = H.PROTEIN_GOALS.find((g) => g.key === goalKey) ?? H.PROTEIN_GOALS[0];
  const [lo, hi] = useMemo(() => H.proteinRange(W, goal), [W, goal]);
  const mid = (lo + hi) / 2;

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Grid>
        <Field label="체중" htmlFor="pro-w">
          <NumberInput id="pro-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="체중" />
        </Field>
        <Field label="하루 식사 횟수" htmlFor="pro-meals" hint="한 끼에 얼마씩 나눠지는지 보여줍니다.">
          <NumberInput id="pro-meals" value={meals} onChange={setMeals} min={1} max={8} suffix="끼" ariaLabel="식사 횟수" />
        </Field>
      </Grid>

      <Field label="목적·활동 수준" htmlFor="pro-goal" hint={goal.note}>
        <div className="space-y-2">
          {H.PROTEIN_GOALS.map((g) => (
            <label
              key={g.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${
                g.key === goalKey ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="protein-goal"
                value={g.key}
                checked={g.key === goalKey}
                onChange={() => setGoalKey(g.key)}
                className="mt-1 shrink-0"
                aria-label={`${g.label} ${g.min}~${g.max} g/kg`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{g.label}</span>
                <span className="block text-xs text-slate-500">
                  체중 1kg당 {g.min}~{g.max}g
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      {ok ? (
        <>
          <ResultCard>
            <BigStat
              caption="하루 단백질 참고 범위"
              value={`${H.fmt(lo, 0)}~${H.fmt(hi, 0)}`}
              unit="g/일"
              sub={`체중 ${H.fmt(W, 1)}kg × ${goal.min}~${goal.max} g/kg`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "한 끼당", value: `${H.fmt(lo / M, 0)}~${H.fmt(hi / M, 0)}g`, sub: `${M}끼로 나눌 때` },
                  { label: "열량 환산", value: `${H.fmt(mid * 4, 0)} kcal`, sub: "단백질 1g = 4kcal" },
                  { label: "중앙값", value: `${H.fmt(mid, 0)} g`, sub: "범위의 가운데 값" },
                ]}
              />
            </div>
          </ResultCard>

          <NoCoachingNote />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">
              중앙값 {H.fmt(mid, 0)}g을 채우려면 (식품 100g 기준)
            </h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>식품</Th>
                    <Th right>단백질</Th>
                    <Th right>필요량</Th>
                  </tr>
                </thead>
                <tbody>
                  {FOODS.map((f) => (
                    <tr key={f.name}>
                      <Td>{f.name}</Td>
                      <Td right>
                        {f.per100}g / {f.unit}
                      </Td>
                      <Td right>{H.fmt((mid / f.per100) * 100, 0)}g</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              식품별 단백질 함량은 품종·부위·조리 상태에 따라 달라지는 대표값입니다. 정확한 값은
              제품 영양성분표를 확인하세요. 표의 &ldquo;필요량&rdquo;은 그 식품 하나로만 채웠을 때의
              양이며, 실제로는 여러 식품에 나눠 담깁니다.
            </p>
          </section>

          <FormulaBox
            formula={[
              "하루 단백질(g) = 체중(kg) × 목적별 계수(g/kg)",
              "한 끼당(g) = 하루 단백질 ÷ 식사 횟수",
              "열량(kcal) = 단백질(g) × 4",
            ]}
            steps={[
              {
                label: "하한",
                expr: `${H.fmt(W, 1)} × ${goal.min}`,
                value: `${H.fmt(lo, 1)} g`,
              },
              {
                label: "상한",
                expr: `${H.fmt(W, 1)} × ${goal.max}`,
                value: `${H.fmt(hi, 1)} g`,
              },
              {
                label: `한 끼당 (${M}끼)`,
                expr: `${H.fmt(lo, 1)} ÷ ${M}  ~  ${H.fmt(hi, 1)} ÷ ${M}`,
                value: `${H.fmt(lo / M, 1)} ~ ${H.fmt(hi / M, 1)} g`,
              },
              {
                label: "열량 환산(중앙값)",
                expr: `${H.fmt(mid, 1)} × 4`,
                value: `${H.fmt(mid * 4, 0)} kcal`,
              },
            ]}
            note={`선택한 구간의 근거: ${goal.note}`}
            limits={[
              "권장섭취량(RDA 0.8~0.91 g/kg)은 '결핍을 막는 최소선'이지 '최적치'가 아닙니다. 운동 목적의 상향 범위는 스포츠영양 학회 성명에서 온 값이라 성격이 다릅니다.",
              "체중이 아니라 제지방량 기준으로 계산해야 한다는 견해도 있습니다. 체지방률이 매우 높은 경우 체중 기준은 과대평가가 됩니다.",
              "신장질환·간질환이 있으면 단백질 섭취량은 반드시 의료진이 정해야 합니다. 이 계산기의 범위를 그대로 적용하면 안 됩니다.",
              "총 섭취 열량이 부족하면 단백질이 에너지원으로 소모되어 같은 양을 먹어도 효과가 달라집니다.",
            ]}
            sources={[
              {
                label: "Jäger R 외, ISSN Position Stand: Protein and Exercise, J Int Soc Sports Nutr 2017 — doi:10.1186/s12970-017-0177-8",
                url: "https://doi.org/10.1186/s12970-017-0177-8",
              },
              {
                label: "Thomas DT 외, ACSM/AND/DC Joint Position Statement: Nutrition and Athletic Performance, 2016 — doi:10.1249/MSS.0000000000000852",
                url: "https://doi.org/10.1249/MSS.0000000000000852",
              },
              {
                label: "보건복지부·한국영양학회 — 한국인 영양소 섭취기준",
                url: "https://www.kns.or.kr/",
              },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          체중(10~400kg)을 입력하면 계산됩니다.
        </p>
      )}
    </div>
  );
}
