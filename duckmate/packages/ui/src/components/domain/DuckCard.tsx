"use client";

import * as React from "react";
import { Clock, MapPin, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { BEGINNER_WELCOME_MAX_INTENSITY, type HobbyCategorySlug, type Intensity, type VerifyLevel } from "../../tokens";
import { HobbyAvatar } from "../avatar";
import { CompatGauge } from "./CompatGauge";
import { HobbyChip } from "./HobbyChip";
import { VerifyBadge } from "./VerifyBadge";

export interface DuckCardHobby {
  /** 대분류 slug (아이콘·색) */
  category: HobbyCategorySlug | string;
  /** 표시 라벨(세부 태그명 또는 카테고리명) */
  label: string;
  intensity: Intensity;
  /** 나와 겹치는 취미 → 코랄 강조 */
  overlap?: boolean;
}

export interface DuckCardPhoto {
  src: string;
  alt?: string;
}

export interface DuckCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** 아바타 seed (profile id) */
  profileId: string;
  nickname: string;
  /** "20대 후반" — 생년월일 원본 금지 */
  ageBand: string;
  /** 구 단위까지만 ("마포구") */
  region: string;
  verifyLevel: VerifyLevel;
  /** Top3 (rank 순). 3개 초과분은 무시 */
  hobbies: DuckCardHobby[];
  /** 최애 (rank1 fav_note). 비우면 행 숨김 */
  favorite?: string | null;
  /** 요즘 빠진 것 (now_into, ≤40자) */
  nowInto?: string | null;
  /** 궁합 0~100. 생략 시 게이지 미표시(내 카드 미리보기) */
  compat?: number | null;
  /** 추천 이유(사람말). 상위 2개만 렌더 */
  reasons?: string[];
  /** 활동 시간대 겹침 텍스트 ("주말 아침 같음 · 3칸 겹침") */
  availabilityOverlap?: string | null;
  /** 같은 구 여부 → "같은 구" 표기 */
  sameRegion?: boolean;
  /** "같이 할 수 있는 것" 1줄 */
  suggestion?: string | null;
  /** 사진(승인분). 카드 본문 **아래**에만 렌더. 없으면 미렌더 */
  photos?: DuckCardPhoto[];
  /** 헤더 탭 → 전체 프로필 */
  onHeaderClick?: () => void;
  /** 하단 슬롯(사진 보기 버튼 등) */
  footer?: React.ReactNode;
  /** 헤더 우측 슬롯(⋮ 메뉴 등) */
  headerAction?: React.ReactNode;
  /** compact: 목록·미리보기용(게이지·이유 생략) */
  compact?: boolean;
}

/**
 * DuckCard — 덕질 카드 1면 (PRD §0-28 구성 고정 순서).
 * 헤더(닉네임·연령대·구·인증 마크·입문 환영) → Top3(겹침 강조·몰입도) → 최애 → 요즘 빠진 것 →
 * 궁합 % → 추천 이유 2줄 → 시간대 겹침·지역 → 같이 할 수 있는 것 → footer. 사진은 카드 아래.
 * 데이터 fetching 없음. 외모·인기·매력 라벨 없음.
 */
