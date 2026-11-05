"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../lib/cn";

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 0~100 */
  value?: number;
  /** 채움 색 */
  tone?: "primary" | "accent" | "success" | "muted";
  indicatorClassName?: string;
}

const TONE: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  muted: "bg-sand-500",
};

/** Progress — transform 기반(width 애니메이션 금지). 숫자 라벨은 별도 `.tnum` 텍스트로. */
export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = 0, tone = "primary", indicatorClassName, ...props }, ref) => {
    const v = Math.max(0, Math.min(100, value));
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={v}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full rounded-full transition-transform duration-(--duration-base) ease-(--ease-enter)", TONE[tone], indicatorClassName)}
          style={{ transform: `translateX(-${100 - v}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = "Progress";
