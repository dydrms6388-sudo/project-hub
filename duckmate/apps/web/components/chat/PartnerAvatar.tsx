"use client";

import { HOBBY_CATEGORIES, HobbyAvatar, hashString, type AvatarSize } from "@duckmate/ui";

/** 상대 아바타 — `get_chat_list` 에 취미 카테고리가 없어 partner_id 해시로 카테고리 색을 고른다(결정론적). 사진 서명 URL 은 D7 미제공 → HobbyAvatar 고정 */
export function partnerCategory(seed: string): string {
  const cats = HOBBY_CATEGORIES;
  return cats[hashString(seed) % cats.length]!.slug;
}

export function PartnerAvatar({ partnerId, nickname, size = "md", className }: { partnerId: string; nickname: string | null; size?: AvatarSize; className?: string }) {
  return <HobbyAvatar seed={partnerId} category={partnerCategory(partnerId)} size={size} name={nickname ?? "탈퇴한 사용자"} className={className} />;
}
