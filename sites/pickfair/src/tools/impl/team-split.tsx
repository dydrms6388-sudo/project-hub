"use client";

import { useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { rngFromSeed, shuffle } from "@/lib/rng";
import { useSeedState } from "@/lib/seedstate";

type D = { n: string[]; k: number; sz: number[] | null; fb: [string, string][] };

const MAXN = 100;
const MAXK = 20;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = sanitizeStrings(o.n, MAXN);
  if (!n || n.length < 2) return null;
  const k = Number(o.k);
  if (!Number.isInteger(k) || k < 2 || k > MAXK || k > n.length) return null;
  let sz: number[] | null = null;
  if (Array.isArray(o.sz) && o.sz.length === k) {
    const arr = o.sz.map((v) => Number(v));
    if (arr.every((v) => Number.isInteger(v) && v >= 0 && v <= MAXN)) sz = arr;
  }
  const fb: [string, string][] = [];
  if (Array.isArray(o.fb)) {
    for (const p of o.fb.slice(0, 50)) {
      if (Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string") {
        fb.push([p[0].slice(0, 24), p[1].slice(0, 24)]);
      }
    }
  }
  return { n, k, sz, fb };
}

/** 팀 정원 계산 — 지정값이 없으면 균등 분배(나머지는 seed 로 정한 팀에) */
function capacities(d: D, seed: string): number[] {
  if (d.sz) {
    const total = d.sz.reduce((a, b) => a + b, 0);
    if (total >= d.n.length) return d.sz.slice();
  }
  const base = Math.floor(d.n.length / d.k);
  const rest = d.n.length - base * d.k;
  const caps = new Array(d.k).fill(base);
  const order = shuffle(
    Array.from({ length: d.k }, (_, i) => i),
    rngFromSeed(seed, "team-caps"),
  );
  for (let i = 0; i < rest; i++) caps[order[i]] += 1;
  return caps;
}

type Assign = { teams: string[][]; constrained: boolean; tries: number };

function assign(d: D, seed: string): Assign {
  const caps = capacities(d, seed);
  const rnd = rngFromSeed(seed, "team-split");
  const forbid = new Map<string, Set<string>>();
  for (const [a, b] of d.fb) {
    if (a === b) continue;
    if (!forbid.has(a)) forbid.set(a, new Set());
    if (!forbid.has(b)) forbid.set(b, new Set());
    forbid.get(a)!.add(b);
    forbid.get(b)!.add(a);
  }

  const MAX_TRY = 400;
  for (let t = 0; t < MAX_TRY; t++) {
    const order = shuffle(d.n, rnd);
    const teams: string[][] = Array.from({ length: d.k }, () => []);
    let ok = true;
    for (const person of order) {
      const enemies = forbid.get(person);
      // 남은 자리가 가장 많은 팀부터 채워 균형을 유지한다
      const cand = teams
        .map((tm, i) => ({ i, room: caps[i] - tm.length, tm }))
        .filter((c) => c.room > 0 && (!enemies || !c.tm.some((m) => enemies.has(m))))
        .sort((a, b) => b.room - a.room);
      if (cand.length === 0) {
        ok = false;
        break;
      }
      const best = cand.filter((c) => c.room === cand[0].room);
      teams[best[Math.floor(rnd() * best.length)].i].push(person);
    }
    if (ok) return { teams, constrained: true, tries: t + 1 };
  }

  // 제약을 만족하는 배정을 못 찾음 → 제약 없이 배정하고 사실대로 알린다
  const order = shuffle(d.n, rngFromSeed(seed, "team-fallback"));
  const teams: string[][] = Array.from({ length: d.k }, () => []);
  let idx = 0;
  for (let i = 0; i < d.k; i++) {
    for (let j = 0; j < caps[i] && idx < order.length; j++) teams[i].push(order[idx++]);
  }
  while (idx < order.length) teams[idx % d.k].push(order[idx++]);
  return { teams, constrained: false, tries: MAX_TRY };
}

