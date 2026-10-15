"use client";

import { useId, type ReactNode } from "react";
import { formatBytes, MANY_FILES } from "@/lib/image-core";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
        />
        {suffix ? <span className="shrink-0 text-sm text-slate-500">{suffix}</span> : null}
      </div>
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <span className="text-sm tabular-nums text-slate-600">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Radios<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${
              value === o.value
                ? "border-blue-500 bg-blue-50/60"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 accent-blue-600"
              aria-label={o.label}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{o.label}</span>
              {o.hint ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{o.hint}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="mt-0.5 accent-blue-600"
      />
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

const TONES = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
} as const;

export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-lg border p-3 text-sm leading-relaxed ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}

export function RunButton({
  onClick,
  busy,
  disabled,
  children,
  label,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-label={label ?? (typeof children === "string" ? children : "실행")}
      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
    >
      {busy ? "처리 중…" : children}
    </button>
  );
}

/** 100장 이상이면 경고 */
export function ManyFilesWarning({ count }: { count: number }) {
  if (count < MANY_FILES) return null;
  return (
    <Notice tone="warn">
      파일 {count}장을 선택했습니다. 브라우저 메모리 안에서 한 번에 처리하므로 기기에 따라 아주
      느려지거나 탭이 종료될 수 있습니다. {MANY_FILES}장 이하로 나눠서 처리하는 것을 권합니다.
    </Notice>
  );
}

export type ResultRow = {
  name: string;
  outName?: string;
  before?: number;
  after?: number;
  note?: string;
  error?: string | null;
};

export function ResultTable({ rows }: { rows: ResultRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[300px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">파일</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">결과</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={`${r.name}-${i}`} className={r.error ? "bg-red-50/60" : undefined}>
              <td className="max-w-[45vw] px-3 py-2 align-top">
                <span className="block truncate text-slate-800">{r.outName ?? r.name}</span>
                {r.outName && r.outName !== r.name ? (
                  <span className="block truncate text-xs text-slate-400">← {r.name}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 align-top text-slate-600">
                {r.error ? (
                  <span className="text-red-700">{r.error}</span>
                ) : (
                  <span className="whitespace-nowrap">
                    {typeof r.before === "number" && typeof r.after === "number" ? (
                      <>
                        {formatBytes(r.before)} → {formatBytes(r.after)}
                        {r.before > 0 ? (
                          <span
                            className={
                              r.after <= r.before
                                ? "ml-1.5 text-emerald-700"
                                : "ml-1.5 text-slate-500"
                            }
                          >
                            ({Math.round((1 - r.after / r.before) * 100)}%↓)
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {r.note ? <span className="block text-xs text-slate-500">{r.note}</span> : null}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrivacyNote() {
  return (
    <p className="text-xs leading-relaxed text-slate-500">
      모든 변환은 브라우저 안에서 실행됩니다. 사진은 서버로 전송되지 않으며, 페이지를 닫으면
      메모리에서 사라집니다.
    </p>
  );
}
