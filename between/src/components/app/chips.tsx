"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt<T extends string> = { value: T; label: string };

/** 토글 칩 (aria-pressed). 다중 선택 필터·프로필 태그 입력 공용 */
export function Chip({
  selected,
  onClick,
  children,
  className,
  size = "md",
  ...rest
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap transition-all select-none active:scale-95",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        selected
          ? "border-transparent bg-brand text-white shadow-[0_4px_16px_-6px] shadow-primary/60"
          : "border-white/10 bg-secondary/60 text-secondary-foreground hover:bg-secondary",
        className,
      )}
      {...rest}
    >
      {selected && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  max,
  single,
  size,
  label,
}: {
  options: readonly Opt<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  max?: number;
  single?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  const toggle = (v: T) => {
    if (single) return onChange(value.includes(v) ? [] : [v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return;
    onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <Chip key={o.value} size={size} selected={value.includes(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
