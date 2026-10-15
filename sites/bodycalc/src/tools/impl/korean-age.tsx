"use client";

import { useMemo, useState } from "react";
import FormulaBox from "@/components/calc/FormulaBox";
import { Field, Grid, ResultCard, StatRow, TableWrap, Td, Th, TextInput } from "@/components/calc/Ui";
import * as H from "@/lib/health";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function KoreanAge() {
  const [birth, setBirth] = useState("1995-06-15");
  const [ref, setRef] = useState(todayIso());

  const b = H.parseYmd(birth);
  const r = H.parseYmd(ref);
  const ok = !!b && !!r && H.daysBetween(b, r) >= 0;

  const man = ok ? H.ageMan(b!, r!) : NaN;
  const yearAge = ok ? H.ageYear(b!, r!) : NaN;
  const korean = ok ? H.ageKorean(b!, r!) : NaN;
  const lived = ok ? H.daysBetween(b!, r!) : NaN;
  const nextBd = useMemo(() => (ok ? H.daysToNextBirthday(b!, r!) : null), [ok, b, r]);
  const birthdayPassed = ok && man === yearAge;

  return (
    <div className="space-y-5">
      <Grid>
        <Field label="생년월일" htmlFor="age-b">
          <TextInput id="age-b" type="date" value={birth} onChange={setBirth} ariaLabel="생년월일" />
        </Field>
        <Field label="기준일" htmlFor="age-r" hint="오늘이 아닌 특정 날짜 기준으로도 계산할 수 있습니다.">
          <TextInput id="age-r" type="date" value={ref} onChange={setRef} ariaLabel="기준일" />
        </Field>
      </Grid>

      {ok ? (
        <>
          <ResultCard>
            <StatRow
              items={[
                { label: "만 나이 (법적 기준)", value: `만 ${man}세`, sub: "2023년 6월 28일부터 표준" },
                { label: "연 나이", value: `${yearAge}세`, sub: "병역법·청소년보호법 등" },
                { label: "세는 나이 (옛 한국식)", value: `${korean}살`, sub: "일상에서 쓰던 방식" },
              ]}
            />
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {ref} 기준으로 태어난 지 <b>{H.fmt(lived, 0)}일</b>이 지났습니다.
              {birthdayPassed ? " 올해 생일이 이미 지났습니다." : " 올해 생일이 아직 지나지 않았습니다."}
              {nextBd
                ? nextBd.days === 0
                  ? " 오늘이 생일입니다."
                  : ` 다음 생일(${H.fmtYmd(nextBd.date)}, ${H.weekdayOf(nextBd.date)}요일)까지 ${nextBd.days}일 남았습니다.`
                : ""}
            </p>
          </ResultCard>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-bold text-slate-800">2023년 &lsquo;만 나이 통일&rsquo;이 바꾼 것</h3>
            <div className="space-y-2 text-sm leading-relaxed text-slate-600">
              <p>
                2023년 6월 28일부터 시행된 행정기본법·민법 개정으로, 법령·계약·공문서에서 나이를
                말할 때는 특별한 규정이 없는 한 <b>만 나이</b>를 뜻하게 되었습니다. 그전까지는 같은
                문서에서도 세는 나이·연 나이·만 나이가 뒤섞여 분쟁의 원인이 됐습니다.
              </p>
              <p>
                다만 &ldquo;모든 나이가 만 나이로 바뀐 것&rdquo;은 아닙니다. 병역법(병역판정검사),
                청소년보호법(주류·담배 구입), 초·중등교육법(취학 연령)처럼 법에서 따로 정한 경우에는
                여전히 <b>연 나이</b>(그 해 연도 − 출생 연도)를 씁니다. 술·담배는 &ldquo;만
                19세&rdquo;가 아니라 &ldquo;그 해에 19세가 되는 사람&rdquo;, 즉 생일과 관계없이 해당
                연도 1월 1일부터 구매가 가능합니다.
              </p>
            </div>
            <TableWrap>
              <table className="mt-3 w-full min-w-[300px] border-collapse">
                <thead>
                  <tr>
                    <Th>세는 방식</Th>
                    <Th>규칙</Th>
                    <Th right>내 나이</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td strong>만 나이</Td>
                    <Td>태어나면 0살, 생일마다 +1</Td>
                    <Td right>만 {man}세</Td>
                  </tr>
                  <tr>
                    <Td strong>연 나이</Td>
                    <Td>기준 연도 − 출생 연도</Td>
                    <Td right>{yearAge}세</Td>
                  </tr>
                  <tr>
                    <Td strong>세는 나이</Td>
                    <Td>태어나면 1살, 1월 1일마다 +1</Td>
                    <Td right>{korean}살</Td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
          </section>

          <FormulaBox
            formula={[
              "만 나이 = 기준연도 − 출생연도  (생일이 아직 안 지났으면 −1)",
              "연 나이 = 기준연도 − 출생연도",
              "세는 나이 = 기준연도 − 출생연도 + 1",
            ]}
            steps={[
              {
                label: "연도 차이",
                expr: `${r!.y} − ${b!.y}`,
                value: `${r!.y - b!.y}`,
              },
              {
                label: `생일(${String(b!.m).padStart(2, "0")}-${String(b!.d).padStart(2, "0")}) 경과 여부`,
                expr: `기준일 ${String(r!.m).padStart(2, "0")}-${String(r!.d).padStart(2, "0")} vs 생일 ${String(b!.m).padStart(2, "0")}-${String(b!.d).padStart(2, "0")}`,
                value: birthdayPassed ? "지남 (보정 없음)" : "안 지남 (−1)",
              },
              { label: "만 나이", expr: `${r!.y - b!.y} ${birthdayPassed ? "" : "− 1"}`, value: `만 ${man}세` },
              { label: "연 나이", expr: `${r!.y} − ${b!.y}`, value: `${yearAge}세` },
              { label: "세는 나이", expr: `${r!.y} − ${b!.y} + 1`, value: `${korean}살` },
              { label: "태어난 지", expr: `${H.fmtYmd(r!)} − ${H.fmtYmd(b!)}`, value: `${H.fmt(lived, 0)}일` },
            ]}
            note="윤년 2월 29일생의 다음 생일은 평년에는 3월 1일로 계산했습니다. 법령상 기간 계산에서 '2월 29일이 없는 해에는 그 달의 말일'로 보는 해석도 있어, 기관에 따라 2월 28일로 처리하기도 합니다."
            limits={[
              "이 계산기는 달력상의 날짜만 다룹니다. 출생 시각이나 시차는 반영하지 않습니다.",
              "특정 제도(보험 나이, 입학·병역 등)는 자체 기준일과 계산 규칙을 따로 두는 경우가 있어 결과가 다를 수 있습니다.",
              "보험 나이는 만 나이를 기준으로 6개월이 지나면 한 살을 더하는 방식이라 여기 표시되는 어느 값과도 다릅니다.",
            ]}
            sources={[
              { label: "국가법령정보센터 — 행정기본법 (제7조의2 행정에 관한 나이의 계산 및 표시)", url: "https://www.law.go.kr/" },
              { label: "법제처 — 만 나이 통일 안내", url: "https://www.moleg.go.kr/" },
            ]}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          생년월일이 기준일보다 앞서야 계산됩니다.
        </p>
      )}
    </div>
  );
}
