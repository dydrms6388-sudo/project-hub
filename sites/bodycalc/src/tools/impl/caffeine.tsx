"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import LineChart from "@/components/calc/LineChart";
import { MedicalDisclaimer, Warnings } from "@/components/calc/Notice";
import Tracker from "@/components/calc/Tracker";
import { BigStat, Field, Grid, NumberInput, ResultCard, StatRow, TableWrap, Td, Th, TextInput } from "@/components/calc/Ui";
import * as H from "@/lib/health";

type Row = { id: string; hhmm: string; mg: string; label: string };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function CaffeineCalc() {
  const [rows, setRows] = useState<Row[]>([
    { id: "a", hhmm: "09:00", mg: "125", label: "아메리카노(작은 컵)" },
    { id: "b", hhmm: "14:00", mg: "125", label: "아메리카노(작은 컵)" },
  ]);
  const [bed, setBed] = useState("23:30");
  const [halfLife, setHalfLife] = useState("5");

  const T = Math.min(12, Math.max(2, H.toNum(halfLife, 5)));
  const intakes: H.CaffeineIntake[] = rows
    .filter((r) => H.toNum(r.mg) > 0 && /^\d{2}:\d{2}$/.test(r.hhmm))
    .map((r) => ({ id: r.id, hhmm: r.hhmm, mg: H.toNum(r.mg) }));

  const totalMg = intakes.reduce((s, i) => s + i.mg, 0);

  const startMin = intakes.length > 0 ? Math.min(...intakes.map((i) => H.hhmmToMin(i.hhmm))) : 9 * 60;
  let bedMin = H.hhmmToMin(bed);
  while (bedMin < startMin) bedMin += 1440;

  const spanH = Math.max(12, Math.ceil((bedMin - startMin) / 60) + 6);
  const curve = useMemo(
    () => H.caffeineCurve(intakes, T, startMin, spanH, 15),
    [intakes, T, startMin, spanH],
  );
  const atBed = useMemo(() => H.caffeineAt(intakes, T, bedMin), [intakes, T, bedMin]);
  const at24 = useMemo(() => H.caffeineAt(intakes, T, startMin + 24 * 60), [intakes, T, startMin]);

  // 마지막 섭취분이 50mg 아래로 내려가는 시각
  const lastIntake = intakes.length
    ? intakes.reduce((a, b) => (H.hhmmToMin(a.hhmm) > H.hhmmToMin(b.hhmm) ? a : b))
    : null;
  const clearAt = useMemo(() => {
    if (totalMg <= H.CAFFEINE_BEDTIME_REF) return null;
    for (const p of curve) if (p.mg <= H.CAFFEINE_BEDTIME_REF) return p.t;
    return null;
  }, [curve, totalMg]);

  const xTicks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    const first = Math.ceil(startMin / 180) * 180;
    for (let t = first; t <= startMin + spanH * 60; t += 180) out.push({ x: t, label: H.minToHhmm(t) });
    return out;
  }, [startMin, spanH]);

  const warns: H.Warn[] = [];
  if (totalMg > H.CAFFEINE_DAILY_LIMIT)
    warns.push({
      level: "warn",
      text: `입력하신 총량 ${H.fmt(totalMg, 0)}mg은 성인 1일 최대 섭취 권고량 400mg을 넘습니다. 카페인 감수성은 사람마다 크게 다르고 심계항진·불안·불면으로 이어질 수 있으니, 평소 이 정도를 마시고 있다면 의료 전문가와 상담해 보세요.`,
    });
  if (T > 8)
    warns.push({
      level: "info",
      text: "반감기를 8시간 넘게 설정하셨습니다. 임신·경구피임약 복용·간질환 등에서 반감기가 길어진다고 알려져 있지만, 개인 값은 검사로만 알 수 있습니다.",
    });

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-5">
      <MedicalDisclaimer />

      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-800">오늘 마신 것</h3>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label htmlFor={`caf-t-${r.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                    마신 시각
                  </label>
                  <TextInput id={`caf-t-${r.id}`} type="time" value={r.hhmm} onChange={(v) => update(r.id, { hhmm: v })} ariaLabel="마신 시각" />
                </div>
                <div>
                  <label htmlFor={`caf-m-${r.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                    카페인
                  </label>
                  <NumberInput
                    id={`caf-m-${r.id}`}
                    value={r.mg}
                    onChange={(v) => update(r.id, { mg: v, label: "직접 입력" })}
                    min={0}
                    max={2000}
                    step={5}
                    suffix="mg"
                    ariaLabel="카페인 양"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label="이 섭취 기록 삭제"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 sm:w-auto"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">{r.label}</span>
                <select
                  aria-label="음료 선택"
                  value=""
                  onChange={(e) => {
                    const d = H.DRINKS.find((x) => x.name === e.target.value);
                    if (d) update(r.id, { mg: String(d.mg), label: `${d.name} ${d.serving}` });
                  }}
                  className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">음료로 고르기…</option>
                  {H.DRINKS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} · {d.mg}mg
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { id: newId(), hhmm: "17:00", mg: "75", label: "직접 입력" }])}
          aria-label="섭취 기록 추가"
          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + 한 잔 더 추가
        </button>
      </section>

      <Grid>
        <Field label="취침 예정 시각" htmlFor="caf-bed">
          <TextInput id="caf-bed" type="time" value={bed} onChange={setBed} ariaLabel="취침 시각" />
        </Field>
        <Field
          label="카페인 반감기"
          htmlFor="caf-hl"
          hint="건강한 성인 평균은 약 5시간(문헌 범위 3~7시간)입니다. 임신·간질환·일부 약물 복용 시 길어집니다."
        >
          <NumberInput id="caf-hl" value={halfLife} onChange={setHalfLife} min={2} max={12} step={0.5} suffix="시간" ariaLabel="반감기" />
        </Field>
      </Grid>

      {intakes.length > 0 ? (
        <>
          <ResultCard>
            <BigStat
              caption={`취침 시각(${bed}) 잔존 카페인`}
              value={H.fmt(atBed, 0)}
              unit="mg"
              sub={
                atBed >= H.CAFFEINE_BEDTIME_REF
                  ? "커피 반 잔 이상이 몸에 남은 상태로 잠자리에 듭니다"
                  : "잔존량이 커피 반 잔 아래로 내려간 상태입니다"
              }
            />
            <div className="mt-4">
              <StatRow
                items={[
                  { label: "오늘 총 섭취량", value: `${H.fmt(totalMg, 0)} mg`, sub: `권고 상한 ${H.CAFFEINE_DAILY_LIMIT}mg` },
                  {
                    label: "50mg 아래로",
                    value: clearAt ? H.minToHhmm(clearAt) : "이미 아래",
                    sub: "커피 반 잔 수준",
                  },
                  { label: "24시간 뒤", value: `${H.fmt(at24, 0)} mg`, sub: `반감기 ${T}시간 기준` },
                ]}
              />
            </div>
          </ResultCard>

          <Warnings items={warns} />

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">시간별 잔존량</h3>
            <LineChart
              points={curve.map((p) => ({ x: p.t, y: p.mg }))}
              xTicks={xTicks}
              yUnit="mg"
              ariaLabel={`시간별 카페인 잔존량 그래프. 취침 시각 ${bed}에 약 ${H.fmt(atBed, 0)}밀리그램이 남습니다.`}
              markers={[{ x: bedMin, label: `취침 ${bed}`, color: "#4f46e5" }]}
              thresholds={[{ y: H.CAFFEINE_BEDTIME_REF, label: "50mg", color: "#f43f5e" }]}
            />
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              보라색 세로선이 취침 시각, 붉은 점선이 커피 반 잔에 해당하는 50mg입니다. 취침 시점에
              선이 점선 위에 있으면 잠들 무렵까지 카페인이 상당량 남아 있다는 뜻입니다.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">반감기별 비교</h3>
            <TableWrap>
              <table className="w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>반감기</Th>
                    <Th right>취침 시 잔존</Th>
                    <Th right>총량 대비</Th>
                  </tr>
                </thead>
                <tbody>
                  {[3, 4, 5, 6, 7].map((hl) => {
                    const v = H.caffeineAt(intakes, hl, bedMin);
                    return (
                      <tr key={hl}>
                        <Td strong>{hl}시간</Td>
                        <Td right>{H.fmt(v, 0)} mg</Td>
                        <Td right>{H.fmt((v / (totalMg || 1)) * 100, 0)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              같은 커피를 마셔도 반감기가 3시간인 사람과 7시간인 사람의 취침 시 잔존량은 몇 배까지
              차이가 납니다. 카페인 대사 속도는 주로 간의 CYP1A2 효소 활성에 좌우되며 유전적 차이가
              큽니다.
            </p>
          </section>

          <FormulaBox
            formula={[
              "C(t) = C₀ × (1/2)^(t / T½)",
              "  C₀ : 마신 카페인 양(mg)",
              "  t  : 마신 뒤 지난 시간(h)",
              "  T½ : 반감기(h)",
              "여러 번 마셨다면 각각 계산해 더한다 (선형 중첩)",
              "목표치까지 걸리는 시간 = T½ × log₂(C₀ ÷ 목표치)",
            ]}
            steps={[
              ...intakes.map((i) => {
                const dh = (bedMin - H.hhmmToMin(i.hhmm)) / 60;
                return {
                  label: `${i.hhmm}에 마신 ${H.fmt(i.mg, 0)}mg → 취침(${bed})까지 ${H.fmt(dh, 1)}시간`,
                  expr: `${H.fmt(i.mg, 0)} × 0.5^(${H.fmt(dh, 1)} ÷ ${T})`,
                  value: `${H.fmt(H.caffeineRemaining(i.mg, dh, T), 1)} mg`,
                };
              }),
              {
                label: "취침 시 잔존량 합계",
                expr: intakes
                  .map((i) => H.fmt(H.caffeineRemaining(i.mg, (bedMin - H.hhmmToMin(i.hhmm)) / 60, T), 1))
                  .join(" + "),
                value: `${H.fmt(atBed, 1)} mg`,
              },
              ...(lastIntake && lastIntake.mg > H.CAFFEINE_BEDTIME_REF
                ? [
                    {
                      label: `마지막 잔(${lastIntake.hhmm}, ${H.fmt(lastIntake.mg, 0)}mg)이 50mg까지 줄어드는 시간`,
                      expr: `${T} × log₂(${H.fmt(lastIntake.mg, 0)} ÷ 50)`,
                      value: `${H.fmt(H.hoursToReach(lastIntake.mg, H.CAFFEINE_BEDTIME_REF, T), 1)} 시간`,
                    },
                  ]
                : []),
            ]}
            note="카페인은 1차 소실(first-order elimination)을 따르는 대표적인 약물이라, 남은 양이 일정 시간마다 절반으로 줄어드는 지수함수 모형이 잘 맞습니다. 흡수 시간(경구 섭취 후 약 30~45분 뒤 최고 혈중농도)은 이 계산기에서 생략했으므로 마신 직후를 100%로 봅니다."
            limits={[
              "반감기는 개인차가 매우 큽니다. 흡연은 카페인 대사를 빠르게 하고, 임신·경구피임약·일부 항생제는 느리게 만듭니다.",
              "이 모형은 흡수 과정을 무시하고 '마신 즉시 전량이 몸 안에 있다'고 가정합니다. 섭취 직후 1시간 이내의 값은 실제보다 높게 나옵니다.",
              "잔존량 몇 mg부터 잠에 방해가 되는지에 대한 공인된 절단점은 없습니다. 이 도구가 표시하는 50mg 선은 '커피 반 잔'을 가늠하기 위한 참고선입니다.",
              "음료의 카페인 함량은 제품·매장·추출 방식에 따라 두 배 이상 차이 날 수 있습니다. 정확한 값은 제품 표기를 확인하세요.",
            ]}
            sources={[
              {
                label: "EFSA, Scientific Opinion on the safety of caffeine, EFSA Journal 2015 — doi:10.2903/j.efsa.2015.4102",
                url: "https://doi.org/10.2903/j.efsa.2015.4102",
              },
              {
                label: "Drake C 외, Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed, J Clin Sleep Med 2013 — doi:10.5664/jcsm.3170",
                url: "https://doi.org/10.5664/jcsm.3170",
              },
              { label: "식품의약품안전처 식품안전나라 — 카페인 함량 정보", url: "https://www.foodsafetykorea.go.kr/" },
            ]}
          />

          <section>
            <h3 className="mb-1 text-sm font-bold text-slate-800">음료별 카페인 대표값</h3>
            <p className="mb-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
              제품·매장별 편차 큼 — 표기 확인 필요
            </p>
            <TableWrap>
              <table className="w-full min-w-[320px] border-collapse">
                <thead>
                  <tr>
                    <Th>음료·식품</Th>
                    <Th>1회 제공량</Th>
                    <Th right>카페인</Th>
                  </tr>
                </thead>
                <tbody>
                  {H.DRINKS.map((d) => (
                    <tr key={d.name}>
                      <Td>{d.name}</Td>
                      <Td>{d.serving}</Td>
                      <Td right strong>
                        {d.mg}mg
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              식약처와 EFSA 모두 건강한 성인의 1일 최대 섭취 권고량을 400mg으로 제시합니다. 임신부는
              300mg, 어린이·청소년은 체중 1kg당 2.5mg이 흔히 인용되는 기준입니다.
            </p>
          </section>

          <Tracker kind="caffeine" />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          마신 시각과 카페인 양을 한 줄 이상 입력하면 그래프가 나옵니다.
        </p>
      )}
    </div>
  );
}
