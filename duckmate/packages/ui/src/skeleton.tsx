import * as React from "react";
import { cn } from "./cn";

/**
 * Skeleton — 로딩 플레이스홀더. 크기는 className 으로 지정 (예: "h-4 w-32").
 * 스크린리더에는 숨긴다 — 로딩 상태 고지는 컨테이너의 aria-busy 로.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-line motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
