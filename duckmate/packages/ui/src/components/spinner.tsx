import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  /** 스크린리더 텍스트 */
  label?: string;
}
const SIZE = { sm: "size-4", md: "size-6", lg: "size-8" } as const;

/** Spinner — 무한 루프 허용 예외(스피너·스켈레톤만). */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(({ size = "md", label = "불러오는 중", className, ...props }, ref) => (
  <span ref={ref} role="status" className={cn("inline-flex items-center justify-center text-primary", className)} {...props}>
    <LoaderCircle className={cn("animate-spin", SIZE[size])} strokeWidth={2} aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </span>
));
Spinner.displayName = "Spinner";
