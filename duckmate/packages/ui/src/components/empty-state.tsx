import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { ICON } from "../tokens";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** lucide 아이콘(48px, stroke 1.25, #A493C4) 또는 이모지 1개 */
  icon?: LucideIcon | string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 대체 행동 버튼 1개 (12_flows §8: 빈 상태마다 대체 행동 1개, 자책 카피 금지) */
  action?: React.ReactNode;
  /** 제목 요소. 화면 전체가 빈 상태 하나뿐이면 `h1`(페이지당 h1 1개 — G1 §19 접근성). 기본 h3 */
  as?: "h1" | "h2" | "h3";
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, as: Heading = "h3", className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col items-center px-6 py-12 text-center", className)} {...props}>
      {icon ? (
        typeof icon === "string" ? (
          <span className="mb-4 text-[40px] leading-none" aria-hidden="true">{icon}</span>
        ) : (
          React.createElement(icon, { size: ICON.emptySize, strokeWidth: ICON.emptyStroke, color: ICON.emptyColor, "aria-hidden": true, className: "mb-4" })
        )
      ) : null}
      <Heading className="text-h3 text-foreground">{title}</Heading>
      {description ? <p className="mt-1.5 max-w-xs text-body-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
