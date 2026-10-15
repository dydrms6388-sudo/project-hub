import type { HTMLAttributes } from "react";
import { cn } from "@duckmate/ui";

/** 가로 폭 컨테이너: 최대 1024px, 좌우 20px. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-5xl px-5", className)} {...props} />;
}
