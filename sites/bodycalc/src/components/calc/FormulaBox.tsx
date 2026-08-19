"use client";

import type { Step } from "@/lib/health";

/**
 * 모든 계산기 하단 공통 "산식(출처)" 박스.
 * 공식 원문 → 숫자 대입 단계 → 한계 → 출처 순으로 보여준다.
 */
export default function FormulaBox({
  formula,
  steps,
  note,
  limits,
  sources,
  defaultOpen = true,
}: {
  /** 공식 원문 (여러 줄 가능) */
  formula: string[];
  /** 숫자 대입 과정 */
  steps: Step[];
  note?: string;
  /** 이 식의 한계 */
  limits?: string[];
  sources?: { label: string; url: string }[];
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-slate-300 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-800 marker:content-none">
        <span className="mr-1.5 text-teal-700">ƒ</span>
        산식(출처) — 어떤 공식에 어떤 숫자를 넣었는지
        <span className="float-right text-slate-400">▾</span>
      </summary>

      <div className="space-y-4 border-t border-slate-200 px-4 py-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">공식</p>
          <div className="space-y-1 overflow-x-auto rounded-lg bg-slate-900 p-3">
            {formula.map((f) => (
              <p key={f} className="whitespace-pre font-mono text-[13px] leading-relaxed text-teal-200">
                {f}
              </p>
            ))}
          </div>
        </div>

        {steps.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              내 값 대입
            </p>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={`${s.label}-${i}`} className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-xs font-medium text-slate-500">{s.label}</p>
                  <p className="mt-0.5 break-words font-mono text-[13px] leading-relaxed text-slate-700">
                    {s.expr}
                  </p>
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-teal-800">= {s.value}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {note ? <p className="text-sm leading-relaxed text-slate-600">{note}</p> : null}

        {limits && limits.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              이 식의 한계
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-slate-600">
              {limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {sources && sources.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">출처</p>
            <ul className="space-y-1 text-sm">
              {sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-words text-teal-700 underline underline-offset-2 hover:text-teal-900"
                  >
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
