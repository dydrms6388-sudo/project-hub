import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * Button — 주 CTA는 primary 하나만, 화면당 accent 는 감정 피크 1곳만 (C1 §2.1).
 *
 * 하드룰 (C1 D-4):
 * - accent 변형은 코랄 배경 + `accent-fg`(어두운 잉크) 텍스트. 백색 텍스트 금지.
 * - 거절/닫기 등 보조 버튼(ghost)은 수락 버튼 대비 최소 70% 크기 — size 를
 *   두 단계 이상 낮추지 말 것 (lg 수락이면 거절은 md 이상).
 */
const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        /** 주 CTA — 라이트 brand-600/백색(7.83:1), 다크 brand-300/brand-900 자동 스왑 */
        primary: "bg-primary text-primary-fg hover:bg-primary-strong active:bg-primary-strong",
        /** 감정 피크 전용(좋아요·리빌 CTA). 텍스트는 항상 어두운 잉크 */
        accent: "bg-accent text-accent-fg hover:bg-accent-600 active:bg-accent-600",
        /** 보조·거절·닫기 */
        ghost: "border border-line bg-transparent text-ink hover:bg-primary/10 active:bg-primary/15",
        /** 신고·차단·탈퇴 — 배경은 모드 불변 danger-solid(백색 텍스트 4.80:1) */
        danger: "bg-danger-solid text-white hover:bg-danger-600 active:bg-danger-700",
      },
      size: {
        sm: "h-9 px-4 text-body-sm",
        md: "h-11 px-6 text-body",
        lg: "h-13 px-8 text-body",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** true 면 스피너 표시 + 클릭 차단 + aria-busy */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
