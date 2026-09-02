import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@duckmate/ui";

/**
 * 링크를 버튼처럼 — 서버 컴포넌트용(JS 0).
 * `@duckmate/ui` Button 의 클래스와 동일하게 유지한다(buttonVariants 는 "use client" 모듈이라 서버에서 호출 불가,
 * Button asChild 는 loading 슬롯 때문에 Slot 자식이 2개가 되어 실패 — ui 수정 요청 사항).
 */
const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-button transition-[background-color,color,opacity,transform] duration-(--duration-fast) ease-(--ease-enter) select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]";
const VARIANT = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
  accent: "bg-accent text-accent-foreground hover:opacity-90",
  outline: "border border-input bg-card text-foreground hover:bg-muted",
} as const;
const SIZE = { sm: "h-9 px-3 text-button-sm", md: "h-12 px-5", lg: "h-14 px-6" } as const;

export interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  children: ReactNode;
}

export function linkButtonClass(variant: keyof typeof VARIANT = "default", size: keyof typeof SIZE = "md", className?: string) {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export function LinkButton({ href, variant = "default", size = "md", className, children, ...props }: LinkButtonProps) {
  const cls = linkButtonClass(variant, size, className);
  const internal = href.startsWith("/") && !href.startsWith("//");
  return internal ? (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls} {...props}>
      {children}
    </a>
  );
}