export const DuckCard = React.forwardRef<HTMLDivElement, DuckCardProps>(
  (
    {
      profileId, nickname, ageBand, region, verifyLevel, hobbies, favorite, nowInto, compat, reasons = [],
      availabilityOverlap, sameRegion, suggestion, photos, onHeaderClick, footer, headerAction, compact = false,
      className, ...props
    },
    ref,
  ) => {
    const top3 = hobbies.slice(0, 3);
    const beginner = top3.some((h) => h.intensity <= BEGINNER_WELCOME_MAX_INTENSITY);
    const primaryCategory = top3[0]?.category ?? "fandom";
    const overlapCount = top3.filter((h) => h.overlap).length;
    const shownReasons = reasons.slice(0, 2);
    const HeaderTag = onHeaderClick ? "button" : "div";

    return (
      <div ref={ref} className={cn("flex flex-col gap-3", className)} {...props}>
        <article className="rounded-lg border border-border bg-card p-4 text-card-foreground" aria-label={`${nickname} 덕질 카드`}>
          {/* 헤더 */}
          <div className="flex items-start gap-3">
            <HeaderTag
              type={onHeaderClick ? "button" : undefined}
              onClick={onHeaderClick}
              className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", onHeaderClick && "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
              aria-label={onHeaderClick ? `${nickname} 프로필 전체 보기` : undefined}
            >
              <HobbyAvatar seed={profileId} category={primaryCategory} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="text-h3 truncate">{nickname}</span>
                  <VerifyBadge level={verifyLevel} />
                </span>
                <span className="mt-0.5 block text-body-sm text-muted-foreground">
                  {ageBand} · {region}
                </span>
              </span>
            </HeaderTag>
            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
          </div>

          {/* Top3 */}
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="취미 Top3">
            {top3.map((h, i) => (
              <li key={`${h.category}-${h.label}-${i}`}>
                <HobbyChip label={h.label} category={h.category} intensity={h.intensity} highlighted={h.overlap} beginnerWelcome={false} size="md" />
              </li>
            ))}
            {beginner ? (
              <li>
                <HobbyChip label="입문 환영" glyph="none" beginnerWelcome={false} className="border-transparent bg-secondary text-secondary-foreground" />
              </li>
            ) : null}
          </ul>

          {/* 최애 / 요즘 빠진 것 */}
          {favorite || nowInto ? (
            <dl className="mt-4 space-y-1.5 text-body">
              {favorite ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">최애</dt>
                  <dd className="min-w-0 break-words">{favorite}</dd>
                </div>
              ) : null}
              {nowInto ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">요즘 빠진 것</dt>
                  <dd className="min-w-0 break-words">{nowInto}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {/* 궁합 + 이유 + 겹침 */}
          {!compact && typeof compat === "number" ? (
            <div className="mt-4 border-t border-border pt-4">
              <CompatGauge value={compat} />
              {shownReasons.length > 0 ? (
                <ul className="mt-3 space-y-1 text-body-sm text-foreground">
                  {shownReasons.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span aria-hidden="true" className="text-muted-foreground">·</span>
                      <span className="line-clamp-1">{r}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(overlapCount > 0 || availabilityOverlap || sameRegion) ? (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
                  {overlapCount > 0 ? (
                    <span className="inline-flex items-center gap-1"><Sparkles size={14} strokeWidth={2} aria-hidden="true" />겹치는 취미 <span className="tnum">{overlapCount}</span>개</span>
                  ) : null}
                  {availabilityOverlap ? (
                    <span className="inline-flex items-center gap-1"><Clock size={14} strokeWidth={2} aria-hidden="true" />{availabilityOverlap}</span>
                  ) : null}
                  {sameRegion ? (
                    <span className="inline-flex items-center gap-1"><MapPin size={14} strokeWidth={2} aria-hidden="true" />같은 구</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 같이 할 수 있는 것 */}
          {!compact && suggestion ? (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-body-sm">
              <span className="text-muted-foreground">같이 할 수 있는 것 </span>
              <span className="text-foreground">{suggestion}</span>
            </p>
          ) : null}

          {footer ? <div className="mt-4">{footer}</div> : null}
        </article>

        {/* 사진: 카드 아래에만 */}
        {photos && photos.length > 0 ? (
          <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1" aria-label={`${nickname} 사진 ${photos.length}장`}>
            {photos.map((p, i) => (
              <li key={`${p.src}-${i}`} className="snap-start shrink-0">
                <img src={p.src} alt={p.alt ?? `${nickname} 사진 ${i + 1}`} className="h-40 w-32 rounded-md object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
DuckCard.displayName = "DuckCard";
