// =============================================================================
// E2 · 링크형 CTA — <Button> 은 <button> 이라 네비게이션에 쓸 수 없어서,
// 동일한 토큰/크기 규칙(C2 D-5-4: 보조 버튼은 주 CTA 의 70% 이상)을 유지한 채
// next/link 로 렌더하는 얇은 래퍼. 색은 시맨틱 토큰만 사용한다.
// =============================================================================

import Link from "next/link";
import { cn } from "@duckmate/ui";

const VARIANT = {
  primary: "bg-primary text-primary-fg hover:bg-primary-strong",
  ghost: "border border-line text-ink hover:bg-primary/10",
} as const;

const SIZE = {
  sm: "h-9 px-4 text-body-sm",
  md: "h-11 px-6 text-body",
  lg: "h-13 px-8 text-body",
} as const;

export interface LinkButtonProps {
  href: string;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}
