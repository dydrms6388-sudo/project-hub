"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, NoCoachingNote, Warnings } from "@/components/calc/Notice";
import {
  BigStat,
  Field,
  Grid,
  NumberInput,
  ResultCard,
  Segmented,
  StatRow,
  TableWrap,
  Td,
  Th,
} from "@/components/calc/Ui";
import * as H from "@/lib/health";

type Tab = "mifflin" | "harris" | "katch";

export default function BmrTdee() {
  const [sex, setSex] = useState<H.Sex>("male");
  const [age, setAge] = useState("30");
  const [h, setH] = useState("175");
  const [w, setW] = useState("70");
  const [fat, setFat] = useState("20");
  const [act, setAct] = useState(H.ACTIVITY_LEVELS[2].key);
  const [tab, setTab] = useState<Tab>("mifflin");

  const A = H.toNum(age);
  const Hh = H.toNum(h);
  const W = H.toNum(w);
  const F = H.toNum(fat);
  const ok = A > 0 && A < 120 && Hh > 50 && Hh < 260 && W > 10 && W < 400;
  const activity = H.ACTIVITY_LEVELS.find((a) => a.key === act) ?? H.ACTIVITY_LEVELS[2];

  const mif = useMemo(() => (ok ? H.bmrMifflin(sex, W, Hh, A) : NaN), [ok, sex, W, Hh, A]);
  const hb = useMemo(() => (ok ? H.bmrHarrisBenedict(sex, W, Hh, A) : NaN), [ok, sex, W, Hh, A]);
  const km = useMemo(() => (ok && F > 0 && F < 70 ? H.bmrKatchMcArdle(W, F) : NaN), [ok, W, F]);

  const current = tab === "mifflin" ? mif : tab === "harris" ? hb : km;
  const total = H.tdee(current, activity.factor);
  const warns = ok && isFinite(total) ? H.calorieWarnings(total) : [];

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Field label="성별" htmlFor="bmr-sex">
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
        <Field label="나이" htmlFor="bmr-age">
          <NumberInput id="bmr-age" value={age} onChange={setAge} min={1} max={120} suffix="세" ariaLabel="나이" />
        </Field>
        <Field label="키" htmlFor="bmr-h">
          <NumberInput id="bmr-h" value={h} onChange={setH} min={50} max={260} step={0.1} suffix="cm" ariaLabel="키" />
        </Field>
        <Field label="체중" htmlFor="bmr-w">
          <NumberInput id="bmr-w" value={w} onChange={setW} min={10} max={400} step={0.1} suffix="kg" ariaLabel="체중" />
        </Field>
        <Field label="체지방률(선택)" htmlFor="bmr-fat" hint="Katch-McArdle 탭에서만 사용합니다.">
          <NumberInput id="bmr-fat" value={fat} onChange={setFat} min={1} max={70} step={0.1} suffix="%" ariaLabel="체지방률" />
        </Field>
      </Grid>

      <Field label="활동 수준" htmlFor="bmr-act" hint={activity.desc}>
        <div className="space-y-2">
          {H.ACTIVITY_LEVELS.map((a) => (
            <label
              key={a.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${
                a.key === act ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="activity"
                value={a.key}
                checked={a.key === act}
                onChange={() => setAct(a.key)}
                className="mt-1 shrink-0"
                aria-label={`${a.label} (계수 ${a.factor})`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  {a.label} <span className="text-slate-400">×{a.factor}</span>
                </span>
                <span className="block text-xs leading-relaxed text-slate-500">{a.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">계산식 선택</p>
        <Segmented
          label="계산식"
          value={tab}
          onChange={setTab}
          options={[
            { value: "mifflin", label: "Mifflin-St Jeor" },
            { value: "harris", label: "Harris-Benedict" },
            { value: "katch", label: "Katch-McArdle" },
          ]}
        />
      </div>

      {ok && isFinite(current) ? (
        <>
          <ResultCard>
            <BigStat
              caption={`기초대사량 (BMR) · ${tab === "mifflin" ? "Mifflin-St Jeor" : tab === "harris" ? "Harris-Benedict 개정판" : "Katch-McArdle"}`}
              value={H.fmt(current, 0)}
              unit="kcal/일"
              sub="아무것도 하지 않고 누워만 있어도 생명 유지에 쓰이는 열량"
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "활동대사량 (TDEE)", value: `${H.fmt(total, 0)} kcal`, sub: `BMR × ${activity.factor}` },
                  { label: "시간당", value: `${H.fmt(current / 24, 1)} kcal`, sub: "BMR ÷ 24" },
                  { label: "활동으로 쓰는 몫", value: `${H.fmt(total - current, 0)} kcal`, sub: "TDEE − BMR" },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />
          <NoCoachingNote />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">세 공식 비교</h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>공식</Th>
                    <Th right>BMR</Th>
                    <Th right>TDEE</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td strong>Mifflin-St Jeor (1990)</Td>
                    <Td right>{H.fmt(mif, 0)}</Td>
                    <Td right>{H.fmt(mif * activity.factor, 0)}</Td>
                  </tr>
                  <tr>
                    <Td strong>Harris-Benedict 개정판 (1984)</Td>
                    <Td right>{H.fmt(hb, 0)}</Td>
                    <Td right>{H.fmt(hb * activity.factor, 0)}</Td>
                  </tr>
                  <tr>
                    <Td strong>Katch-McArdle</Td>
                    <Td right>{isFinite(km) ? H.fmt(km, 0) : "체지방률 필요"}</Td>
                    <Td right>{isFinite(km) ? H.fmt(km * activity.factor, 0) : "—"}</Td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              두 식의 차이는 보통 {H.fmt(Math.abs(mif - hb), 0)}kcal 안팎입니다. Harris-Benedict는
              1919년 원식을 1984년에 재분석한 값이라 같은 조건에서 Mifflin-St Jeor보다 조금 높게
              나오는 경향이 있습니다.
            </p>
          </section>

          <FormulaBox
            formula={
              tab === "mifflin"
                ? [
                    "남성: BMR = 10×체중(kg) + 6.25×키(cm) − 5×나이 + 5",
                    "여성: BMR = 10×체중(kg) + 6.25×키(cm) − 5×나이 − 161",
                    "TDEE = BMR × 활동계수",
                  ]
                : tab === "harris"
                  ? [
                      "남성: BMR = 88.362 + 13.397×체중 + 4.799×키 − 5.677×나이",
                      "여성: BMR = 447.593 + 9.247×체중 + 3.098×키 − 4.330×나이",
                      "TDEE = BMR × 활동계수",
                    ]
                  : [
                      "제지방량(LBM) = 체중 × (1 − 체지방률/100)",
                      "BMR = 370 + 21.6 × LBM",
                      "TDEE = BMR × 활동계수",
                    ]
            }
            steps={
              tab === "mifflin"
                ? [
                    { label: "체중 항", expr: `10 × ${H.fmt(W, 1)}`, value: `${H.fmt(10 * W, 1)}` },
                    { label: "키 항", expr: `6.25 × ${H.fmt(Hh, 1)}`, value: `${H.fmt(6.25 * Hh, 2)}` },
                    { label: "나이 항", expr: `−5 × ${H.fmt(A, 0)}`, value: `${H.fmt(-5 * A, 0)}` },
                    {
                      label: `성별 상수 (${sex === "male" ? "남성 +5" : "여성 −161"})`,
                      expr: `${H.fmt(10 * W, 1)} + ${H.fmt(6.25 * Hh, 2)} ${H.fmt(-5 * A, 0)} ${sex === "male" ? "+ 5" : "− 161"}`,
                      value: `${H.fmt(mif, 1)} kcal`,
                    },
                    {
                      label: `TDEE (활동계수 ${activity.factor} — ${activity.label})`,
                      expr: `${H.fmt(mif, 1)} × ${activity.factor}`,
                      value: `${H.fmt(mif * activity.factor, 0)} kcal`,
                    },
                  ]
                : tab === "harris"
                  ? [
                      {
                        label: "체중 항",
                        expr: `${sex === "male" ? "13.397" : "9.247"} × ${H.fmt(W, 1)}`,
                        value: `${H.fmt((sex === "male" ? 13.397 : 9.247) * W, 2)}`,
                      },
                      {
                        label: "키 항",
                        expr: `${sex === "male" ? "4.799" : "3.098"} × ${H.fmt(Hh, 1)}`,
                        value: `${H.fmt((sex === "male" ? 4.799 : 3.098) * Hh, 2)}`,
                      },
                      {
                        label: "나이 항",
                        expr: `−${sex === "male" ? "5.677" : "4.330"} × ${H.fmt(A, 0)}`,
                        value: `${H.fmt(-(sex === "male" ? 5.677 : 4.33) * A, 2)}`,
                      },
                      {
                        label: `상수 ${sex === "male" ? "88.362" : "447.593"} 더하기`,
                        expr: `${sex === "male" ? "88.362" : "447.593"} + ${H.fmt((sex === "male" ? 13.397 : 9.247) * W, 2)} + ${H.fmt((sex === "male" ? 4.799 : 3.098) * Hh, 2)} ${H.fmt(-(sex === "male" ? 5.677 : 4.33) * A, 2)}`,
                        value: `${H.fmt(hb, 1)} kcal`,
                      },
                      {
                        label: `TDEE (활동계수 ${activity.factor})`,
                        expr: `${H.fmt(hb, 1)} × ${activity.factor}`,
                        value: `${H.fmt(hb * activity.factor, 0)} kcal`,
                      },
                    ]
                  : [
                      {
                        label: "제지방량",
                        expr: `${H.fmt(W, 1)} × (1 − ${H.fmt(F, 1)}/100)`,
                        value: `${H.fmt(W * (1 - F / 100), 2)} kg`,
                      },
                      {
                        label: "BMR",
                        expr: `370 + 21.6 × ${H.fmt(W * (1 - F / 100), 2)}`,
                        value: `${H.fmt(km, 1)} kcal`,
                      },
                      {
                        label: `TDEE (활동계수 ${activity.factor})`,
                        expr: `${H.fmt(km, 1)} × ${activity.factor}`,
                        value: `${H.fmt(km * activity.factor, 0)} kcal`,
                      },
                    ]
            }
            note="활동계수는 1919년 이후 여러 문헌에서 관습적으로 쓰여 온 값으로, 특정 기관이 확정한 규격이 아니라 넓은 어림값입니다. 실제 일상 활동량(NEAT)은 사람마다 하루 수백 kcal씩 차이가 납니다."
            limits={[
              "BMR 예측식은 집단 평균에 대한 회귀식이라 개인 오차가 ±10% 이상 날 수 있습니다. 정확한 값은 간접열량계 측정이 필요합니다.",
              "Mifflin-St Jeor는 1980년대 미국 성인 자료를 기반으로 만들어졌습니다. 체격 분포가 다른 집단에서는 오차가 커질 수 있습니다.",
              "Katch-McArdle은 체지방률 입력값의 정확도에 그대로 좌우됩니다. 눈대중 체지방률을 넣으면 결과도 눈대중입니다.",
              "갑상선 질환, 발열, 임신·수유, 성장기에는 실제 대사량이 예측식과 크게 달라집니다.",
            ]}
            sources={[
              {
                label: "Mifflin MD 외, A new predictive equation for resting energy expenditure in healthy individuals, Am J Clin Nutr 1990 — doi:10.1093/ajcn/51.2.241",
                url: "https://doi.org/10.1093/ajcn/51.2.241",
              },
              {
                label: "Roza AM, Shizgal HM, The Harris Benedict equation reevaluated, Am J Clin Nutr 1984 — doi:10.1093/ajcn/40.1.168",
                url: "https://doi.org/10.1093/ajcn/40.1.168",
              },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {tab === "katch"
            ? "Katch-McArdle 식은 체지방률(1~70%)이 필요합니다."
            : "나이·키·체중을 입력하면 계산됩니다."}
        </p>
      )}
    </div>
  );
}
