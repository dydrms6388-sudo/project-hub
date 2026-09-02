"use client";

import { useId, type ReactNode } from "react";
import { korMoney } from "@/lib/money";

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <legend className="px-1 text-sm font-semibold text-slate-700">{legend}</legend>
      <div className="mt-1 space-y-3">{children}</div>
    </fieldset>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
  /** 금액이면 아래에 "1억 2,345만원" 요약을 보여준다 */
  money?: boolean;
  /** 빠른 입력 버튼 (예: +100만) */
  quick?: { label: string; delta: number }[];
};

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  step = 1,
  min = 0,
  max,
  money,
  quick,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 flex items-stretch rounded-lg border border-slate-300 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="w-full min-w-0 rounded-lg bg-transparent px-3 py-2 text-right text-[15px] tabular-nums outline-none"
        />
        {suffix ? (
          <span className="flex shrink-0 items-center pr-3 text-sm text-slate-500">{suffix}</span>
        ) : null}
      </div>
      {money && value > 0 ? (
        <p className="mt-1 text-right text-xs text-teal-700">{korMoney(value)}</p>
      ) : null}
      {quick && quick.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              aria-label={`${label} ${q.label}`}
              onClick={() => onChange(Math.max(min, value + q.delta))}
              className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      ) : null}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SelectField<T extends string>({
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
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ToggleField({
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
  const id = useId();
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      </div>
      {hint ? <p className="mt-1 pl-6 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function RadioGroup<T extends string>({
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
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === o.value
                ? "border-teal-600 bg-teal-50 font-semibold text-teal-800"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
