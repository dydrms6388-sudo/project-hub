"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { saveBlob } from "@/components/DownloadButton";

/**
 * localStorage 기반 초간단 기록기.
 * 서버가 없으므로 데이터는 이 브라우저 밖으로 나가지 않는다.
 * 요구사항: CSV 내보내기 + 전체 삭제 버튼 필수.
 */

export type TrackerKind = "weight" | "sleep" | "caffeine";

type FieldDef = {
  key: string;
  label: string;
  type: "number" | "time";
  suffix?: string;
  step?: number;
  placeholder?: string;
};

type Entry = { id: string; date: string; v: Record<string, string> };

const SCHEMA: Record<
  TrackerKind,
  { title: string; desc: string; unit: string; fields: FieldDef[]; metric: (v: Record<string, string>) => number | null; metricLabel: string }
> = {
  weight: {
    title: "체중 기록",
    desc: "날짜와 체중만 남기는 가장 단순한 기록입니다. 목표치나 평가 문구는 표시하지 않습니다.",
    unit: "kg",
    fields: [
      { key: "kg", label: "체중", type: "number", suffix: "kg", step: 0.1, placeholder: "68.4" },
      { key: "fat", label: "체지방률(선택)", type: "number", suffix: "%", step: 0.1, placeholder: "18.0" },
    ],
    metric: (v) => (v.kg ? Number(v.kg) : null),
    metricLabel: "체중(kg)",
  },
  sleep: {
    title: "수면 기록",
    desc: "취침·기상 시각을 남기면 수면 시간이 자동으로 계산됩니다.",
    unit: "시간",
    fields: [
      { key: "bed", label: "취침", type: "time" },
      { key: "wake", label: "기상", type: "time" },
    ],
    metric: (v) => {
      if (!v.bed || !v.wake) return null;
      const toMin = (s: string) => {
        const [h, m] = s.split(":").map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      let d = toMin(v.wake) - toMin(v.bed);
      if (d <= 0) d += 1440;
      return Math.round((d / 60) * 100) / 100;
    },
    metricLabel: "수면시간(h)",
  },
  caffeine: {
    title: "카페인 기록",
    desc: "하루에 마신 카페인 총량을 남겨 두면 며칠 치 흐름을 볼 수 있습니다.",
    unit: "mg",
    fields: [
      { key: "mg", label: "총 카페인", type: "number", suffix: "mg", step: 5, placeholder: "250" },
      { key: "last", label: "마지막 섭취 시각(선택)", type: "time" },
    ],
    metric: (v) => (v.mg ? Number(v.mg) : null),
    metricLabel: "카페인(mg)",
  },
};

const storageKey = (kind: TrackerKind) => `bodycalc:tracker:${kind}`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Tracker({ kind }: { kind: TrackerKind }) {
  const schema = SCHEMA[kind];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(kind));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setEntries(parsed as Entry[]);
      }
    } catch {
      /* 손상된 데이터는 무시하고 빈 목록에서 시작 */
    }
    setReady(true);
  }, [kind]);

  const persist = useCallback(
    (next: Entry[]) => {
      setEntries(next);
      try {
        localStorage.setItem(storageKey(kind), JSON.stringify(next));
      } catch {
        /* 용량 초과·프라이빗 모드 */
      }
    },
    [kind],
  );

  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const series = useMemo(
    () =>
      sorted
        .map((e) => ({ date: e.date, v: schema.metric(e.v) }))
        .filter((p): p is { date: string; v: number } => p.v !== null && isFinite(p.v)),
    [sorted, schema],
  );

  function add() {
    const hasValue = schema.fields.some((f) => draft[f.key]);
    if (!date || !hasValue) return;
    const entry: Entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date, v: { ...draft } };
    persist([...entries.filter((e) => e.date !== date), entry]);
    setDraft({});
  }

  function remove(id: string) {
    persist(entries.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (!confirm("이 브라우저에 저장된 기록을 모두 지웁니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    persist([]);
    try {
      localStorage.removeItem(storageKey(kind));
    } catch {
      /* noop */
    }
  }

  function exportCsv() {
    const head = ["날짜", ...schema.fields.map((f) => f.label), schema.metricLabel];
    const rows = sorted.map((e) => [
      e.date,
      ...schema.fields.map((f) => e.v[f.key] ?? ""),
      String(schema.metric(e.v) ?? ""),
    ]);
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const csv = [head, ...rows].map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
    // 엑셀에서 한글이 깨지지 않도록 BOM 추가
    saveBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `bodycalc-${kind}-${todayIso()}.csv`);
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500" role="status">
        기록을 불러오는 중…
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label={schema.title}>
      <h3 className="text-sm font-bold text-slate-800">{schema.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {schema.desc} 기록은 이 브라우저의 저장소에만 남고 서버로 전송되지 않습니다. 방문 기록을
        지우거나 다른 기기에서 열면 보이지 않습니다.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`tr-${kind}-date`} className="mb-1 block text-xs font-medium text-slate-600">
            날짜
          </label>
          <input
            id={`tr-${kind}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />
        </div>
        {schema.fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`tr-${kind}-${f.key}`} className="mb-1 block text-xs font-medium text-slate-600">
              {f.label}
            </label>
            <div className="flex items-stretch">
              <input
                id={`tr-${kind}-${f.key}`}
                type={f.type}
                inputMode={f.type === "number" ? "decimal" : undefined}
                step={f.step}
                placeholder={f.placeholder}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className={`w-full min-w-0 rounded-lg border border-slate-300 px-2.5 py-2 text-sm ${
                  f.suffix ? "rounded-r-none" : ""
                }`}
              />
              {f.suffix ? (
                <span className="flex shrink-0 items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-2 text-xs text-slate-500">
                  {f.suffix}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          aria-label="기록 추가"
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          기록 추가
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          aria-label="기록 CSV 내보내기"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          CSV 내보내기
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={sorted.length === 0}
          aria-label="기록 전체 삭제"
          className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        >
          전체 삭제
        </button>
      </div>

      {series.length >= 2 ? <Spark series={series} label={schema.metricLabel} /> : null}

      {sorted.length > 0 ? (
        <div className="-mx-1 mt-3 overflow-x-auto px-1">
          <table className="w-full min-w-[280px] border-collapse">
            <caption className="sr-only">{schema.title} 목록</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-slate-200 px-1.5 py-1.5 text-left text-xs text-slate-500">
                  날짜
                </th>
                {schema.fields.map((f) => (
                  <th
                    key={f.key}
                    scope="col"
                    className="border-b border-slate-200 px-1.5 py-1.5 text-right text-xs text-slate-500"
                  >
                    {f.label}
                  </th>
                ))}
                <th scope="col" className="border-b border-slate-200 px-1.5 py-1.5 text-right text-xs text-slate-500">
                  삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap border-b border-slate-100 px-1.5 py-1.5 text-sm text-slate-700">
                    {e.date}
                  </td>
                  {schema.fields.map((f) => (
                    <td
                      key={f.key}
                      className="border-b border-slate-100 px-1.5 py-1.5 text-right text-sm tabular-nums text-slate-700"
                    >
                      {e.v[f.key] || "—"}
                    </td>
                  ))}
                  <td className="border-b border-slate-100 px-1.5 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      aria-label={`${e.date} 기록 삭제`}
                      className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">아직 기록이 없습니다.</p>
      )}
    </section>
  );
}

/** 기록 추이 스파크라인 — 역시 의존성 없이 SVG */
function Spark({ series, label }: { series: { date: string; v: number }[]; label: string }) {
  const W = 640;
  const H = 140;
  const pad = { l: 44, r: 10, t: 12, b: 22 };
  const vs = series.map((s) => s.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yLo = lo - span * 0.2;
  const yHi = hi + span * 0.2;
  const sx = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const sy = (v: number) => H - pad.b - ((v - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
  const d = series.map((s, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(s.v).toFixed(1)}`).join(" ");

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="mb-1 px-1 text-xs text-slate-500">{label} 추이</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label} 추이 그래프`}>
        {[yLo, (yLo + yHi) / 2, yHi].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" />
            <text x={pad.l - 6} y={sy(t) + 5} textAnchor="end" fontSize={14} fill="#94a3b8">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinejoin="round" />
        {series.map((s, i) => (
          <circle key={s.date} cx={sx(i)} cy={sy(s.v)} r={3} fill="#0d9488" />
        ))}
        <text x={pad.l} y={H - 4} fontSize={14} fill="#94a3b8">
          {series[0].date.slice(5)}
        </text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize={14} fill="#94a3b8">
          {series[series.length - 1].date.slice(5)}
        </text>
      </svg>
    </div>
  );
}
