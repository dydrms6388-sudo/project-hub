"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { MedicalDisclaimer, Warnings } from "@/components/calc/Notice";
import Tracker from "@/components/calc/Tracker";
import { Field, Grid, NumberInput, ResultCard, Segmented, TableWrap, Td, Th, TextInput } from "@/components/calc/Ui";
import * as H from "@/lib/health";

type Mode = "wake" | "bed" | "now";

const CYCLES = [6, 5, 4, 3];

export default function SleepCycle() {
  const [mode, setMode] = useState<Mode>("wake");
  const [wake, setWake] = useState("07:00");
  const [bed, setBed] = useState("23:00");
  const [latency, setLatency] = useState("14");

  const lat = Math.max(0, Math.min(120, H.toNum(latency, 14)));

  const nowMin = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, []);

  const anchorMin = mode === "wake" ? H.hhmmToMin(wake) : mode === "bed" ? H.hhmmToMin(bed) : nowMin;

  const rows = useMemo(() => {
    if (mode === "wake") {
      return H.bedTimesFromWake(anchorMin, lat, CYCLES).map((r) => ({
        cycles: r.cycles,
        time: H.minToHhmm(r.min),
        sleepMin: r.cycles * H.CYCLE_MIN,
        totalMin: r.cycles * H.CYCLE_MIN + lat,
      }));
    }
    return H.wakeTimesFromBed(anchorMin, lat, [...CYCLES].reverse()).map((r) => ({
      cycles: r.cycles,
      time: H.minToHhmm(r.min),
      sleepMin: r.cycles * H.CYCLE_MIN,
      totalMin: r.cycles * H.CYCLE_MIN + lat,
    }));
  }, [mode, anchorMin, lat]);

  const best = rows.find((r) => r.cycles === 5) ?? rows[0];

  const warns: H.Warn[] = [];
  if (lat >= 30)
    warns.push({
      level: "info",
      text: "잠드는 데 30분 이상 걸리는 상태가 주 3회 이상, 3개월 넘게 이어진다면 불면증 진단 기준에 해당할 수 있습니다. 수면 클리닉 상담을 고려해 보세요.",
    });

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <Field label="무엇을 알고 싶으세요?" htmlFor="sc-mode">
        <Segmented
          label="계산 방향"
          value={mode}
          onChange={setMode}
          options={[
            { value: "wake", label: "기상 시각 → 취침 시각" },
            { value: "bed", label: "취침 시각 → 기상 시각" },
            { value: "now", label: "지금 자면?" },
          ]}
        />
      </Field>

      <Grid>
        {mode === "wake" ? (
          <Field label="일어나야 하는 시각" htmlFor="sc-wake">
            <TextInput id="sc-wake" type="time" value={wake} onChange={setWake} ariaLabel="기상 시각" />
          </Field>
        ) : mode === "bed" ? (
          <Field label="잠자리에 드는 시각" htmlFor="sc-bed">
            <TextInput id="sc-bed" type="time" value={bed} onChange={setBed} ariaLabel="취침 시각" />
          </Field>
        ) : (
          <Field label="기준 시각" htmlFor="sc-now">
            <p
              id="sc-now"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] text-slate-700"
            >
              지금 ({H.minToHhmm(nowMin)}) 잠자리에 든다고 가정합니다.
            </p>
          </Field>
        )}
        <Field
          label="입면 지연 (잠들기까지)"
          htmlFor="sc-lat"
          hint="건강한 성인의 평균 입면 잠복기는 약 10~20분으로 보고됩니다. 기본값 14분."
        >
          <NumberInput id="sc-lat" value={latency} onChange={setLatency} min={0} max={120} step={1} suffix="분" ariaLabel="입면 지연" />
        </Field>
      </Grid>

      <ResultCard>
        <h3 className="mb-3 text-sm font-bold text-slate-700">
          {mode === "wake" ? `${wake}에 일어나려면 이때 눕기` : "이 시각에 일어나면 사이클이 맞습니다"}
        </h3>
        <TableWrap>
          <table className="w-full min-w-[280px] border-collapse">
            <thead>
              <tr>
                <Th>{mode === "wake" ? "취침 시각" : "기상 시각"}</Th>
                <Th right>사이클</Th>
                <Th right>실제 수면</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cycles} className={r.cycles === 5 ? "bg-white" : undefined}>
                  <Td strong>{r.time}</Td>
                  <Td right>{r.cycles}회</Td>
                  <Td right>
                    {Math.floor(r.sleepMin / 60)}시간 {r.sleepMin % 60 ? `${r.sleepMin % 60}분` : ""}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {best ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            성인 권장 수면 시간(하루 7시간 이상)에 가장 가까운 것은 <b>5사이클(7시간 30분)</b> 안입니다
            — {mode === "wake" ? `${best.time}에 눕기` : `${best.time}에 기상`}. 여기에 잠드는 데
            걸리는 {lat}분이 더해져 잠자리에 머무는 시간은 약 {Math.floor(best.totalMin / 60)}시간{" "}
            {best.totalMin % 60}분입니다.
          </p>
        ) : null}
      </ResultCard>

      <Warnings items={warns} />

      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-800">한 사이클 안에서 일어나는 일</h3>
        <TableWrap>
          <table className="w-full min-w-[300px] border-collapse">
            <thead>
              <tr>
                <Th>단계</Th>
                <Th>특징</Th>
                <Th right>비중</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td strong>N1 (얕은 잠)</Td>
                <Td>깨어 있음과 잠 사이. 쉽게 깹니다.</Td>
                <Td right>약 5%</Td>
              </tr>
              <tr>
                <Td strong>N2</Td>
                <Td>수면방추·K복합체가 나타나는 안정적인 얕은 수면.</Td>
                <Td right>약 45~55%</Td>
              </tr>
              <tr>
                <Td strong>N3 (깊은 잠)</Td>
                <Td>서파수면. 밤의 앞쪽 사이클에 집중됩니다.</Td>
                <Td right>약 15~25%</Td>
              </tr>
              <tr>
                <Td strong>REM</Td>
                <Td>꿈을 꾸는 단계. 밤의 뒤쪽 사이클로 갈수록 길어집니다.</Td>
                <Td right>약 20~25%</Td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          깊은 잠(N3) 한가운데에서 깨면 수면 관성(sleep inertia)이 강하게 나타나 한동안 멍한 느낌이
          남습니다. 90분 배수로 맞추는 이유는 이 구간을 피해 얕은 수면에 가까울 때 깨려는 것입니다.
        </p>
      </section>

      <FormulaBox
        formula={[
          "1 사이클 = 90분 (성인 평균)",
          "취침 시각 = 기상 시각 − 입면 지연 − (사이클 수 × 90분)",
          "기상 시각 = 취침 시각 + 입면 지연 + (사이클 수 × 90분)",
        ]}
        steps={
          mode === "wake"
            ? CYCLES.map((c) => ({
                label: `${c}사이클로 자려면`,
                expr: `${H.minToHhmm(anchorMin)} − ${lat}분 − (${c} × 90분)`,
                value: H.minToHhmm(anchorMin - lat - c * H.CYCLE_MIN),
              }))
            : [...CYCLES].reverse().map((c) => ({
                label: `${c}사이클을 채우면`,
                expr: `${H.minToHhmm(anchorMin)} + ${lat}분 + (${c} × 90분)`,
                value: H.minToHhmm(anchorMin + lat + c * H.CYCLE_MIN),
              }))
        }
        note="수면은 N1 → N2 → N3 → REM 순서로 한 바퀴를 도는 구조가 밤새 반복됩니다. 이 한 바퀴의 평균 길이가 약 90분이라는 관찰에서 '90분 배수' 계산법이 나왔습니다."
        limits={[
          "90분은 어디까지나 평균입니다. 실제 사이클 길이는 70~120분 사이에서 사람마다, 그리고 같은 사람도 밤의 앞뒤에 따라 달라집니다.",
          "밤이 깊어질수록 깊은 잠(N3)은 줄고 REM이 길어져 사이클 구성이 균일하지 않습니다.",
          "총 수면 시간이 충분한지가 사이클 배수보다 훨씬 중요합니다. 성인에게 권장되는 하루 7시간 이상을 4사이클(6시간)로 대체할 수는 없습니다.",
          "입면 지연은 매일 다릅니다. 실측 없이 넣은 값은 어디까지나 가정입니다.",
        ]}
        sources={[
          {
            label: "Watson NF 외, Recommended Amount of Sleep for a Healthy Adult (AASM & SRS 합의 성명), J Clin Sleep Med 2015 — doi:10.5664/jcsm.4758",
            url: "https://doi.org/10.5664/jcsm.4758",
          },
          {
            label: "Carskadon MA, Dement WC, Normal Human Sleep: An Overview (수면 구조 개괄)",
            url: "https://doi.org/10.1016/B978-0-323-24288-2.00002-7",
          },
        ]}
      />

      <Tracker kind="sleep" />
    </div>
  );
}
