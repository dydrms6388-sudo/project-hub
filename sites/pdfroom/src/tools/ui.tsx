"use client";

/** 도구 구현들이 공유하는 작은 UI 조각. (공용 부품 FileDrop/DownloadButton/Progress 는 재구현하지 않는다) */

import type { ReactNode } from "react";

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  ariaLabel,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  ariaLabel?: string;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "bg-red-700 text-white hover:bg-red-800"
      : variant === "danger"
        ? "border border-red-300 bg-white text-red-700 hover:bg-red-50"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? (typeof children === "string" ? children : undefined)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-red-500 focus:outline-none";

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-700">
      {children}
    </p>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title?: string;
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border p-3 text-sm leading-relaxed ${cls}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

/** 결과 카드: 크기 비교 등 */
export function ResultBox({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ 순서 변경 목록 */

export type Reorderable = { id: string; label: string; sub?: string };

/**
 * 드래그로 순서를 바꿀 수 있는 목록. 모바일/키보드용 위·아래 버튼도 함께 제공한다.
 * (320px 폭에서 세로 스택으로 떨어지도록 구성)
 */
export function ReorderList<T extends Reorderable>({
  items,
  onChange,
  renderExtra,
  removable = true,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  renderExtra?: (item: T, index: number) => ReactNode;
  /** false 면 제거 버튼을 숨긴다 (파일 추가/삭제를 FileDrop 이 전담할 때) */
  removable?: boolean;
}) {
  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li
          key={it.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (Number.isFinite(from)) move(from, i);
          }}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="cursor-grab select-none text-slate-400"
              title="끌어서 순서 변경"
            >
              ⠿
            </span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 basis-40 truncate text-sm text-slate-800">
              {it.label}
            </span>
            {it.sub ? <span className="shrink-0 text-xs text-slate-400">{it.sub}</span> : null}
            <span className="ml-auto flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`${it.label} 위로`}
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${it.label} 아래로`}
                onClick={() => move(i, i + 1)}
                disabled={i === items.length - 1}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
              >
                ↓
              </button>
              {removable ? (
                <button
                  type="button"
                  aria-label={`${it.label} 제거`}
                  onClick={() => remove(i)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                >
                  제거
                </button>
              ) : null}
            </span>
          </div>
          {renderExtra ? <div className="mt-2">{renderExtra(it, i)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
