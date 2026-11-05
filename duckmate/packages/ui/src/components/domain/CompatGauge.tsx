import * as React from "react";
import { cn } from "../../lib/cn";
import { compatTone } from "../../tokens";

export interface CompatGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0~100 (D3 score 반올림) */
  value: number;
  /** 접근성/표시 라벨, 기본 "궁합" */
  label?: string;
  size?: "sm" | "md" | "lg";
  /** 숫자 표시 */
  showValue?: boolean;
  /** bar(기본) / ring */
  layout?: "bar" | "ring";
}

const FILL = { muted: "bg-sand-500", primary: "bg-primary", accent: "bg-accent" } as const;
const TEXT = { muted: "text-muted-foreground", primary: "text-primary", accent: "text-coral-700 dark:text-coral-300" } as const;
const STROKE = { muted: "stroke-sand-500", primary: "stroke-primary", accent: "stroke-accent" } as const;

/**
 * CompatGauge — 궁합 % 게이지. 색 규칙(tokens.compatTone): 0~39 muted / 40~79 primary / 80~100 accent.
 * role="meter" + aria-valuenow. 숫자는 .tnum. 코랄 텍스트는 accent-700(#B5321F, L11 5.76) 사용.
 * 매력·인기 지표가 아니라 취미·퀴즈·시간대 겹침 점수임을 label로 명시한다.
 */
export const CompatGauge = React.forwardRef<HTMLDivElement, CompatGaugeProps>(
  ({ value, label = "궁합", size = "md", showValue = true, layout = "bar", className, ...props }, ref) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    const tone = compatTone(v);
    const aria = { role: "meter", "aria-label": `${label} ${v}%`, "aria-valuenow": v, "aria-valuemin": 0, "aria-valuemax": 100 } as const;

    if (layout === "ring") {
      const px = size === "sm" ? 48 : size === "lg" ? 96 : 64;
      const sw = size === "sm" ? 5 : 7;
      const r = (px - sw) / 2;
      const c = 2 * Math.PI * r;
      return (
        <div ref={ref} className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: px, height: px }} {...aria} {...props}>
          <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true" className="-rotate-90">
            <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={sw} className="stroke-muted" />
            <circle
              cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
              className={cn(STROKE[tone], "transition-[stroke-dashoffset] duration-(--duration-sheet) ease-(--ease-enter)")}
            />
          </svg>
          {showValue ? (
            <span className={cn("tnum absolute font-bold", TEXT[tone], size === "sm" ? "text-caption" : size === "lg" ? "text-h2" : "text-label")} aria-hidden="true">
              {v}%
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn("flex w-full flex-col gap-1.5", className)} {...aria} {...props}>
        <div className="flex items-baseline justify-between gap-2" aria-hidden="true">
          <span className="text-label text-muted-foreground">{label}</span>
          {showValue ? (
            <span className={cn("tnum font-bold", TEXT[tone], size === "sm" ? "text-label" : size === "lg" ? "text-h2" : "text-h3")}>{v}%</span>
          ) : null}
        </div>
        <div className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2")} aria-hidden="true">
          <div
            className={cn("h-full w-full rounded-full transition-transform duration-(--duration-sheet) ease-(--ease-enter)", FILL[tone])}
            style={{ transform: `translateX(-${100 - v}%)` }}
          />
        </div>
      </div>
    );
  },
);
CompatGauge.displayName = "CompatGauge";
