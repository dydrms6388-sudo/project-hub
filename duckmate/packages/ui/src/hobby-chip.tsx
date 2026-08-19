import * as React from "react";
import { cn } from "./cn";

/**
 * HobbyChip — 취미 태그 칩.
 * - selectable(기본): 온보딩 취미 선택 등 — <button aria-pressed> 토글.
 *   선택 상태는 색 + 체크 아이콘 + 굵기 3중 전달 (색 단독 금지, D-4).
 * - selectable=false: 덕질카드 등 표시 전용 — <span>.
 * 선택 상태는 제어형(부모가 selected 관리) — 내부 상태 없음.
 */
export interface HobbyChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  selected?: boolean;
  /** false 면 표시 전용 <span> 렌더 */
  selectable?: boolean;
}

export function HobbyChip({
  label,
  selected = false,
  selectable = true,
  className,
  ...props
}: HobbyChipProps) {
  const base = cn(
    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-body-sm transition-colors",
    selected
      ? "border-primary bg-primary-tint font-semibold text-primary-tint-fg"
      : "border-line bg-surface-raised text-ink",
  );

  if (!selectable) {
    return <span className={cn(base, className)}>{label}</span>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        base,
        "cursor-pointer hover:border-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {selected && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        </svg>
      )}
      {label}
    </button>
  );
}
