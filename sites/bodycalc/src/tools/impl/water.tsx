"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, Warnings } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, Segmented, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

export default function WaterCalc() {
  const [w, setW] = useState("70");
  const [sex, setSex] = useState<H.Sex>("male");
  const [ex, setEx] = useState("30");
  const [hot, setHot] = useState<"no" | "yes">("no");
  const [cup, setCup] = useState("250");

  const W = H.toNum(w);
  const EX = Math.max(0, H.toNum(ex));
  const CUP = Math.max(50, H.toNum(cup, 250));
  const ok = W > 10 && W < 400;

  const [bLo, bHi] = useMemo(() => H.waterFromWeight(W), [W]);
  const [eLo, eHi] = useMemo(() => H.waterFromExercise(EX), [EX]);
  const hotAdd = hot === "yes" ? 500 : 0;
  const lo = bLo + eLo + hotAdd;
  const hi = bHi + eHi + hotAdd;
  const efsaTotal = H.EFSA_TOTAL_WATER[sex];
  const efsaDrink = efsaTotal * H.DRINK_SHARE;

  const warns: H.Warn[] = [];
  if (ok && hi > 4000)
    warns.push({
      level: "warn",
      text: "계산 범위 상한이 4L를 넘습니다. 짧은 시간에 물을 과도하게 마시면 저나트륨혈증 위험이 있습니다. 심부전·신부전·간경변 등으로 수분 제한을 받고 있다면 이 수치를 따르지 말고 담당 의료진의 지시를 우선하세요.",
    });
  if (ok && W < 30)
    warns.push({
      level: "info",
      text: "체중 30kg 미만은 소아일 가능성이 높습니다. 소아는 체중당 필요 수분량 계산식(Holliday-Segar 등)이 따로 있어 이 계산기의 성인 경험식이 맞지 않습니다.",
    });

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Grid>
        <Field label="체중" htmlFor="wt-w">
          <NumberInput id="wt-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="체중" />
        </Field>
        <Field label="하루 운동 시간" htmlFor="wt-ex" hint="땀을 흘리는 활동 시간만 넣으세요.">
          <NumberInput id="wt-ex" value={ex} onChange={setEx} min={0} max={600} step={5} suffix="분" ariaLabel="운동 시간" />
        </Field>
        <Field label="컵 용량" htmlFor="wt-cup" hint="몇 잔인지 환산하는 데만 씁니다.">
          <NumberInput id="wt-cup" value={cup} onChange={setCup} min={50} max={1000} step={10} suffix="mL" ariaLabel="컵 용량" />
        </Field>
        <Field label="성별" htmlFor="wt-sex" hint="EFSA 충분섭취량 비교에만 사용합니다.">
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
      </Grid>

      <Field label="더운 환경·많은 땀" htmlFor="wt-hot">
        <Segmented
          label="더운 환경"
          value={hot}
          onChange={setHot}
          options={[
            { value: "no", label: "보통" },
            { value: "yes", label: "덥거나 땀 많음 (+500mL)" },
          ]}
        />
      </Field>

      {ok ? (
        <>
          <ResultCard>
            <BigStat
              caption="하루 마시는 물 참고 범위"
              value={`${H.fmt(lo / 1000, 1)}~${H.fmt(hi / 1000, 1)}`}
              unit="L/일"
              sub={`약 ${Math.round(lo / CUP)}~${Math.round(hi / CUP)}잔 (${CUP}mL 컵 기준)`}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "체중 기준", value: `${H.fmt(bLo, 0)}~${H.fmt(bHi, 0)}mL`, sub: "30~35 mL/kg" },
                  { label: "운동 보정", value: `${H.fmt(eLo, 0)}~${H.fmt(eHi, 0)}mL`, sub: `${EX}분` },
                  { label: "환경 보정", value: `${hotAdd}mL`, sub: hot === "yes" ? "더운 환경" : "없음" },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">공식 기준과 비교</h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>구분</Th>
                    <Th right>총수분(음식 포함)</Th>
                    <Th right>마시는 물</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td strong>EFSA 충분섭취량 ({sex === "male" ? "성인 남성" : "성인 여성"})</Td>
                    <Td right>{H.fmt(efsaTotal / 1000, 1)}L</Td>
                    <Td right>약 {H.fmt(efsaDrink / 1000, 1)}L</Td>
                  </tr>
                  <tr>
                    <Td strong>이 계산기(체중 기준)</Td>
                    <Td right>—</Td>
                    <Td right>
                      {H.fmt(lo / 1000, 1)}~{H.fmt(hi / 1000, 1)}L
                    </Td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              공식 기준은 &ldquo;음식에 들어 있는 수분까지 포함한 총수분&rdquo;으로 제시됩니다. 국·찌개·과일이
              많은 한국 식단은 음식에서 오는 수분 비중이 커서, 마셔야 하는 물의 양은 총수분보다
              적습니다. 이 계산기는 총수분의 약 75%를 마시는 물로 잡아 비교합니다.
            </p>
          </section>

          <FormulaBox
            formula={[
              "기본량(mL) = 체중(kg) × 30 ~ 35",
              "운동 보정(mL) = (운동시간 ÷ 30분) × 350 ~ 500",
              "더운 환경 보정(mL) = +500",
              "합계 = 기본량 + 운동 보정 + 환경 보정",
            ]}
            steps={[
              {
                label: "체중 기준 기본량",
                expr: `${H.fmt(W, 1)} × 30  ~  ${H.fmt(W, 1)} × 35`,
                value: `${H.fmt(bLo, 0)} ~ ${H.fmt(bHi, 0)} mL`,
              },
              {
                label: `운동 ${EX}분 보정`,
                expr: `(${EX} ÷ 30) × 350  ~  (${EX} ÷ 30) × 500`,
                value: `${H.fmt(eLo, 0)} ~ ${H.fmt(eHi, 0)} mL`,
              },
              { label: "환경 보정", expr: hot === "yes" ? "+500 (더운 환경)" : "+0 (보통)", value: `${hotAdd} mL` },
              {
                label: "합계",
                expr: `${H.fmt(bLo, 0)} + ${H.fmt(eLo, 0)} + ${hotAdd}  ~  ${H.fmt(bHi, 0)} + ${H.fmt(eHi, 0)} + ${hotAdd}`,
                value: `${H.fmt(lo, 0)} ~ ${H.fmt(hi, 0)} mL`,
              },
              {
                label: `컵 환산 (${CUP}mL)`,
                expr: `${H.fmt(lo, 0)} ÷ ${CUP}  ~  ${H.fmt(hi, 0)} ÷ ${CUP}`,
                value: `${Math.round(lo / CUP)} ~ ${Math.round(hi / CUP)} 잔`,
              },
            ]}
            note="'체중 × 30~35mL'는 임상 영양·간호 현장에서 성인 유지수분량을 어림잡을 때 오래 쓰여 온 경험식입니다. 특정 기관이 고시한 규격이 아니라 실무 관행에 가깝다는 점을 감안하세요."
            limits={[
              "필요 수분량은 기온·습도·활동·식단·복용 약에 따라 하루에도 크게 변합니다. 고정된 숫자로 관리할 대상이 아닙니다.",
              "심부전·만성신질환·간경변 등에서는 오히려 수분을 제한합니다. 이 계산 결과를 적용하면 안 됩니다.",
              "커피·차의 이뇨 작용은 마신 물의 양을 상쇄할 만큼 크지 않다는 것이 최근 연구의 일반적 결론이지만, 총 섭취량 계산에 어떻게 반영할지는 기관마다 다릅니다.",
              "가장 실용적인 지표는 계산값이 아니라 갈증과 소변 색입니다.",
            ]}
            sources={[
              {
                label: "EFSA Panel on Dietetic Products, Scientific Opinion on Dietary Reference Values for water, EFSA Journal 2010 — doi:10.2903/j.efsa.2010.1459",
                url: "https://doi.org/10.2903/j.efsa.2010.1459",
              },
              {
                label: "보건복지부·한국영양학회 — 한국인 영양소 섭취기준 (수분)",
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
