import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * Avatar — 사진이 없으면 닉네임 첫 글자 이니셜 폴백.
 * 덕메이트는 "첫 화면이 사진이 아니라 덕질카드" — 사진 없는 유저(P4)도
 * 어색하지 않게 이니셜 폴백을 1급으로 취급한다 (PRD M6).
 */
const avatarVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-tint font-semibold text-primary-tint-fg",
  {
    variants: {
      size: {
        sm: "size-8 text-body-sm",
        md: "size-12 text-h3",
        lg: "size-20 text-h1",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  /** 닉네임 — 이니셜 폴백과 대체 텍스트에 사용 */
  name: string;
  src?: string;
  alt?: string;
  className?: string;
}

export function Avatar({ name, src, alt, size, className }: AvatarProps) {
  return (
    <span
      role={src ? undefined : "img"}
      aria-label={src ? undefined : name}
      className={cn(avatarVariants({ size }), className)}
    >
      {src ? (
        <img src={src} alt={alt ?? name} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1)}</span>
      )}
    </span>
  );
}
