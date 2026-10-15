"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote, Warnings } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, Segmented, StatRow, TableWrap, Td, Th } from "@/components/calc/Ui";
import * as H from "@/lib/health";

const log10 = (x: number) => Math.log(x) / Math.LN10;

export default function BodyFat() {
  const [sex, setSex] = useState<H.Sex>("male");
  const [h, setH] = useState("175");
  const [w, setW] = useState("70");
  const [neck, setNeck] = useState("38");
  const [waist, setWaist] = useState("84");
  const [hip, setHip] = useState("95");

  const Hh = H.toNum(h);
  const W = H.toNum(w);
  const N = H.toNum(neck);
  const Wa = H.toNum(waist);
  const Hi = H.toNum(hip);

  const inner = sex === "male" ? Wa - N : Wa + Hi - N;
  const ok = Hh > 100 && W > 20 && N > 10 && Wa > 30 && (sex === "male" || Hi > 30) && inner > 0;

  const pct = useMemo(
    () => (ok ? H.bodyFatNavy(sex, Hh, N, Wa, Hi) : NaN),
    [ok, sex, Hh, N, Wa, Hi],
  );
  const fatKg = W * (pct / 100);
  const leanKg = W - fatKg;
  const band = ok && isFinite(pct) ? H.fatBandOf(sex, pct) : null;

  const warns: H.Warn[] = [];
  if (ok && isFinite(pct)) {
    if ((sex === "male" && pct < 5) || (sex === "female" && pct < 12))
      warns.push({
        level: "warn",
        text: "계산 결과가 생명 유지에 필요한 필수지방 수준 아래로 나왔습니다. 둘레 측정이 잘못됐을 가능성이 크고, 실제로 이 수준이라면 호르몬·면역 기능에 영향을 줄 수 있는 상태입니다. 자가 판단 대신 의료진 상담을 권합니다.",
      });
    if (pct > 45)
      warns.push({
        level: "warn",
        text: "계산 결과가 매우 높게 나왔습니다. 이 공식은 극단값 구간에서 오차가 커집니다. 정확한 평가는 체성분 검사와 의료진 상담으로 확인하세요.",
      });
  }
  if (ok) {
    const whtr = Wa / Hh;
    if (whtr >= 0.5)
      warns.push({
        level: "info",
        text: `허리둘레 ÷ 키 = ${H.fmt(whtr, 2)} 입니다. 이 비율이 0.5 이상이면 복부 비만 지표로 함께 살펴보라는 권고가 있습니다. 수치 자체보다 다른 건강 지표와 함께 해석하는 것이 중요합니다.`,
      });
  }

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Field label="성별" htmlFor="bf-sex">
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
        <Field label="키" htmlFor="bf-h">
          <NumberInput id="bf-h" value={h} onChange={setH} min={100} max={260} step={0.1} suffix="cm" ariaLabel="키" />
        </Field>
        <Field label="체중" htmlFor="bf-w" hint="체지방량·제지방량 환산에만 씁니다.">
          <NumberInput id="bf-w" value={w} onChange={setW} min={20} max={400} step={0.1} suffix="kg" ariaLabel="체중" />
        </Field>
        <Field label="목둘레" htmlFor="bf-n" hint="후두융기(목젖) 바로 아래를 수평으로 감아 잽니다.">
          <NumberInput id="bf-n" value={neck} onChange={setNeck} min={10} max={80} step={0.1} suffix="cm" ariaLabel="목둘레" />
        </Field>
        <Field
          label="허리둘레"
          htmlFor="bf-wa"
          hint={sex === "male" ? "배꼽 높이에서 숨을 내쉰 상태로 잽니다." : "허리에서 가장 잘록한 부분을 잽니다."}
        >
          <NumberInput id="bf-wa" value={waist} onChange={setWaist} min={30} max={250} step={0.1} suffix="cm" ariaLabel="허리둘레" />
        </Field>
        {sex === "female" ? (
          <Field label="엉덩이둘레" htmlFor="bf-hip" hint="엉덩이에서 가장 튀어나온 부분을 수평으로 잽니다.">
            <NumberInput id="bf-hip" value={hip} onChange={setHip} min={30} max={250} step={0.1} suffix="cm" ariaLabel="엉덩이둘레" />
          </Field>
        ) : null}
      </Grid>

      {ok && isFinite(pct) ? (
        <>
          <ResultCard>
            <BigStat
              caption="추정 체지방률 (US Navy 공식)"
              value={H.fmt(pct, 1)}
              unit="%"
              sub={band ? `ACE 분류: ${band.label}` : undefined}
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "체지방량", value: `${H.fmt(fatKg, 1)} kg`, sub: "체중 × 체지방률" },
                  { label: "제지방량(LBM)", value: `${H.fmt(leanKg, 1)} kg`, sub: "체중 − 체지방량" },
                  { label: "허리 ÷ 키", value: H.fmt(Wa / Hh, 2), sub: "복부비만 참고 지표" },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />
          <NoCoachingNote />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">
              체지방률 분류표 ({sex === "male" ? "남성" : "여성"})
            </h3>
            <TableWrap>
              <table className="w-full min-w-[280px] border-collapse">
                <thead>
                  <tr>
                    <Th>구분</Th>
                    <Th right>범위</Th>
                  </tr>
                </thead>
                <tbody>
                  {H.FAT_BANDS[sex].map((b, i, arr) => (
                    <tr key={b.label} className={b === band ? "bg-teal-50" : undefined}>
                      <Td strong={b === band}>{b.label}</Td>
                      <Td right>
                        {i === 0 ? `${b.max}% 미만` : i === arr.length - 1 ? `${b.min}% 이상` : `${b.min} ~ ${b.max}%`}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              분류 구간은 미국 운동협의회(ACE)가 제시한 참고표입니다. 나라·기관마다 절단점이 다르고
              연령대별 차이도 반영되지 않으므로 대략적인 위치 확인용으로만 보세요.
            </p>
          </section>

          <FormulaBox
            formula={
              sex === "male"
                ? [
                    "남성 (cm 단위)",
                    "%BF = 495 ÷ (1.0324 − 0.19077×log₁₀(허리−목) + 0.15456×log₁₀(키)) − 450",
                  ]
                : [
                    "여성 (cm 단위)",
                    "%BF = 495 ÷ (1.29579 − 0.35004×log₁₀(허리+엉덩이−목) + 0.22100×log₁₀(키)) − 450",
                  ]
            }
            steps={[
              {
                label: sex === "male" ? "허리 − 목" : "허리 + 엉덩이 − 목",
                expr:
                  sex === "male"
                    ? `${H.fmt(Wa, 1)} − ${H.fmt(N, 1)}`
                    : `${H.fmt(Wa, 1)} + ${H.fmt(Hi, 1)} − ${H.fmt(N, 1)}`,
                value: `${H.fmt(inner, 1)} cm`,
              },
              {
                label: "둘레 항의 상용로그",
                expr: `log₁₀(${H.fmt(inner, 1)})`,
                value: H.fmt(log10(inner), 5),
              },
              { label: "키의 상용로그", expr: `log₁₀(${H.fmt(Hh, 1)})`, value: H.fmt(log10(Hh), 5) },
              {
                label: "분모",
                expr:
                  sex === "male"
                    ? `1.0324 − 0.19077×${H.fmt(log10(inner), 5)} + 0.15456×${H.fmt(log10(Hh), 5)}`
                    : `1.29579 − 0.35004×${H.fmt(log10(inner), 5)} + 0.22100×${H.fmt(log10(Hh), 5)}`,
                value: H.fmt(
                  sex === "male"
                    ? 1.0324 - 0.19077 * log10(inner) + 0.15456 * log10(Hh)
                    : 1.29579 - 0.35004 * log10(inner) + 0.221 * log10(Hh),
                  5,
                ),
              },
              {
                label: "체지방률",
                expr: `495 ÷ ${H.fmt(
                  sex === "male"
                    ? 1.0324 - 0.19077 * log10(inner) + 0.15456 * log10(Hh)
                    : 1.29579 - 0.35004 * log10(inner) + 0.221 * log10(Hh),
                  5,
                )} − 450`,
                value: `${H.fmt(pct, 2)} %`,
              },
              {
                label: "체지방량 / 제지방량",
                expr: `${H.fmt(W, 1)} × ${H.fmt(pct, 2)}% / ${H.fmt(W, 1)} − ${H.fmt(fatKg, 1)}`,
                value: `${H.fmt(fatKg, 1)}kg / ${H.fmt(leanKg, 1)}kg`,
              },
            ]}
            note="이 식은 미 해군 건강연구소(Naval Health Research Center)의 Hodgdon·Beckett가 1984년에 발표한 둘레 기반 회귀식으로, 미군 체성분 판정에 쓰이면서 널리 퍼졌습니다. 495와 450이라는 상수는 체밀도(body density)에서 체지방률을 구하는 Siri 공식의 변형에서 나옵니다."
            limits={[
              "줄자를 감는 위치와 세기에 따라 결과가 크게 달라집니다. 1cm 차이가 체지방률 1%p 이상을 만들기도 합니다.",
              "둘레만 쓰기 때문에 같은 허리둘레라도 근육이 많은 사람과 지방이 많은 사람을 구분하지 못합니다.",
              "원 회귀식은 군 복무 연령대의 성인 자료로 만들어졌습니다. 고령자·청소년·보디빌더 체형에서는 오차가 커집니다.",
              "DEXA·수중체중법 같은 기준 측정과 비교하면 개인 오차가 ±3~4%p 수준으로 보고됩니다. 소수점 아래를 의미 있게 볼 값이 아닙니다.",
            ]}
            sources={[
              {
                label: "Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men/women from body circumferences and height. Naval Health Research Center Report No. 84-11 (1984)",
                url: "https://apps.dtic.mil/sti/citations/ADA143890",
              },
              {
                label: "Siri WE, Body composition from fluid spaces and density (체밀도→체지방률 변환식의 원형)",
                url: "https://doi.org/10.1016/0899-9007(93)90158-N",
              },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          키·목둘레·허리둘레{sex === "female" ? "·엉덩이둘레" : ""}를 입력하세요.
          {inner <= 0 && Wa > 0 ? " 허리둘레가 목둘레보다 작으면 이 공식은 계산되지 않습니다." : ""}
        </p>
      )}
    </div>
  );
}
