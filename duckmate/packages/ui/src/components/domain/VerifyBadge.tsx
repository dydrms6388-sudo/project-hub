import * as React from "react";
import { BadgeCheck, Phone, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "../../lib/cn";
import { VERIFY_LABELS, type VerifyLevel } from "../../tokens";

export interface VerifyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: VerifyLevel;
  /** L0/L1도 렌더(인증 센터·설정용). 기본 false → L0/L1은 null (PRD §0-29: 카드에 L1 마크 없음) */
  showLow?: boolean;
  size?: "sm" | "md";
  /** 텍스트 숨기고 아이콘만(aria-label 유지) */
  iconOnly?: boolean;
}

/**
 * VerifyBadge — L2 "본인인증" = shield-check primary 아웃라인 칩 / L3 "사진인증" = badge-check primary 채움 칩.
 * 외모·인기·매력도 라벨은 어떤 색으로도 존재하지 않는다.
 */
export const VerifyBadge = React.forwardRef<HTMLSpanElement, VerifyBadgeProps>(
  ({ level, showLow = false, size = "sm", iconOnly = false, className, ...props }, ref) => {
    if (level < 2 && !showLow) return null;
    const label = VERIFY_LABELS[level];
    const Icon = level === 3 ? BadgeCheck : level === 2 ? ShieldCheck : level === 1 ? Phone : UserRound;
    const tone =
      level === 3
        ? "border-transparent bg-primary text-primary-foreground"
        : level === 2
          ? "border-primary bg-transparent text-primary"
          : "border-border bg-transparent text-muted-foreground";
    return (
      <span
        ref={ref}
        role="img"
        aria-label={`${label} 완료`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border whitespace-nowrap",
          size === "sm" ? "h-5 px-1.5 text-caption" : "h-6 px-2 text-caption",
          iconOnly && "px-1",
          tone,
          className,
        )}
        {...props}
      >
        <Icon size={size === "sm" ? 12 : 14} strokeWidth={2} aria-hidden="true" />
        {iconOnly ? null : <span aria-hidden="true">{label}</span>}
      </span>
    );
  },
);
VerifyBadge.displayName = "VerifyBadge";
