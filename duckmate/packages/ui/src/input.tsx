import * as React from "react";
import { cn } from "./cn";

/**
 * Input — 텍스트 크기 16px(text-body) 고정: iOS 자동 줌 방지 (C1 §3.2).
 * 에러 표시는 색만으로 전달 금지 — invalid 와 함께 반드시 aria-describedby 로
 * 에러 문구를 연결할 것 (D-4 하드룰 4).
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 검증 실패 상태 — aria-invalid 와 danger 보더를 함께 적용 */
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-surface-raised px-4 text-body text-ink",
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
