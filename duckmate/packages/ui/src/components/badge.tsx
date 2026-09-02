import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Badge — 칩·배지 radius 9999px. 색만으로 의미 전달 금지 → 아이콘/텍스트 동반.
 * 대비 검증(10_brand §2.5): primary L8, secondary L14, accent-soft L13, success/warning/danger/info 배너 텍스트 L16~L22.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-800 dark:text-violet-200",
        primary: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-coral-100 text-coral-800 dark:bg-coral-900 dark:text-coral-200",
        outline: "border-border bg-transparent text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        danger: "border-transparent bg-[#FDECEC] text-[#B02E2E] dark:bg-[#3A1F1F] dark:text-[#FF9B9B]",
        info: "border-transparent bg-info-soft text-info",
      },
      size: {
        sm: "h-5 px-2 text-caption",
        md: "h-6 px-2.5 text-caption",
        lg: "h-7 px-3 text-label",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, size, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
));
Badge.displayName = "Badge";
