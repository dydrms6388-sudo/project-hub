import * as React from "react";
import { cn } from "./cn";

/**
 * VerifyLevelBadge — 인증 레벨 0~3 표시 (A5 §1, PRD 공통 확정 2항).
 * 레벨 의미는 서버 게이트와 동일: 0 미인증 / 1 휴대폰 / 2 본인 인증(매칭·채팅 가능)
 * / 3 사진 인증. 레벨명·색은 여기서만 정의 — 화면별 재정의 금지.
 * 텍스트를 항상 병기해 색 단독 전달을 피한다 (D-4).
 */
export type VerifyLevel = 0 | 1 | 2 | 3;

const LEVEL_META: Record<VerifyLevel, { label: string; className: string }> = {
  0: { label: "미인증", className: "border border-line bg-surface-raised text-ink-muted" },
  1: { label: "휴대폰 인증", className: "bg-primary-tint text-primary-tint-fg" },
  2: { label: "본인 인증", className: "bg-success-tint text-success" },
  3: { label: "사진 인증", className: "bg-primary text-primary-fg" },
};

export interface VerifyLevelBadgeProps {
  level: VerifyLevel;
  /** true 면 "Lv.N" 숫자 생략하고 라벨만 (좁은 지면용) */
  compact?: boolean;
  className?: string;
}

export function VerifyLevelBadge({ level, compact = false, className }: VerifyLevelBadgeProps) {
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption",
        meta.className,
        className,
      )}
    >
      {level >= 2 && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        </svg>
      )}
      {compact ? meta.label : `Lv.${level} ${meta.label}`}
    </span>
  );
}
