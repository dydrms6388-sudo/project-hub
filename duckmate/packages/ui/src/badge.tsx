import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * Badge — 상태·카운트 표시. 상태는 색 단독 전달 금지: 텍스트/아이콘 병행 (D-4).
 * 틴트 배경은 시맨틱 *-tint 토큰이라 다크모드 자동 스왑.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption",
  {
    variants: {
      variant: {
        neutral: "border border-line bg-surface-raised text-ink-muted",
        brand: "bg-primary-tint text-primary-tint-fg",
        accent: "bg-accent-tint text-accent-tint-fg",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning",
        danger: "bg-danger-tint text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
