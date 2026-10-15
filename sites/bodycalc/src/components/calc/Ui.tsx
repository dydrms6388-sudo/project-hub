"use client";

import type { ReactNode } from "react";

/* ---------------- 입력 ---------------- */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  ariaLabel,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-stretch">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${suffix ? "rounded-r-none" : ""}`}
      />
      {suffix ? (
        <span className="flex shrink-0 items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-2 text-sm text-slate-500">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput(props: {
  id: string;
  type?: "date" | "time" | "text";
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const { id, type = "text", value, onChange, ariaLabel } = props;
  return (
    <input
      id={id}
      type={type}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
      className={inputCls}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 라디오 대체 세그먼트 — 320px 에서 줄바꿈된다 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={`${label}: ${o.label}`}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              on
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 입력 묶음 — 모바일 1열, sm 이상 2열 */
export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/* ---------------- 결과 ---------------- */

export function ResultCard({
  title,
  children,
  tone = "teal",
}: {
  title?: string;
  children: ReactNode;
  tone?: "teal" | "slate";
}) {
  const cls =
    tone === "teal" ? "border-teal-200 bg-teal-50/70" : "border-slate-200 bg-slate-50";
  return (
    <section className={`rounded-xl border p-4 ${cls}`} aria-label={title ?? "계산 결과"}>
      {title ? <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3> : null}
      {children}
    </section>
  );
}

export function BigStat({
  value,
  unit,
  caption,
  sub,
}: {
  value: string;
  unit?: string;
  caption: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{caption}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {unit ? <span className="text-sm font-medium text-slate-600">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1 text-sm text-slate-600">{sub}</p> : null}
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{i.value}</dd>
          {i.sub ? <dd className="text-xs text-slate-500">{i.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** 가로로 긴 표는 320px 에서 가로 스크롤 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-full">{children}</div>
    </div>
  );
}

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-slate-200 px-2 py-2 text-xs font-semibold text-slate-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  strong = false,
}: {
  children: ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`border-b border-slate-100 px-2 py-2 text-sm ${right ? "text-right tabular-nums" : ""} ${
        strong ? "font-semibold text-slate-900" : "text-slate-700"
      }`}
    >
      {children}
    </td>
  );
}
