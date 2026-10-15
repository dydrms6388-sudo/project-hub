"use client";

import { useEffect, useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, Panel, ToolLoading } from "@/components/ui";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { buildLadder, traceLadder } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { n: string[]; p: string[] };

const MAX = 20;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = sanitizeStrings(o.n, MAX);
  const p = sanitizeStrings(o.p, MAX);
  if (!n || !p) return null;
  if (n.length < 2 || n.length > MAX) return null;
  if (p.length !== n.length) return null;
  return { n, p };
}

const MX = 26;
const CG = 46;
const RG = 20;
const TOP = 40;

const COLORS = [
  "#7c3aed", "#e11d48", "#0891b2", "#16a34a", "#ea580c",
  "#2563eb", "#db2777", "#65a30d", "#9333ea", "#0d9488",
];

export default function Ladder() {
  const s = useSeedState<D>(validate);
  const [namesText, setNamesText] = useState("가영\n나윤\n다온\n라온");
  const [prizeText, setPrizeText] = useState("당첨\n꽝\n꽝\n꽝");
  const [active, setActive] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [animKey, setAnimKey] = useState(0);
  const [err, setErr] = useState("");

  const d = s.data;
  const cols = d ? d.n.length : 0;
  const ladder = useMemo(() => (d ? buildLadder(s.seed, cols) : null), [d, s.seed, cols]);

  // 공유 링크로 들어온 경우엔 결과를 바로 볼 수 있어야 한다
  useEffect(() => {
    if (s.replay && d) setRevealed(new Set(d.n.map((_, i) => i)));
  }, [s.replay, d]);

  const results = useMemo(() => {
    if (!d || !ladder) return [];
    return d.n.map((_, i) => traceLadder(ladder.rungs, i).end);
  }, [d, ladder]);

  function start() {
    setErr("");
    const names = parseNames(namesText, MAX);
    if (names.length < 2) {
      setErr("참가자를 2명 이상 입력해 주세요.");
      return;
    }
    if (names.length > MAX) {
      setErr(`참가자는 최대 ${MAX}명까지 가능합니다.`);
      return;
    }
    let prizes = parseNames(prizeText, MAX);
    if (prizes.length === 0) prizes = ["당첨"];
    // 결과 항목 수를 참가자 수에 맞춘다 (모자라면 '꽝' 으로 채우고, 넘치면 자른다)
    while (prizes.length < names.length) prizes.push("꽝");
    prizes = prizes.slice(0, names.length);
    setRevealed(new Set());
    setActive(null);
    s.run({ n: names, p: prizes });
  }

  function reveal(i: number) {
    setActive(i);
    setAnimKey((k) => k + 1);
    setRevealed((prev) => new Set(prev).add(i));
  }

  function revealAll() {
    if (!d) return;
    setActive(null);
    setRevealed(new Set(d.n.map((_, i) => i)));
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="참가자 (줄바꿈 또는 쉼표로 구분, 2~20명)" htmlFor="ld-names">
            <textarea
              id="ld-names"
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
              placeholder={"가영\n나윤\n다온"}
            />
          </Field>
          <Field
            label="결과 항목"
            htmlFor="ld-prizes"
            hint="참가자 수보다 적으면 나머지는 자동으로 '꽝'이 됩니다."
          >
            <textarea
              id="ld-prizes"
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
              placeholder={"당첨\n꽝\n꽝"}
            />
          </Field>
          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="사다리 만들기">
            사다리 만들기
          </Btn>
          <Notice>
            입력한 이름은 서버로 전송되지 않습니다. 결과 링크를 만들면 이름이 압축되어 주소의 <code>#</code> 뒤에만
            들어가며, 이 부분은 브라우저 밖으로 나가지 않습니다.
          </Notice>
        </Panel>
      </div>
    );
  }

  const W = MX * 2 + (cols - 1) * CG;
  const H = TOP + (ladder?.rows ?? 0) * RG + 44;
  const x = (c: number) => MX + c * CG;
  const y = (r: number) => TOP + r * RG;

  const activePath = (() => {
    if (active == null || !ladder) return "";
    const { steps } = traceLadder(ladder.rungs, active);
    let c = active;
    const pts: [number, number][] = [[x(c), TOP - 16]];
    for (const st of steps) {
      pts.push([x(st.from), y(st.row)]);
      pts.push([x(st.to), y(st.row)]);
      c = st.to;
    }
    pts.push([x(c), y(ladder.rows - 1) + 24]);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
  })();

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}

      <Panel className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Btn variant="soft" onClick={revealAll} ariaLabel="전체 결과 공개">
            전체 결과 공개
          </Btn>
          <span className="self-center text-xs text-slate-500">
            이름을 누르면 그 사람의 경로만 따라갑니다.
          </span>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`참가자 ${cols}명의 사다리`}
            className="block"
          >
            {/* 세로줄 */}
            {d.n.map((_, i) => (
              <line
                key={`v${i}`}
                x1={x(i)}
                y1={TOP - 16}
                x2={x(i)}
                y2={y((ladder?.rows ?? 1) - 1) + 24}
                stroke="#cbd5e1"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
            {/* 가로줄 */}
            {ladder?.rungs.map((row, r) =>
              row.map((on, i) =>
                on ? (
                  <line
                    key={`h${r}-${i}`}
                    x1={x(i)}
                    y1={y(r)}
                    x2={x(i + 1)}
                    y2={y(r)}
                    stroke="#cbd5e1"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ) : null,
              ),
            )}
            {/* 선택한 참가자의 경로 */}
            {activePath ? (
              <path
                key={animKey}
                className="pf-trace"
                d={activePath}
                fill="none"
                stroke={COLORS[(active ?? 0) % COLORS.length]}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
              />
            ) : null}
            {/* 이름 / 결과 라벨 */}
            {d.n.map((nm, i) => (
              <text
                key={`n${i}`}
                x={x(i)}
                y={TOP - 24}
                textAnchor="middle"
                fontSize={12}
                fill={active === i ? COLORS[i % COLORS.length] : "#334155"}
                fontWeight={active === i ? 700 : 500}
              >
                {nm.length > 4 ? `${nm.slice(0, 4)}…` : nm}
              </text>
            ))}
            {d.p.map((pz, i) => (
              <text
                key={`p${i}`}
                x={x(i)}
                y={y((ladder?.rows ?? 1) - 1) + 40}
                textAnchor="middle"
                fontSize={12}
                fill="#0f172a"
                fontWeight={600}
              >
                {pz.length > 4 ? `${pz.slice(0, 4)}…` : pz}
              </text>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {d.n.map((nm, i) => (
            <button
              key={`btn${i}`}
              type="button"
              onClick={() => reveal(i)}
              aria-label={`${nm} 결과 확인`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active === i
                  ? "border-violet-500 bg-violet-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {nm}
            </button>
          ))}
        </div>

        {revealed.size > 0 ? (
          <ul className="pf-pop divide-y divide-slate-100 rounded-lg border border-slate-200">
            {d.n.map((nm, i) =>
              revealed.has(i) ? (
                <li key={`r${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{nm}</span>
                  <span className="font-bold text-violet-700">{d.p[results[i]]}</span>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </Panel>

      <SeedBar
        s={s}
        shareTitle="사다리타기 결과"
        shareText="같은 링크를 열면 누구나 같은 사다리 결과가 나옵니다."
        onRerun={() => {
          setRevealed(new Set());
          setActive(null);
          s.rerun();
        }}
      />
    </div>
  );
}
