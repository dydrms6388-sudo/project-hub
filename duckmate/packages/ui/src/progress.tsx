import * as React from "react";
import { cn } from "./cn";

/**
 * Progress — 온보딩 진행률 등. 게이지 채움은 brand-500 (D-4 하드룰 2:
 * brand-500 은 그래픽·게이지 전용, 텍스트 배경 아님).
 * 진행 상태는 색 단독 금지 — label 이나 인접 텍스트로 단계 병기할 것.
 */
export interface ProgressProps {
  /** 현재 값 (0 ~ max) */
  value: number;
  max?: number;
  /** 스크린리더용 라벨 (예: "온보딩 3단계 중 2단계") */
  label?: string;
  className?: string;
}

export function Progress({ value, max = 100, label, className }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(safeMax, Math.max(0, value));
  const percent = (clamped / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-300 dark:bg-brand-400 motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
