"use client";

import type { ReactNode } from "react";

/** 도구 공통 버튼 */
export function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "soft" | "ghost";
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const styles = {
    primary: "bg-violet-600 text-white hover:bg-violet-700",
    soft: "bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

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
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  ariaLabel,
}: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={Number.isFinite(value) ? value : min}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? n : min);
      }}
      onBlur={(e) => {
        const n = Number(e.target.value);
        onChange(Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n / step) * step : min)));
      }}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
    />
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>;
}

/** 도구를 아직 못 쓰는 상태(해시 해석 중) */
export function ToolLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
    >
      불러오는 중…
    </div>
  );
}
