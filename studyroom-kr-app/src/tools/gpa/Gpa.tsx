"use client";

import { useMemo, useState } from "react";
import { newId, useLocalStorage } from "@/lib/storage";

type Scale = "4.5" | "4.3" | "4.0";
type Course = { id: string; name: string; credits: number; grade: string; major: boolean };
type Semester = { id: string; name: string; courses: Course[] };
type State = { scale: Scale; semesters: Semester[] };

/** 스케일별 성적 → 평점. P/NP 는 평점 계산에서 빠지므로 여기 없다. */
const TABLES: Record<Scale, Record<string, number>> = {
  "4.5": { "A+": 4.5, A0: 4.0, "B+": 3.5, B0: 3.0, "C+": 2.5, C0: 2.0, "D+": 1.5, D0: 1.0, F: 0 },
  "4.3": {
    "A+": 4.3, A0: 4.0, "A-": 3.7, "B+": 3.3, B0: 3.0, "B-": 2.7,
    "C+": 2.3, C0: 2.0, "C-": 1.7, "D+": 1.3, D0: 1.0, "D-": 0.7, F: 0,
  },
  "4.0": {
    "A+": 4.0, A0: 4.0, "A-": 3.7, "B+": 3.3, B0: 3.0, "B-": 2.7,
    "C+": 2.3, C0: 2.0, "C-": 1.7, "D+": 1.3, D0: 1.0, "D-": 0.7, F: 0,
  },
};
const PASS = ["P", "NP"] as const;
/** 스케일을 바꿔 사라진 성적은 가장 가까운 위 등급으로 옮긴다. */
const FALLBACK: Record<string, string> = { "A-": "A0", "B-": "B0", "C-": "C0", "D-": "D0" };

const CREDITS = [1, 2, 3, 4, 5, 6];
const MAX = (s: Scale) => Number(s);

const newCourse = (): Course => ({ id: newId(), name: "", credits: 3, grade: "A+", major: false });
const newSemester = (n: number): Semester => ({
  id: newId(),
  name: `${Math.floor((n - 1) / 2) + 1}학년 ${((n - 1) % 2) + 1}학기`,
  courses: [newCourse(), newCourse(), newCourse()],
});

const EMPTY: State = { scale: "4.5", semesters: [newSemester(1)] };

const gradesFor = (scale: Scale) => [...Object.keys(TABLES[scale]), ...PASS];

/** 학점 수로 가중한 평균. 대상이 없으면 null. */
function average(courses: Course[], scale: Scale) {
  const table = TABLES[scale];
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    const p = table[c.grade];
    if (p === undefined) continue; // P/NP
    points += p * c.credits;
    credits += c.credits;
  }
  return credits > 0 ? { gpa: points / credits, points, credits } : null;
}

const fmt = (n: number) => n.toFixed(2);

