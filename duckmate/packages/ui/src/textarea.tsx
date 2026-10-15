import * as React from "react";
import { cn } from "./cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 검증 실패 상태 — aria-invalid 와 danger 보더를 함께 적용 */
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-28 w-full rounded-xl border border-line bg-surface-raised px-4 py-3 text-body text-ink",
        "placeholder:text-ink-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        invalid && "border-danger",
        className,
      )}
      {...props}
    />
  );
}
