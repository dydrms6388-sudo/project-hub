import * as React from "react";
import { cn } from "./cn";

/**
 * Select — 네이티브 <select> 스타일링. 커스텀 리스트박스 금지(외부 라이브러리
 * 불가 + 네이티브가 모바일 접근성 우수). 옵션은 children 으로 <option> 전달.
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** 검증 실패 상태 */
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <span className={cn("relative inline-flex w-full", className)}>
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-line bg-surface-raised pl-4 pr-10 text-body text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:pointer-events-none disabled:opacity-50",
          invalid && "border-danger",
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </span>
  );
}
