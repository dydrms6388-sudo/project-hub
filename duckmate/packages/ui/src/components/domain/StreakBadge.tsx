import * as React from "react";

/**
 * StreakBadge — Phase 2 (F3 스트릭·퀘스트) 전용.
 * ⚠️ 이 파일은 props 타입과 빈 껍데기만 둔다. 렌더 구현 금지(Phase 1에서 스트릭 UI 미노출, PRD Phase 게이트).
 * F3가 Phase 2에서 구현하며, 스트릭 끊김 카피는 10_brand §4.5 #31("스트릭은 다시 1일부터. 지난 기록은 사라지지 않아요") 사용.
 */
export interface StreakBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 연속 일수 */
  days: number;
  /** 오늘 카드 확인 여부 */
  todayDone?: boolean;
  /** 끊김 상태(자책 카피 금지) */
  broken?: boolean;
  size?: "sm" | "md";
}

/** Phase 1: 아무것도 렌더하지 않는다. */
export const StreakBadge = React.forwardRef<HTMLSpanElement, StreakBadgeProps>(function StreakBadge(_props, _ref) {
  return null;
});
StreakBadge.displayName = "StreakBadge";
