import * as React from "react";
import { cn } from "./cn";

/**
 * StreakBadge — Phase 2(F-GAM-05) 대비 스켈레톤. 로직·보상 연동 없음.
 *
 * 금지 (A3 §3.2 죄책감 카피 금지 — 컴포넌트 레벨 집행):
 * - "곧 끊겨요"·"물거품" 류 손실 공포 문구, 카운트다운 결합, 끊김 상태의
 *   danger 색 사용. 끊겨도 시각 강등(중립색)만 하고 새 시작 카피는 화면 몫.
 */
export interface StreakBadgeProps {
  /** 연속 일수 */
  days: number;
  /** 유지 중 여부 — false 여도 부정적 연출 금지, 중립 표시만 */
  active?: boolean;
  className?: string;
}

export function StreakBadge({ days, active = true, className }: StreakBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold",
        active
          ? "bg-accent-tint text-accent-tint-fg"
          : "border border-line bg-surface-raised text-ink-muted",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="currentColor"
      >
        <path d="M8 1.5c.6 2.2-.6 3.4-1.6 4.6C5.3 7.4 4.5 8.6 4.5 10a3.5 3.5 0 0 0 7 0c0-1-.4-1.9-1-2.7-.3 1-.9 1.6-1.5 1.6.4-1.9-.1-4.9-1-7.4Z" />
      </svg>
      {days}일째 함께하고 있어요
    </span>
  );
}
