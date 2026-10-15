"use client";

import { useState, type ReactNode } from "react";
import type { AnyRate } from "@/data/rates-2026";
import type { Step } from "@/lib/calc/core";
import { num, pct, won } from "@/lib/money";

/* ---------------- 확인 필요 배지 ---------------- */

export function VerifyBadge() {
  return (
    <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-amber-800">
      확인 필요
    </span>
  );
}

/* ---------------- 사용된 요율 목록 ---------------- */

export function RateList({ rates }: { rates: AnyRate[] }) {
  if (rates.length === 0) return null;
  const unverified = rates.filter((r) => !r.verified);
  return (
    <div className="mt-6">
      {unverified.length > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">
            ⚠️ 아래 {unverified.length}개 항목은 정부·공단 1차 출처에서 값을 확인하지 못했습니다.
          </p>
          <p className="mt-1 leading-relaxed">
            마지막으로 알려진 값으로 계산했지만 실제와 다를 수 있습니다. 출처 링크에서 직접
            확인해 주세요.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {unverified.map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
          📋 이 계산에 쓰인 요율과 출처 ({rates.length}개)
        </summary>
        <div className="border-t border-slate-200 px-4 py-3">
          <ul className="space-y-3">
            {rates.map((r) => (
              <li key={r.label} className="text-sm">
                <p className="font-medium text-slate-800">
                  {r.label}
                  {r.verified ? null : <VerifyBadge />}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">적용일 {r.effectiveDate}</p>
                {r.note ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{r.note}</p>
                ) : null}
                <a
                  href={r.source}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1 inline-block break-all text-[13px] text-teal-700 hover:underline"
                >
                  {r.sourceLabel} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

/* ---------------- 산식 펼치기 ---------------- */

function fmt(s: Step): string {
  switch (s.unit) {
    case "pct":
      return pct(s.value, 4);
    case "num":
      return num(s.value, Number.isInteger(s.value) ? 0 : 2);
    case "day":
      return `${num(s.value, Number.isInteger(s.value) ? 0 : 1)}일`;
    case "month":
      return `${num(s.value)}개월`;
    case "year":
      return `${num(s.value)}년`;
    default:
      return won(s.value);
  }
}

export function Formula({ steps, title = "산식 펼치기 — 숫자를 그대로 대입한 계산 과정" }: {
  steps: Step[];
  title?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <details className="mt-4 rounded-xl border border-slate-200">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
        🧮 {title}
      </summary>
      <div className="overflow-x-auto border-t border-slate-200">
        <ol className="min-w-0 divide-y divide-slate-100">
          {steps.map((s, idx) => (
            <li key={`${s.label}-${idx}`} className="px-4 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-slate-700">
                  {idx + 1}. {s.label}
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-900">{fmt(s)}</span>
              </div>
              <p className="mt-0.5 break-words font-mono text-[12px] leading-relaxed text-slate-500">
                {s.expr}
              </p>
              {s.hint ? (
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">↳ {s.hint}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

/* ---------------- 결과 카드 ---------------- */

export type ResultLine = { label: string; value: string; hint?: string; tone?: "plus" | "minus" };

export function ResultCard({
  headline,
  headlineLabel,
  sub,
  lines,
  children,
}: {
  headlineLabel: string;
  headline: string;
  sub?: string;
  lines?: ResultLine[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
      <p className="text-sm font-medium text-teal-800">{headlineLabel}</p>
      <p className="mt-1 break-all text-2xl font-extrabold tracking-tight text-teal-900 sm:text-3xl">
        {headline}
      </p>
      {sub ? <p className="mt-1 text-sm text-teal-800">{sub}</p> : null}
      {lines && lines.length > 0 ? (
        <dl className="mt-4 divide-y divide-teal-200/70 border-t border-teal-200/70">
          {lines.map((l) => (
            <div key={l.label} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
              <dt className="text-sm text-slate-700">
                {l.label}
                {l.hint ? <span className="ml-1 text-xs text-slate-500">({l.hint})</span> : null}
              </dt>
              <dd
                className={`text-sm font-semibold tabular-nums ${
                  l.tone === "minus"
                    ? "text-rose-700"
                    : l.tone === "plus"
                      ? "text-teal-700"
                      : "text-slate-900"
                }`}
              >
                {l.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------- A안 / B안 비교 ---------------- */

export type ABState = {
  compare: boolean;
  setCompare: (v: boolean) => void;
  tab: "a" | "b";
  setTab: (v: "a" | "b") => void;
};

export function useAB(): ABState {
  const [compare, setCompareRaw] = useState(false);
  const [tab, setTab] = useState<"a" | "b">("a");
  const setCompare = (v: boolean) => {
    setCompareRaw(v);
    if (!v) setTab("a");
  };
  return { compare, setCompare, tab, setTab };
}

export function ABBar({ ab, labelA = "A안", labelB = "B안" }: {
  ab: ABState;
  labelA?: string;
  labelB?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label={ab.compare ? "비교 모드 끄기" : "A안 B안 비교 모드 켜기"}
        aria-pressed={ab.compare}
        onClick={() => ab.setCompare(!ab.compare)}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          ab.compare
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {ab.compare ? "✓ A안/B안 비교 중" : "A안/B안 비교"}
      </button>
      {ab.compare ? (
        <div className="flex overflow-hidden rounded-lg border border-slate-300" role="tablist" aria-label="비교안 선택">
          {(["a", "b"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={ab.tab === k}
              aria-label={`${k === "a" ? labelA : labelB} 입력하기`}
              onClick={() => ab.setTab(k)}
              className={`px-3 py-1.5 text-sm ${
                ab.tab === k ? "bg-slate-800 font-semibold text-white" : "bg-white text-slate-600"
              }`}
            >
              {k === "a" ? labelA : labelB} 입력
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type CompareRow = { label: string; a: string; b: string; better?: "a" | "b" | null };

export function CompareTable({ rows, labelA = "A안", labelB = "B안" }: {
  rows: CompareRow[];
  labelA?: string;
  labelB?: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">항목</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">{labelA}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">{labelB}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">{r.label}</th>
              <td className={`px-3 py-2 text-right tabular-nums ${r.better === "a" ? "font-bold text-teal-700" : "text-slate-800"}`}>
                {r.a}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.better === "b" ? "font-bold text-teal-700" : "text-slate-800"}`}>
                {r.b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- 고지 ---------------- */

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-slate-100 p-3 text-[13px] leading-relaxed text-slate-600">
      ℹ️ {children}
    </p>
  );
}

export const TAX_DISCLAIMER = (
  <>
    이 계산기는 공개된 세법 규정을 단순화해 적용한 <strong>참고용 추정치</strong>입니다. 세무
    당국의 확정 판단이 아니며, 실제 세액은 개별 사정(감면·중과·합산 이력 등)에 따라 달라집니다.
    금액이 크거나 다주택·상속·사업 관련이 얽힌 복잡한 사례는 반드시 세무사·회계사와 상담하세요.
  </>
);

/* ---------------- 전체 골격 ---------------- */

export function CalcFrame({
  ab,
  labelA,
  labelB,
  inputs,
  result,
  compareRows,
  steps,
  rates,
  disclaimer,
  extra,
}: {
  ab?: ABState;
  labelA?: string;
  labelB?: string;
  inputs: ReactNode;
  result: ReactNode;
  compareRows?: CompareRow[];
  steps: Step[];
  rates: AnyRate[];
  disclaimer?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      {ab ? (
        <div className="flex flex-col gap-3">
          <ABBar ab={ab} labelA={labelA} labelB={labelB} />
          {ab.compare ? (
            <p className="text-xs text-slate-500">
              지금 <strong>{ab.tab === "a" ? (labelA ?? "A안") : (labelB ?? "B안")}</strong> 값을
              입력하고 있습니다. 탭을 바꿔 다른 안을 입력하면 아래에 두 안이 나란히 비교됩니다.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">{inputs}</div>

      <div>{result}</div>

      {ab?.compare && compareRows && compareRows.length > 0 ? (
        <CompareTable rows={compareRows} labelA={labelA} labelB={labelB} />
      ) : null}

      {extra}

      <Formula steps={steps} />

      {disclaimer ? <Disclaimer>{disclaimer}</Disclaimer> : null}

      <RateList rates={rates} />
    </div>
  );
}
