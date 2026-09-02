import * as React from "react";
import { cn } from "../../lib/cn";

export interface OnboardingProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 현재 단계 (1-based) */
  current: number;
  /** 총 단계. 기본 7 (S1 연령·S2 휴대폰·S3 기본·S4 취미·S5 퀴즈·S6 카드·S7 사진). 12_flows처럼 6칸 표기하려면 total=6 */
  total?: number;
  /** 우측 "n/total" 숫자 표시 */
  showCount?: boolean;
  /** 각 단계 이름(스크린리더용) */
  labels?: string[];
}

export const ONBOARDING_STEPS = ["연령 확인", "휴대폰 인증", "기본 정보", "취미 선택", "궁합 퀴즈", "덕질 카드", "사진"] as const;

/**
 * OnboardingProgress — 상단 진행 바(칸 분할). 카운트다운·"탈락" 표현 없음.
 * role="progressbar" + aria-valuetext "3/7 기본 정보".
 */
export const OnboardingProgress = React.forwardRef<HTMLDivElement, OnboardingProgressProps>(
  ({ current, total = 7, showCount = true, labels, className, ...props }, ref) => {
    const t = Math.max(1, total);
    const c = Math.max(1, Math.min(t, current));
    const stepLabel = (labels ?? ONBOARDING_STEPS)[c - 1];
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={t}
        aria-valuenow={c}
        aria-valuetext={stepLabel ? `${c}/${t} ${stepLabel}` : `${c}/${t}`}
        className={cn("flex items-center gap-3", className)}
        {...props}
      >
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {Array.from({ length: t }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-(--duration-base) ease-(--ease-enter)",
                i < c ? "bg-primary" : "bg-sand-200 dark:bg-input",
              )}
            />
          ))}
        </div>
        {showCount ? (
          <span className="tnum shrink-0 text-caption text-muted-foreground" aria-hidden="true">
            {c}/{t}
          </span>
        ) : null}
      </div>
    );
  },
);
OnboardingProgress.displayName = "OnboardingProgress";
