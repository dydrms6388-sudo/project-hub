"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Button — 10_brand: 버튼 radius 12px(완전 원형 금지), 텍스트 600.
 * accent(코랄) 위 글자는 흰색이 아니라 neutral-900 → 토큰 `text-accent-foreground`(#1C1A17) 사용.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-button transition-[background-color,color,opacity,transform] duration-(--duration-fast) ease-(--ease-enter) select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        accent: "bg-accent text-accent-foreground hover:opacity-90",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline h-auto px-0",
      },
      size: {
        sm: "h-9 px-3 text-button-sm [&_svg]:size-4",
        md: "h-12 px-5",
        lg: "h-14 px-6",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Radix Slot: 자식 요소(Next Link 등)에 스타일을 위임 */
  asChild?: boolean;
  /** 로딩 중이면 스피너 + disabled + aria-busy */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        type={asChild ? undefined : (props.type ?? "button")}
        {...props}
      >
        {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