export default function TeamSplit() {
  const s = useSeedState<D>(validate);
  const [namesText, setNamesText] = useState("가영\n나윤\n다온\n라온\n민서\n서준\n하준\n지우");
  const [k, setK] = useState(2);
  const [mode, setMode] = useState<"even" | "custom">("even");
  const [sizes, setSizes] = useState<number[]>([4, 4]);
  const [fb, setFb] = useState<[string, string][]>([]);
  const [pa, setPa] = useState("");
  const [pb, setPb] = useState("");
  const [err, setErr] = useState("");

  const names = useMemo(() => parseNames(namesText, MAXN), [namesText]);
  const d = s.data;
  const result = useMemo(() => (d ? assign(d, s.seed) : null), [d, s.seed]);

  function setTeamCount(v: number) {
    const nk = Math.max(2, Math.min(MAXK, v));
    setK(nk);
    setSizes((prev) => {
      const next = prev.slice(0, nk);
      while (next.length < nk) next.push(1);
      return next;
    });
  }

  function start() {
    setErr("");
    if (names.length < 2) {
      setErr("참가자를 2명 이상 입력해 주세요.");
      return;
    }
    if (k > names.length) {
      setErr("팀 수가 인원보다 많습니다.");
      return;
    }
    let sz: number[] | null = null;
    if (mode === "custom") {
      const total = sizes.slice(0, k).reduce((a, b) => a + b, 0);
      if (total !== names.length) {
        setErr(`팀별 인원 합계(${total}명)가 참가자 수(${names.length}명)와 다릅니다.`);
        return;
      }
      sz = sizes.slice(0, k);
    }
    const valid = fb.filter(([a, b]) => names.includes(a) && names.includes(b) && a !== b);
    s.run({ n: names, k, sz, fb: valid });
  }

  if (!s.ready) return <ToolLoading />;

  if (!d || !result) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="참가자 (줄바꿈 또는 쉼표로 구분)" htmlFor="ts-names">
            <textarea
              id="ts-names"
              rows={6}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </Field>
          <p className="text-xs text-slate-500">현재 {names.length}명</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="팀 수" htmlFor="ts-k">
              <NumberInput id="ts-k" value={k} min={2} max={MAXK} onChange={setTeamCount} />
            </Field>
            <Field label="인원 배분">
              <div className="flex gap-2">
                <Btn variant={mode === "even" ? "primary" : "ghost"} onClick={() => setMode("even")} ariaLabel="균등 배분">
                  균등
                </Btn>
                <Btn
                  variant={mode === "custom" ? "primary" : "ghost"}
                  onClick={() => setMode("custom")}
                  ariaLabel="팀별 인원 지정"
                >
                  직접 지정
                </Btn>
              </div>
            </Field>
          </div>

          {mode === "custom" ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: k }, (_, i) => (
                <label key={i} className="text-xs text-slate-600">
                  {i + 1}팀
                  <NumberInput
                    value={sizes[i] ?? 1}
                    min={0}
                    max={MAXN}
                    ariaLabel={`${i + 1}팀 인원`}
                    onChange={(v) => setSizes((p) => p.map((x, j) => (j === i ? v : x)))}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <Field label="같은 팀 금지 (선택)" hint="사이가 안 좋거나, 실력이 몰리면 안 되는 두 사람을 지정합니다.">
            <div className="flex flex-wrap gap-2">
              <select
                value={pa}
                onChange={(e) => setPa(e.target.value)}
                aria-label="금지 대상 1"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">선택</option>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                value={pb}
                onChange={(e) => setPb(e.target.value)}
                aria-label="금지 대상 2"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">선택</option>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <Btn
                variant="ghost"
                ariaLabel="같은 팀 금지 규칙 추가"
                onClick={() => {
                  if (!pa || !pb || pa === pb) return;
                  setFb((p) => (p.some(([a, b]) => (a === pa && b === pb) || (a === pb && b === pa)) ? p : [...p, [pa, pb]]));
                  setPa("");
                  setPb("");
                }}
              >
                추가
              </Btn>
            </div>
          </Field>

          {fb.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {fb.map(([a, b], i) => (
                <li key={`${a}-${b}`}>
                  <button
                    type="button"
                    aria-label={`${a}와 ${b} 금지 규칙 삭제`}
                    onClick={() => setFb((p) => p.filter((_, j) => j !== i))}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-700"
                  >
                    {a} ✕ {b} ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="팀 나누기 실행">
            팀 나누기
          </Btn>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {result.teams.map((tm, i) => (
            <div key={i} className="pf-pop rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-bold text-violet-700">
                {i + 1}팀 <span className="font-normal text-slate-400">({tm.length}명)</span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {tm.map((m) => (
                  <li key={m} className="rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-800">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {d.fb.length > 0 ? (
          result.constrained ? (
            <Notice>같은 팀 금지 규칙 {d.fb.length}개를 모두 지켰습니다. (시도 {result.tries}회)</Notice>
          ) : (
            <Notice tone="warn">
              지정한 금지 규칙을 모두 만족하는 배정을 찾지 못해, 제약을 빼고 배정했습니다. 팀 수나 인원 배분을
              바꾸면 대부분 해결됩니다.
            </Notice>
          )
        ) : null}
      </Panel>

      <SeedBar s={s} shareTitle="팀 나누기 결과" shareText="같은 링크를 열면 같은 팀 배정이 나옵니다." />
    </div>
  );
}
