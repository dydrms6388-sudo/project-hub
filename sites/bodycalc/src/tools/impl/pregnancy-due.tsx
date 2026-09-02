"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, Warnings } from "@/components/calc/Notice";
import { BigStat, Field, Grid, NumberInput, ResultCard, StatRow, TableWrap, Td, Th, TextInput } from "@/components/calc/Ui";
import * as H from "@/lib/health";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function PregnancyDue() {
  const [lmp, setLmp] = useState("");
  const [cycle, setCycle] = useState("28");
  const [ref, setRef] = useState(todayIso());

  const L = H.parseYmd(lmp);
  const R = H.parseYmd(ref);
  const C = Math.max(20, Math.min(45, H.toNum(cycle, 28)));
  const ok = !!L && !!R;

  const res = useMemo(() => (ok ? H.pregnancyFromLmp(L!, C, R!) : null), [ok, L, C, R]);
  const daysLeft = res && R ? H.daysBetween(R, res.edd) : 0;

  const warns: H.Warn[] = [];
  if (res && res.gestDays > 300)
    warns.push({
      level: "warn",
      text: "마지막 생리 시작일로부터 계산한 임신 주수가 43주를 넘습니다. 날짜를 다시 확인해 주세요. 실제로 예정일이 크게 지난 상황이라면 즉시 담당 의료진에게 확인해야 합니다.",
    });
  if (res && res.gestDays < 0)
    warns.push({ level: "info", text: "기준일이 마지막 생리 시작일보다 앞섭니다." });

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />
      <p className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        이 계산기는 날짜만 입력받습니다. 이름·연락처 등 개인을 식별할 수 있는 정보는 수집하지 않으며,
        입력한 날짜도 서버로 전송되지 않습니다.
      </p>

      <Grid>
        <Field label="마지막 생리 시작일 (LMP)" htmlFor="pd-lmp" hint="끝난 날이 아니라 시작한 날입니다.">
          <TextInput id="pd-lmp" type="date" value={lmp} onChange={setLmp} ariaLabel="마지막 생리 시작일" />
        </Field>
        <Field label="평균 생리주기" htmlFor="pd-cycle" hint="28일이 아니면 배란일 차이만큼 보정합니다.">
          <NumberInput id="pd-cycle" value={cycle} onChange={setCycle} min={20} max={45} suffix="일" ariaLabel="생리주기" />
        </Field>
        <Field label="기준일" htmlFor="pd-ref" hint="이 날짜 기준으로 임신 주수를 계산합니다.">
          <TextInput id="pd-ref" type="date" value={ref} onChange={setRef} ariaLabel="기준일" />
        </Field>
      </Grid>

      {res ? (
        <>
          <ResultCard>
            <BigStat
              caption="출산 예정일 (네겔 법칙)"
              value={H.fmtYmd(res.edd)}
              unit={`${H.weekdayOf(res.edd)}요일`}
              sub={
                daysLeft >= 0
                  ? `기준일로부터 ${daysLeft}일 남음`
                  : `예정일이 ${Math.abs(daysLeft)}일 지남`
              }
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "현재 임신 주수", value: `${res.weeks}주 ${res.days}일`, sub: `${res.trimester}삼분기` },
                  { label: "추정 수정일", value: H.fmtYmd(res.conception), sub: `LMP + ${14 + (C - 28)}일` },
                  { label: "진행률", value: `${H.fmt(res.progressPct, 0)}%`, sub: `${280 + (C - 28)}일 중` },
                ]}
              />
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
              <div className="h-full bg-teal-600" style={{ width: `${Math.max(0, Math.min(100, res.progressPct))}%` }} />
            </div>
          </ResultCard>

          <Warnings items={warns} />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">주요 시점</h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>시점</Th>
                    <Th>주수</Th>
                    <Th right>날짜</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td strong>1삼분기 시작</Td>
                    <Td>0주 0일</Td>
                    <Td right>{H.fmtYmd(L!)}</Td>
                  </tr>
                  <tr>
                    <Td strong>2삼분기 시작</Td>
                    <Td>14주 0일</Td>
                    <Td right>{H.fmtYmd(res.trimesterStarts.t2)}</Td>
                  </tr>
                  <tr>
                    <Td strong>생존 가능 시기 진입</Td>
                    <Td>24주 0일</Td>
                    <Td right>{H.fmtYmd(res.viability)}</Td>
                  </tr>
                  <tr>
                    <Td strong>3삼분기 시작</Td>
                    <Td>27주 0일</Td>
                    <Td right>{H.fmtYmd(res.trimesterStarts.t3)}</Td>
                  </tr>
                  <tr>
                    <Td strong>만삭(정상 분만 시기)</Td>
                    <Td>37주 0일</Td>
                    <Td right>{H.fmtYmd(res.fullTerm)}</Td>
                  </tr>
                  <tr>
                    <Td strong>출산 예정일</Td>
                    <Td>40주 0일</Td>
                    <Td right>{H.fmtYmd(res.edd)}</Td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              예정일에 정확히 태어나는 경우는 전체의 몇 %에 지나지 않습니다. 대부분은 예정일 전후 2주
              범위에서 태어나며, 37~42주 사이 분만을 정상 범위로 봅니다.
            </p>
          </section>

          <FormulaBox
            formula={[
              "네겔 법칙(Naegele's rule)",
              "출산 예정일 = 마지막 생리 시작일(LMP) + 280일",
              "  (같은 뜻) = LMP − 3개월 + 7일 + 1년",
              "생리주기 보정 = + (평균 주기 − 28)일",
              "임신 주수 = (기준일 − LMP) ÷ 7",
            ]}
            steps={[
              { label: "마지막 생리 시작일", expr: "입력값", value: H.fmtYmd(L!) },
              {
                label: "생리주기 보정",
                expr: `${C} − 28`,
                value: `${C - 28 >= 0 ? "+" : ""}${C - 28}일`,
              },
              {
                label: "출산 예정일",
                expr: `${H.fmtYmd(L!)} + 280일 ${C - 28 >= 0 ? "+" : "−"} ${Math.abs(C - 28)}일`,
                value: H.fmtYmd(res.edd),
              },
              {
                label: "추정 수정일 (배란 시점)",
                expr: `${H.fmtYmd(L!)} + 14일 ${C - 28 >= 0 ? "+" : "−"} ${Math.abs(C - 28)}일`,
                value: H.fmtYmd(res.conception),
              },
              {
                label: "기준일 시점 임신 주수",
                expr: `(${H.fmtYmd(R!)} − ${H.fmtYmd(L!)}) = ${res.gestDays}일 → ${res.gestDays} ÷ 7`,
                value: `${res.weeks}주 ${res.days}일`,
              },
            ]}
            note="네겔 법칙은 19세기 독일 산부인과 의사 프란츠 네겔의 이름에서 왔습니다. '임신 기간 280일'은 마지막 생리 시작일부터 센 값이라, 실제 수정 시점부터는 약 266일입니다. 즉 임신 주수는 아직 임신하지 않은 2주를 포함해 세는 관행입니다."
            limits={[
              "생리주기가 28일이고 배란이 14일째 일어난다는 가정에 기대고 있습니다. 주기가 불규칙하면 오차가 커집니다.",
              "실제 임상에서는 초음파(특히 첫 삼분기의 머리엉덩길이 CRL) 측정으로 예정일을 정하며, 네겔 법칙 결과와 차이가 크면 초음파 값을 우선합니다.",
              "이 계산기는 단태 임신을 전제로 합니다. 쌍둥이 이상은 분만 시기 관리가 다릅니다.",
              "출산 예정일은 '예정'일 뿐이며, 실제 분만일 예측 도구가 아닙니다. 모든 산전 관리는 담당 의료진과 진행하세요.",
            ]}
            sources={[
              {
                label: "ACOG Committee Opinion No. 700: Methods for Estimating the Due Date (2017)",
                url: "https://doi.org/10.1097/AOG.0000000000002046",
              },
              { label: "대한산부인과학회", url: "https://www.ksog.org/" },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          마지막 생리 시작일을 선택하면 예정일이 계산됩니다.
        </p>
      )}
    </div>
  );
}
