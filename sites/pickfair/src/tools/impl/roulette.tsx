"use client";

import { useEffect, useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, Panel, ToolLoading } from "@/components/ui";
import { celebrate } from "@/lib/confetti";
import { sanitizeStrings } from "@/lib/names";
import { rngFromSeed, weightedIndex } from "@/lib/rng";
import { useSeedState } from "@/lib/seedstate";

type D = { it: string[]; w: number[] };

const MAX = 20;
const SPIN_MS = 4000;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const it = sanitizeStrings(o.it, MAX);
  if (!it || it.length < 2) return null;
  const wRaw = Array.isArray(o.w) ? o.w : [];
  const w = it.map((_, i) => {
    const v = Number(wRaw[i]);
    return Number.isFinite(v) && v > 0 ? Math.min(999, v) : 1;
  });
  return { it, w };
}

const COLORS = [
  "#7c3aed", "#f59e0b", "#0891b2", "#e11d48", "#16a34a",
  "#2563eb", "#db2777", "#65a30d", "#9333ea", "#0d9488",
  "#c2410c", "#4f46e5", "#be123c", "#047857", "#a16207",
  "#7e22ce", "#0369a1", "#b91c1c", "#15803d", "#6d28d9",
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
}

function sectorPath(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export default function Roulette() {
  const s = useSeedState<D>(validate);
  const [rows, setRows] = useState<{ label: string; weight: number }[]>([
    { label: "치킨", weight: 1 },
    { label: "피자", weight: 1 },
    { label: "떡볶이", weight: 1 },
    { label: "국밥", weight: 1 },
  ]);
  const [useWeight, setUseWeight] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [err, setErr] = useState("");

  const d = s.data;

  const segs = useMemo(() => {
    if (!d) return [];
    const total = d.w.reduce((a, b) => a + b, 0) || d.it.length;
    let acc = 0;
    return d.it.map((label, i) => {
      const from = (acc / total) * 360;
      acc += d.w[i];
      const to = (acc / total) * 360;
      return { label, from, to, mid: (from + to) / 2, color: COLORS[i % COLORS.length] };
    });
  }, [d]);

  const winner = useMemo(() => {
    if (!d) return -1;
    return weightedIndex(d.w, rngFromSeed(s.seed, "roulette"));
  }, [d, s.seed]);

  const target = useMemo(() => {
    if (winner < 0 || segs.length === 0) return 0;
    return 360 * 5 - segs[winner].mid;
  }, [winner, segs]);

  useEffect(() => {
    if (!d) return;
    setPhase(0);
    const t1 = window.setTimeout(() => setPhase(1), 60);
    const t2 = window.setTimeout(() => {
      setPhase(2);
      void celebrate("big");
    }, SPIN_MS + 220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [d, s.seed]);

  function start() {
    setErr("");
    const clean = rows.map((r) => ({ ...r, label: r.label.trim() })).filter((r) => r.label);
    if (clean.length < 2) {
      setErr("항목을 2개 이상 입력해 주세요.");
      return;
    }
    s.run({
      it: clean.map((r) => r.label).slice(0, MAX),
      w: clean.map((r) => (useWeight ? Math.max(1, Math.min(999, Math.round(r.weight))) : 1)).slice(0, MAX),
    });
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="룰렛 항목 (2~20개)">
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={r.label}
                    aria-label={`${i + 1}번 항목`}
                    onChange={(e) =>
                      setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder={`항목 ${i + 1}`}
                  />
                  {useWeight ? (
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={r.weight}
                      aria-label={`${i + 1}번 항목 가중치`}
                      onChange={(e) =>
                        setRows((p) =>
                          p.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) || 1 } : x)),
                        )
                      }
                      className="w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-sm tabular-nums"
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-label={`${i + 1}번 항목 삭제`}
                    onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Btn
              variant="ghost"
              onClick={() => setRows((p) => (p.length >= MAX ? p : [...p, { label: "", weight: 1 }]))}
              ariaLabel="항목 추가"
            >
              + 항목 추가
            </Btn>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={useWeight}
                onChange={(e) => setUseWeight(e.target.checked)}
                className="size-4"
              />
              가중치 사용
            </label>
          </div>

          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="룰렛 돌리기">
            룰렛 돌리기
          </Btn>
          <Notice>
            가중치를 쓰면 값이 큰 항목이 그만큼 넓은 칸을 차지합니다. 가중치 3 : 1 이면 정확히 3배 확률입니다.
          </Notice>
        </Panel>
      </div>
    );
  }

  const R = 130;
  const C = 150;

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-4">
        <div className="mx-auto w-full max-w-[320px]">
          <svg viewBox="0 0 300 320" role="img" aria-label="룰렛" className="w-full">
            <g
              style={{
                transform: `rotate(${phase >= 1 ? target : 0}deg)`,
                transformOrigin: `${C}px ${C}px`,
                transition: phase >= 1 ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 0.84, 0.20, 1)` : "none",
              }}
            >
              {segs.map((sg, i) => (
                <path key={i} d={sectorPath(C, C, R, sg.from, sg.to)} fill={sg.color} stroke="#fff" strokeWidth={2} />
              ))}
              {segs.map((sg, i) => {
                const [tx, ty] = polar(C, C, R * 0.66, sg.mid);
                const label = sg.label.length > 6 ? `${sg.label.slice(0, 6)}…` : sg.label;
                return (
                  <text
                    key={`t${i}`}
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="#fff"
                    transform={`rotate(${sg.mid} ${tx} ${ty})`}
                  >
                    {label}
                  </text>
                );
              })}
            </g>
            <circle cx={C} cy={C} r={22} fill="#fff" stroke="#e2e8f0" strokeWidth={2} />
            <polygon points={`${C - 12},8 ${C + 12},8 ${C},34`} fill="#0f172a" />
            <text x={C} y={306} textAnchor="middle" fontSize={12} fill="#94a3b8">
              seed {s.seed}
            </text>
          </svg>
        </div>

        <div aria-live="polite" className="text-center">
          {phase === 2 ? (
            <p className="pf-pop text-xl font-bold text-slate-900">
              🎉 <span className="text-violet-700">{d.it[winner]}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">돌리는 중…</p>
          )}
        </div>
      </Panel>

      <SeedBar
        s={s}
        shareTitle="룰렛 결과"
        shareText={phase === 2 ? `룰렛 결과: ${d.it[winner]}` : "룰렛 결과 링크"}
      />
    </div>
  );
}
