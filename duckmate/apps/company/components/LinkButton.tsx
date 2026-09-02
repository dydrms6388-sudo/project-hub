import Link from "next/link";
import type * as React from "react";
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

/**
 * 비활성 CTA (앱 주소 미설정) — `@duckmate/ui` Button 은 "use client" 라 홈·헤더에 클라이언트 청크를 끌어온다.
 * 눌리지 않는 버튼에는 JS 가 필요 없으므로 서버 렌더 `<button disabled>` 로 대체한다(H2, 27_fe_quality 결정 16).
 */
export function DisabledButton({ variant = "default", size = "md", className, children, ...props }: Omit<LinkButtonProps, "href">) {
  return (
    <button type="button" disabled className={cn(linkButtonClass(variant, size, className), "disabled:pointer-events-none disabled:opacity-50")} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
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
