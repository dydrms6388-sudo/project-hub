import { cn } from "@duckmate/ui";
import { SERVICE_NAME } from "@/config/company";

/** 덕 마크 심볼 (10_brand §5.1 SVG 그대로) + 워드마크. 색은 토큰 유틸(fill-primary/accent/background). */
export function DuckMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={cn("shrink-0", className)}>
      <path className="fill-primary" d="M30 8a22 22 0 1 1-9.6 41.8L12 60l2.6-13.2A22 22 0 0 1 30 8z" />
      <path className="fill-accent" d="M49 23c9 2 13 5 13 7s-4 5-13 7z" />
      <circle cx="40" cy="26" r="2.75" className="fill-background" />
    </svg>
  );
}

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <DuckMark size={size} />
      <span className="text-h3 font-extrabold tracking-[-0.02em] text-foreground">
        {SERVICE_NAME}
      </span>
    </span>
  );
}
