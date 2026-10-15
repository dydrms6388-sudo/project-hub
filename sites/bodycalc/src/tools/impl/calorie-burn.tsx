"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, Select, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

/** 소비 열량을 감으로 잡기 위한 비교 식품 (100g/1개 기준 대표값) */
const FOOD_REF = [
  { name: "밥 한 공기(210g)", kcal: 310 },
  { name: "아메리카노(무설탕)", kcal: 10 },
  { name: "카페라떼(톨)", kcal: 180 },
  { name: "삼겹살 100g", kcal: 330 },
  { name: "바나나 1개", kcal: 105 },
  { name: "치킨 1조각", kcal: 250 },
];

export default function CalorieBurn() {
  const [w, setW] = useState("70");
  const [min, setMin] = useState("30");
  const [name, setName] = useState(H.METS[1].name);
  const [mode, setMode] = useState<"gross" | "net">("gross");

  const W = H.toNum(w);
  const M = H.toNum(min);
  const ok = W > 10 && W < 400 && M > 0 && M <= 1440;
  const item = H.METS.find((m) => m.name === name) ?? H.METS[0];

  const gross = useMemo(() => (ok ? H.caloriesBurned(item.met, W, M) : NaN), [ok, item, W, M]);
  const net = useMemo(() => (ok ? H.netCaloriesBurned(item.met, W, M) : NaN), [ok, item, W, M]);
  const shown = mode === "gross" ? gross : net;

  const groups = useMemo(() => {
    const map = new Map<string, H.Met[]>();
    for (const m of H.METS) {
      const arr = map.get(m.group) ?? [];
      arr.push(m);
      map.set(m.group, arr);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Grid>
        <Field label="체중" htmlFor="cb-w">
          <NumberInput id="cb-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="체중" />
        </Field>
        <Field label="운동 시간" htmlFor="cb-m">
          <NumberInput id="cb-m" value={min} onChange={setMin} min={1} max={1440} step={5} suffix="분" ariaLabel="운동 시간" />
        </Field>
      </Grid>

      <Field label={`종목 (총 ${H.METS.length}개)`} htmlFor="cb-name" hint={`선택한 종목의 MET 값: ${item.met}`}>
        <select
          id="cb-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="운동 종목"
          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900"
        >
          {groups.map(([g, items]) => (
            <optgroup key={g} label={g}>
              {items.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · MET {m.met}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="계산 방식" htmlFor="cb-mode">
        <Select
          id="cb-mode"
          value={mode}
          onChange={setMode}
          ariaLabel="계산 방식"
          options={[
            { value: "gross", label: "총 소비 (기초대사 포함) — 일반적인 표기" },
            { value: "net", label: "순 소비 (가만히 있었어도 썼을 몫을 뺌)" },
          ]}
        />
      </Field>

      {ok ? (
        <>
          <ResultCard>
            <BigStat
              caption={`${item.name} ${M}분 · ${mode === "gross" ? "총 소비" : "순 소비"}`}
              value={H.fmt(shown, 0)}
              unit="kcal"
              sub={`MET ${item.met} · 체중 ${H.fmt(W, 1)}kg 기준`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "총 소비", value: `${H.fmt(gross, 0)} kcal`, sub: "안정 시 대사 포함" },
                  { label: "순 소비", value: `${H.fmt(net, 0)} kcal`, sub: "MET 1.0 만큼 차감" },
                  { label: "분당", value: `${H.fmt(shown / M, 1)} kcal`, sub: "선택한 방식 기준" },
                ]}
              />
            </div>
          </ResultCard>

          <NoCoachingNote />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">시간을 바꾸면</h3>
            <TableWrap>
              <table className="w-full min-w-[280px] border-collapse">
                <thead>
                  <tr>
                    <Th>시간</Th>
                    <Th right>총 소비</Th>
                    <Th right>순 소비</Th>
                  </tr>
                </thead>
                <tbody>
                  {[10, 20, 30, 45, 60, 90].map((t) => (
                    <tr key={t}>
                      <Td strong>{t}분</Td>
                      <Td right>{H.fmt(H.caloriesBurned(item.met, W, t), 0)} kcal</Td>
                      <Td right>{H.fmt(H.netCaloriesBurned(item.met, W, t), 0)} kcal</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">
              {H.fmt(shown, 0)}kcal는 대략 이만큼입니다
            </h3>
            <TableWrap>
              <table className="w-full min-w-[280px] border-collapse">
                <thead>
                  <tr>
                    <Th>음식</Th>
                    <Th right>열량</Th>
                    <Th right>환산</Th>
                  </tr>
                </thead>
                <tbody>
                  {FOOD_REF.map((f) => (
                    <tr key={f.name}>
                      <Td>{f.name}</Td>
                      <Td right>{f.kcal} kcal</Td>
                      <Td right>{H.fmt(shown / f.kcal, 1)}개분</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              음식 열량은 조리법과 제품에 따라 크게 달라지는 대표값입니다. 운동 소비량과 음식 열량을
              1:1로 상계하는 계산은 실제 체중 변화와 잘 맞지 않는다는 점도 함께 알아두세요.
            </p>
          </section>

          <FormulaBox
            formula={[
              "소비 열량(kcal) = MET × 3.5 × 체중(kg) ÷ 200 × 시간(분)",
              "  (같은 뜻) = MET × 체중(kg) × 시간(h)",
              "순 소비 = (MET − 1) × 3.5 × 체중 ÷ 200 × 시간",
              "1 MET = 3.5 mL O₂/kg/min ≒ 안정 시 산소 소비량",
            ]}
            steps={[
              { label: "선택한 종목의 MET", expr: `${item.name}`, value: `${item.met} MET` },
              {
                label: "분당 산소 소비량",
                expr: `${item.met} × 3.5 × ${H.fmt(W, 1)}`,
                value: `${H.fmt(item.met * 3.5 * W, 1)} mL O₂/min`,
              },
              {
                label: "분당 열량 (산소 1L ≒ 5kcal → ÷200)",
                expr: `${H.fmt(item.met * 3.5 * W, 1)} ÷ 200`,
                value: `${H.fmt((item.met * 3.5 * W) / 200, 2)} kcal/min`,
              },
              {
                label: `${M}분 총 소비`,
                expr: `${H.fmt((item.met * 3.5 * W) / 200, 2)} × ${M}`,
                value: `${H.fmt(gross, 1)} kcal`,
              },
              {
                label: "순 소비 (MET 1.0 차감)",
                expr: `(${item.met} − 1) × 3.5 × ${H.fmt(W, 1)} ÷ 200 × ${M}`,
                value: `${H.fmt(net, 1)} kcal`,
              },
            ]}
            note="MET(Metabolic Equivalent of Task)는 '가만히 앉아 있을 때 대비 몇 배의 에너지를 쓰는가'를 나타내는 단위입니다. 1 MET는 체중 1kg당 분당 3.5mL의 산소 소비에 해당하고, 산소 1L를 쓰면 약 5kcal가 소모된다는 관계에서 ÷200 이라는 상수가 나옵니다."
            limits={[
              "MET 값은 Compendium of Physical Activities의 집단 평균입니다. 같은 운동도 숙련도·자세·기구 저항에 따라 실제 소비가 크게 달라집니다.",
              "1 MET = 3.5 mL/kg/min 이라는 기준은 체중 70kg·40세 남성 표준값에서 나온 것이라, 체격이 다르면 오차가 생깁니다. 비만·고령자에서는 과대평가 경향이 보고됩니다.",
              "스마트워치·러닝머신에 표시되는 값과 다를 수 있습니다. 기기마다 심박수·보폭 등 다른 모델을 씁니다.",
              "운동 후 초과산소섭취(EPOC, 애프터번)는 이 식에 포함되지 않습니다.",
            ]}
            sources={[
              {
                label: "Ainsworth BE 외, 2011 Compendium of Physical Activities, Med Sci Sports Exerc — doi:10.1249/MSS.0b013e31821ece12",
                url: "https://doi.org/10.1249/MSS.0b013e31821ece12",
              },
              { label: "Compendium of Physical Activities 공식 사이트", url: "https://pacompendium.com/" },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          체중과 운동 시간을 입력하면 계산됩니다.
        </p>
      )}
    </div>
  );
}
