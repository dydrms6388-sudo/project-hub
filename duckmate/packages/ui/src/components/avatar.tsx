"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { cn } from "../lib/cn";
import { avatarFor, type HobbyCategorySlug } from "../tokens";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
const SIZE: Record<AvatarSize, string> = { sm: "size-8", md: "size-12", lg: "size-16", xl: "size-24" };
const PX: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 64, xl: 96 };

export interface HobbyAvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** seed — profile id 해시로 데코 위치 결정 */
  seed: string;
  /** rank 1 취미 카테고리 */
  category: HobbyCategorySlug | string;
  size?: AvatarSize;
  /** 전경: 이모지(기본) 또는 lucide 아이콘 */
  glyph?: "emoji" | "icon";
  /** 닉네임 첫 글자 1자 표시(기본 off) */
  initial?: string;
  /** 스크린리더용 이름 */
  name?: string;
}

/**
 * HobbyAvatar — 사진 없는 프로필의 취미 기반 결정론적 아바타 (10_brand §6.3).
 * 사람 실루엣·성별 기본색·랜덤 얼굴·외부 API 금지. 색은 카테고리 고정.
 */
export const HobbyAvatar = React.forwardRef<HTMLSpanElement, HobbyAvatarProps>(
  ({ seed, category, size = "md", glyph = "emoji", initial, name, className, style, ...props }, ref) => {
    const spec = avatarFor(seed, category);
    const px = PX[size];
    const IconComp = (Icons as unknown as Record<string, Icons.LucideIcon | undefined>)[spec.iconExport];
    const decorSize = Math.round(px * 0.42);
    return (
      <span
        ref={ref}
        role="img"
        aria-label={name ? `${name} 아바타` : "프로필 아바타"}
        className={cn("relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full", SIZE[size], className)}
        style={{ backgroundColor: spec.bg, color: spec.fg, ...style }}
        {...props}
      >
        {spec.decor !== "none" ? (
          <span
            aria-hidden="true"
            className="absolute rounded-full opacity-70"
            style={{
              width: decorSize,
              height: decorSize,
              backgroundColor: spec.decorColor,
              ...(spec.decor === "tl" ? { top: -decorSize * 0.35, left: -decorSize * 0.35 } : { bottom: -decorSize * 0.35, right: -decorSize * 0.35 }),
            }}
          />
        ) : null}
        {initial ? (
          <span className="relative font-bold" style={{ fontSize: px * 0.42, lineHeight: 1 }} aria-hidden="true">
            {initial.slice(0, 1)}
          </span>
        ) : glyph === "icon" && IconComp ? (
          <IconComp className="relative" size={Math.round(px * 0.5)} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <span className="relative" style={{ fontSize: px * 0.5, lineHeight: 1 }} aria-hidden="true">
            {spec.emoji}
          </span>
        )}
      </span>
    );
  },
);
HobbyAvatar.displayName = "HobbyAvatar";

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** 승인된 사진 URL. 없으면 HobbyAvatar 폴백 */
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  /** 폴백용 */
  seed: string;
  category: HobbyCategorySlug | string;
  glyph?: "emoji" | "icon";
}

/** Avatar — 사진이 있으면 이미지, 없으면(또는 로드 실패) HobbyAvatar. */
export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, alt, size = "md", seed, category, glyph, className, ...props }, ref) => {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);
    if (!src || failed) {
      return <HobbyAvatar ref={ref} seed={seed} category={category} size={size} glyph={glyph} name={alt} className={className} {...props} />;
    }
    return (
      <span ref={ref} className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted", SIZE[size], className)} {...props}>
        <img src={src} alt={alt ?? ""} className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  },
);
Avatar.displayName = "Avatar";
