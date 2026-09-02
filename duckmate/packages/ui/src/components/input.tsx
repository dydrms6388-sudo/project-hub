import * as React from "react";
import { cn } from "../lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 오류 상태: 테두리 danger + aria-invalid */
  invalid?: boolean;
}

/** Input — 입력창 radius 12px, 높이 48px, 본문 16px(iOS 확대 방지). */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", invalid, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "flex h-12 w-full rounded-md border border-input bg-card px-4 text-body text-foreground",
        "placeholder:text-sand-400 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "file:border-0 file:bg-transparent file:text-label",
        invalid && "border-destructive focus-visible:outline-destructive",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
