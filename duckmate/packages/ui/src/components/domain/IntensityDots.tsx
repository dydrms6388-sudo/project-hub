import * as React from "react";
import { cn } from "../../lib/cn";
import { INTENSITY_LABELS, type Intensity } from "../../tokens";

export interface IntensityDotsProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 1~5 */
  value: Intensity;
  size?: "sm" | "md";
  /** 점 옆에 라벨("거의 매일") 텍스트 표시 */
  showLabel?: boolean;
  tone?: "primary" | "accent" | "muted" | "inherit";
}

const DOT = { sm: "size-1.5", md: "size-2" } as const;
const TONE = {
  primary: "bg-primary",
  accent: "bg-accent",
  muted: "bg-sand-500",
  inherit: "bg-current",
} as const;

/**
 * IntensityDots — 몰입도 1~5 점 5개. 색만으로 전달 금지 → aria-label + 옵션 라벨.
 * 몰입도 5도 1도 같은 무게(10_brand §4.1 원칙 3): 서열 표현 없음.
 */
export const IntensityDots = React.forwardRef<HTMLSpanElement, IntensityDotsProps>(
  ({ value, size = "md", showLabel = false, tone = "primary", className, ...props }, ref) => {
    const v = Math.max(1, Math.min(5, Math.round(value))) as Intensity;
    const label = INTENSITY_LABELS[v];
    return (
      <span
        ref={ref}
        role="img"
        aria-label={`몰입도 ${v}/5 ${label}`}
        className={cn("inline-flex items-center gap-1.5", className)}
        {...props}
      >
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={cn("rounded-full", DOT[size], i <= v ? TONE[tone] : "bg-sand-200 dark:bg-input")}
            />
          ))}
        </span>
        {showLabel ? <span className="text-caption text-muted-foreground" aria-hidden="true">{label}</span> : null}
      </span>
    );
  },
);
IntensityDots.displayName = "IntensityDots";
