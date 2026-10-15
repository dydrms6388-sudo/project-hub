"use client";

import * as React from "react";
import { cn } from "../../lib/cn";
import { MOTION } from "../../tokens";
import { Button } from "../button";

export type MatchRevealVariant = "simple" | "scratch";

export interface MatchRevealProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * 'simple' = Phase 1 구현(페이드 + 두 카드 나란히, ≤1.2s, 건너뛰기).
   * 'scratch' = Phase 2 F2 예약. 현재는 타입만 두고 'simple'로 폴백한다.
   */
  variant?: MatchRevealVariant;
  /** 내 카드 (DuckCard compact 권장) */
  left: React.ReactNode;
  /** 상대 카드 */
  right: React.ReactNode;
  /** 겹치는 취미 라벨 → 코랄 점등 */
  overlapLabels?: string[];
  /** 헤드라인, 기본 "매칭됐어요 🎉" (10_brand §4.5 #19 — 이모지는 문장 끝 1개) */
  headline?: string;
  /** 총 길이 ms, 기본 1200 (상한 MOTION.matchRevealMax) */
  durationMs?: number;
  /** 리빌 종료(자동 또는 건너뛰기) 시 1회 호출 */
  onDone?: () => void;
  skipLabel?: string;
}

type Stage = 0 | 1 | 2 | 3; // 0 대기, 1 카드 진입, 2 태그 점등, 3 헤드라인

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * MatchReveal — 10_brand §7.3 순서: 카드 좌우 진입 200ms → 겹침 태그 코랄 점등 260ms → 헤드라인 페이드 200ms.
 * 총 ≤ 1.2s, 언제든 건너뛰기. reduce-motion이면 리빌 생략(즉시 완료 상태). 햅틱·소리·파티클 없음.
 * 리빌 앞뒤에 광고·결제 유도 금지.
 */
export const MatchReveal = React.forwardRef<HTMLDivElement, MatchRevealProps>(
  (
    { variant = "simple", left, right, overlapLabels = [], headline = "매칭됐어요 🎉", durationMs = MOTION.matchRevealMax, onDone, skipLabel = "건너뛰기", className, ...props },
    ref,
  ) => {
    // 'scratch'는 Phase 2(F2). 지금은 simple로 폴백.
    void variant;
    const reduced = usePrefersReducedMotion();
    const total = Math.min(durationMs, MOTION.matchRevealMax);
    const [stage, setStage] = React.useState<Stage>(0);
    const doneRef = React.useRef(false);
    const onDoneRef = React.useRef(onDone);
    React.useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    const finish = React.useCallback(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setStage(3);
      onDoneRef.current?.();
    }, []);

    React.useEffect(() => {
      if (reduced) { finish(); return; }
      const t1 = window.setTimeout(() => setStage(1), 0);
      const t2 = window.setTimeout(() => setStage(2), Math.round(total * 0.2)); // 200/1200
      const t3 = window.setTimeout(() => setStage(3), Math.round(total * 0.42)); // 200+260 → 헤드라인 시작
      const t4 = window.setTimeout(finish, total);
      return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); window.clearTimeout(t4); };
    }, [reduced, total, finish]);

    const cardCls = (dir: "l" | "r") =>
      cn(
        "min-w-0 flex-1 transition-[opacity,transform] duration-(--duration-base) ease-(--ease-enter)",
        stage >= 1 ? "opacity-100 translate-x-0" : cn("opacity-0", dir === "l" ? "-translate-x-4" : "translate-x-4"),
      );

    return (
      <div ref={ref} className={cn("flex flex-col items-center gap-4", className)} role="status" aria-live="polite" {...props}>
        <h2 className={cn("text-display text-center transition-opacity duration-(--duration-base)", stage >= 3 ? "opacity-100" : "opacity-0")}>
          {headline}
        </h2>
        <div className="flex w-full items-stretch gap-3">
          <div className={cardCls("l")}>{left}</div>
          <div className={cardCls("r")}>{right}</div>
        </div>
        {overlapLabels.length > 0 ? (
          <p className="text-body-sm text-muted-foreground">
            겹치는 취미:{" "}
            {overlapLabels.map((l, i) => (
              <React.Fragment key={`${l}-${i}`}>
                {i > 0 ? " · " : null}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 transition-colors duration-(--duration-sheet)",
                    stage >= 2 ? "bg-coral-100 text-coral-800 dark:bg-coral-900 dark:text-coral-200" : "bg-muted text-muted-foreground",
                  )}
                >
                  {l}
                </span>
              </React.Fragment>
            ))}
          </p>
        ) : null}
        {!doneRef.current && stage < 3 ? (
          <Button variant="ghost" size="sm" onClick={finish}>
            {skipLabel}
          </Button>
        ) : null}
      </div>
    );
  },
);
MatchReveal.displayName = "MatchReveal";
