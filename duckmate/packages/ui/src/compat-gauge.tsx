import * as React from "react";
import { cn } from "./cn";

/**
 * CompatGauge — 궁합 게이지. 브랜드 시그니처 순간 (C1 §3.3).
 * - % 숫자는 stat-number 스타일: weight 800, tabular-nums, % 기호 0.5em.
 * - 색: hero(56px)=accent(라이트 accent-500·다크 accent-400 자동),
 *   inline(22px)=accent-text(라이트 accent-700) + 다크는 accent-400.
 * - "재미용" 고지는 생략 불가 — 궁합 %가 보이는 모든 화면 필수 (AdSense/품질 정책).
 * - 수치는 게이지 색 + 숫자 텍스트로 이중 전달 (색 단독 금지).
 */
export interface CompatGaugeProps {
  /** 0~100 — 범위 밖 값은 잘라낸다 */
  percent: number;
  /** hero: 리빌·궁합 카드(56px) / inline: 리스트·요약(22px) */
  size?: "hero" | "inline";
  /** 설명 가능한 매칭 — 이유 최대 3줄 (body-sm/ink-muted: 숫자는 뜨겁게, 근거는 차분하게) */
  reasons?: readonly string[];
  /** "재미용" 고지 문구 — 항상 렌더된다. 빈 문자열 금지 */
  noticeText?: string;
  className?: string;
}

export function CompatGauge({
  percent,
  size = "hero",
  reasons,
  noticeText = "궁합은 재미와 추천용이에요",
  className,
}: CompatGaugeProps) {
  const pct = Math.round(Math.min(100, Math.max(0, percent)));
  const hero = size === "hero";

  return (
    <div
      className={cn("flex w-full flex-col gap-3", hero && "items-center text-center", className)}
    >
      <p
        className={cn(
          "stat-number",
          hero
            ? "text-stat-hero text-accent"
            : "text-stat-inline text-accent-text dark:text-accent-400",
        )}
      >
        {pct}
        <span className="stat-number-unit">%</span>
      </p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`궁합 ${pct}퍼센트`}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>

      {reasons && reasons.length > 0 && (
        <ul
          aria-label="궁합 이유"
          className={cn("flex flex-col gap-1 text-body-sm text-ink-muted", !hero && "text-left")}
        >
          {reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <p className="text-caption text-ink-muted">{noticeText}</p>
    </div>
  );
}