export default function Gpa() {
  const [state, setState] = useLocalStorage<State>("studyroom:gpa", EMPTY);
  const [target, setTarget] = useState("");
  const [nextCredits, setNextCredits] = useState("18");

  const all = useMemo(() => state.semesters.flatMap((s) => s.courses), [state.semesters]);
  const total = average(all, state.scale);
  const major = average(all.filter((c) => c.major), state.scale);

  const setScale = (scale: Scale) =>
    setState((s) => ({
      scale,
      semesters: s.semesters.map((sem) => ({
        ...sem,
        courses: sem.courses.map((c) => {
          if ((PASS as readonly string[]).includes(c.grade)) return c;
          let g = c.grade;
          while (TABLES[scale][g] === undefined && FALLBACK[g]) g = FALLBACK[g];
          return { ...c, grade: TABLES[scale][g] === undefined ? "A+" : g };
        }),
      })),
    }));

  const patchCourse = (semId: string, id: string, patch: Partial<Course>) =>
    setState((s) => ({
      ...s,
      semesters: s.semesters.map((sem) =>
        sem.id === semId
          ? { ...sem, courses: sem.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
          : sem
      ),
    }));

  const addCourse = (semId: string) =>
    setState((s) => ({
      ...s,
      semesters: s.semesters.map((sem) =>
        sem.id === semId ? { ...sem, courses: [...sem.courses, newCourse()] } : sem
      ),
    }));

  const removeCourse = (semId: string, id: string) =>
    setState((s) => ({
      ...s,
      semesters: s.semesters.map((sem) =>
        sem.id === semId ? { ...sem, courses: sem.courses.filter((c) => c.id !== id) } : sem
      ),
    }));

  const addSemester = () =>
    setState((s) => ({ ...s, semesters: [...s.semesters, newSemester(s.semesters.length + 1)] }));

  const removeSemester = (id: string) =>
    setState((s) => ({
      ...s,
      semesters: s.semesters.length > 1 ? s.semesters.filter((sem) => sem.id !== id) : s.semesters,
    }));

  const renameSemester = (id: string, name: string) =>
    setState((s) => ({
      ...s,
      semesters: s.semesters.map((sem) => (sem.id === id ? { ...sem, name } : sem)),
    }));

  // 목표 평점 역산
  const goal = useMemo(() => {
    const t = Number(target);
    const nc = Number(nextCredits);
    if (!target || !Number.isFinite(t) || t <= 0) return null;
    if (!Number.isFinite(nc) || nc <= 0) return { kind: "input" as const };
    const max = MAX(state.scale);
    if (t > max) return { kind: "overMax" as const, max };
    const cur = total ?? { points: 0, credits: 0, gpa: 0 };
    const need = (t * (cur.credits + nc) - cur.points) / nc;
    if (need <= 0) return { kind: "already" as const };
    if (need > max) return { kind: "impossible" as const, need, max };
    return { kind: "ok" as const, need };
  }, [target, nextCredits, total, state.scale]);

  const grades = gradesFor(state.scale);

  return (
    <div className="space-y-5">
      {/* 스케일 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">만점 기준</span>
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="만점 기준">
          {(["4.5", "4.3", "4.0"] as Scale[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              aria-pressed={state.scale === s}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                state.scale === s ? "bg-ink text-white" : "text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 학기 */}
      <div className="space-y-4">
        {state.semesters.map((sem) => {
          const avg = average(sem.courses, state.scale);
          return (
            <div key={sem.id} className="rounded-xl border border-line">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <input
                  value={sem.name}
                  onChange={(e) => renameSemester(sem.id, e.target.value)}
                  aria-label="학기 이름"
                  maxLength={20}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-medium text-ink outline-none hover:border-line focus:border-ink"
                />
                <span className="flex-shrink-0 text-sm text-muted">
                  {avg ? `${fmt(avg.gpa)} · ${avg.credits}학점` : "—"}
                </span>
                {state.semesters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSemester(sem.id)}
                    aria-label={`${sem.name} 삭제`}
                    className="flex-shrink-0 rounded px-1.5 py-1 text-sm text-muted hover:text-ink"
                  >
                    삭제
                  </button>
                )}
              </div>

              <ul className="divide-y divide-line">
                {sem.courses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <input
                      value={c.name}
                      onChange={(e) => patchCourse(sem.id, c.id, { name: e.target.value })}
                      placeholder="과목 이름 (선택)"
                      aria-label="과목 이름"
                      maxLength={30}
                      className="min-w-0 flex-[1_1_100%] rounded-lg border border-line px-2.5 py-1.5 text-[15px] outline-none focus:border-ink sm:flex-1"
                    />
                    <select
                      value={c.credits}
                      onChange={(e) => patchCourse(sem.id, c.id, { credits: Number(e.target.value) })}
                      aria-label="학점"
                      className="rounded-lg border border-line px-2 py-1.5 text-[15px] outline-none focus:border-ink"
                    >
                      {CREDITS.map((n) => (
                        <option key={n} value={n}>
                          {n}학점
                        </option>
                      ))}
                    </select>
                    <select
                      value={c.grade}
                      onChange={(e) => patchCourse(sem.id, c.id, { grade: e.target.value })}
                      aria-label="성적"
                      className="rounded-lg border border-line px-2 py-1.5 text-[15px] outline-none focus:border-ink"
                    >
                      {grades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={c.major}
                        onChange={(e) => patchCourse(sem.id, c.id, { major: e.target.checked })}
                        className="size-4"
                      />
                      전공
                    </label>
                    <button
                      type="button"
                      onClick={() => removeCourse(sem.id, c.id)}
                      aria-label="과목 삭제"
                      className="ml-auto rounded px-1.5 py-1 text-sm text-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>

              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => addCourse(sem.id)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
                >
                  + 과목 추가
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addSemester}
        className="w-full rounded-lg border border-dashed border-line py-2.5 text-sm font-medium text-muted hover:border-muted"
      >
        + 학기 추가
      </button>

      {/* 결과 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="전체 평점" value={total ? `${fmt(total.gpa)} / ${state.scale}` : "—"} sub={total ? `${total.credits}학점` : "성적을 입력하세요"} strong />
        <Stat label="전공 평점" value={major ? `${fmt(major.gpa)} / ${state.scale}` : "—"} sub={major ? `${major.credits}학점` : "전공 체크 없음"} />
        <Stat
          label="이수 학점"
          value={`${all.reduce((n, c) => n + (c.grade === "NP" ? 0 : c.credits), 0)}학점`}
          sub={`${all.length}과목`}
        />
      </div>

      {/* 목표 역산 */}
      <div className="rounded-xl bg-paper p-3">
        <h3 className="text-[15px] font-bold text-ink">목표 평점까지 필요한 다음 학기 평균</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
          <span className="text-muted">목표</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder={state.scale === "4.5" ? "4.0" : "3.8"}
            aria-label="목표 평점"
            className="w-20 rounded-lg border border-line bg-white px-2.5 py-1.5 outline-none focus:border-ink"
          />
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted">· 다음 학기</span>
            <input
              value={nextCredits}
              onChange={(e) => setNextCredits(e.target.value)}
              inputMode="numeric"
              aria-label="다음 학기 신청 학점"
              className="w-16 rounded-lg border border-line bg-white px-2.5 py-1.5 outline-none focus:border-ink"
            />
            <span className="text-muted">학점</span>
          </span>
        </div>
        <p className="mt-2 text-[15px] text-ink">
          {!goal && "목표 평점을 입력하면 계산합니다."}
          {goal?.kind === "input" && "다음 학기 신청 학점을 1 이상으로 넣으세요."}
          {goal?.kind === "overMax" && `목표가 만점(${goal.max})을 넘습니다.`}
          {goal?.kind === "already" && "이미 목표를 넘었습니다. 지금 평점을 유지하면 됩니다."}
          {goal?.kind === "impossible" &&
            `한 학기로는 어렵습니다. 전 과목 만점(${goal.max})을 받아도 목표에 못 미칩니다.`}
          {goal?.kind === "ok" && (
            <>
              다음 학기 평균 <strong className="text-lg font-bold">{fmt(goal.need)}</strong> 이상이면 목표에 닿습니다.
            </>
          )}
        </p>
      </div>

      <p className="text-xs text-muted">
        학교마다 환산 기준과 재수강 반영 방식이 다릅니다. 최종 확인은 학사 규정으로 하세요. 입력한 성적은 이 브라우저에만 저장됩니다.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-ink" : "border-line"}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-0.5 font-bold text-ink ${strong ? "text-2xl" : "text-xl"}`}>{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
