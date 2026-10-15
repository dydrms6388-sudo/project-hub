"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { hobbyIcon } from "../../lib/hobby-icons";
import { Sprout } from "lucide-react";
import { cn } from "../../lib/cn";
import { BEGINNER_WELCOME_MAX_INTENSITY, HOBBY_BY_SLUG, ICON, isHobbyCategorySlug, type Intensity } from "../../tokens";
import { IntensityDots } from "./IntensityDots";

export interface HobbyChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  /** 취미 카테고리 slug → 아이콘·이모지 자동. 세부 태그는 카테고리 아이콘 상속 */
  category?: string;
  /** 아이콘 직접 지정(카테고리보다 우선) */
  icon?: LucideIcon;
  /** 아이콘 대신 이모지 사용 */
  glyph?: "icon" | "emoji" | "none";
  /** 선택 상태(온보딩 선택) */
  selected?: boolean;
  /** 겹침 강조(추천 카드에서 나와 겹치는 취미) — 코랄 소프트 칩 */
  highlighted?: boolean;
  /** 몰입도 표시 */
  intensity?: Intensity;
  /** Top3 순위 표시(1~3) */
  rank?: number;
  /** "입문 환영" 배지 강제. 생략 시 intensity ≤ 2 이면 자동 */
  beginnerWelcome?: boolean;
  size?: "sm" | "md";
  /** onClick 없이도 버튼으로 렌더 */
  interactive?: boolean;
}

/**
 * HobbyChip — 취미 칩. radius 9999px. 아이콘 16px / stroke 2 (10_brand §6.1).
 * 선택 = primary-100 배경 + primary-700 텍스트(L8 7.23), 겹침 강조 = coral-100 + coral-800(L13 6.71),
 * "입문 환영" = secondary 라일락 칩 + sprout (결정사항 22).
 */
export const HobbyChip = React.forwardRef<HTMLButtonElement, HobbyChipProps>(
  (
    { label, category, icon, glyph = "icon", selected = false, highlighted = false, intensity, rank, beginnerWelcome, size = "md", interactive, className, onClick, disabled, type, ...props },
    ref,
  ) => {
    const cat = category && isHobbyCategorySlug(category) ? HOBBY_BY_SLUG[category] : undefined;
    const IconComp: LucideIcon | undefined = icon ?? hobbyIcon(cat?.iconExport);
    const showBeginner = beginnerWelcome ?? (intensity !== undefined && intensity <= BEGINNER_WELCOME_MAX_INTENSITY);
    const isButton = interactive ?? Boolean(onClick);

    const classes = cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border transition-colors duration-(--duration-fast) ease-(--ease-enter)",
      size === "sm" ? "h-7 px-2.5 text-caption" : "h-9 px-3 text-label",
      highlighted
        ? "border-transparent bg-coral-100 text-coral-800 dark:bg-coral-900 dark:text-coral-200"
        : selected
          ? "border-primary bg-violet-100 text-violet-700 dark:bg-violet-800 dark:text-violet-200"
          : "border-border bg-card text-foreground",
      isButton && !disabled && "cursor-pointer hover:bg-muted active:scale-[0.98]",
      isButton && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      disabled && "opacity-50 cursor-not-allowed",
      className,
    );

    const content = (
      <>
        {rank !== undefined ? (
          <span className="tnum -ml-1 inline-flex size-5 items-center justify-center rounded-full bg-foreground/10 text-caption" aria-label={`${rank}순위`}>
            {rank}
          </span>
        ) : null}
        {glyph === "emoji" && cat ? (
          <span aria-hidden="true" className="text-[14px] leading-none">{cat.emoji}</span>
        ) : glyph === "icon" && IconComp ? (
          <IconComp size={ICON.chipSize} strokeWidth={ICON.chipStroke} aria-hidden="true" className="shrink-0" />
        ) : null}
        <span className="truncate">{label}</span>
        {intensity !== undefined ? <IntensityDots value={intensity} size="sm" tone="inherit" className="ml-0.5 opacity-90" /> : null}
        {showBeginner ? (
          <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-px text-caption text-secondary-foreground">
            <Sprout size={12} strokeWidth={2} aria-hidden="true" />
            입문 환영
          </span>
        ) : null}
      </>
    );

    if (!isButton) {
      return (
        <span ref={ref as unknown as React.Ref<HTMLSpanElement>} className={classes} {...(props as React.HTMLAttributes<HTMLSpanElement>)}>
          {content}
        </span>
      );
    }
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-pressed={onClick ? selected : undefined}
        disabled={disabled}
        onClick={onClick}
        className={classes}
        {...props}
      >
        {content}
      </button>
    );
  },
);
HobbyChip.displayName = "HobbyChip";
