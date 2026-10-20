import type { ProfileCard } from "@/lib/types";
import {
  ACTIVE_TIMES,
  AVAILABILITY,
  BODY_TYPES,
  DRINKING,
  INTERESTS,
  labelOf,
  PERSONALITIES,
  POSITIONS,
  PRESENCE,
  PURPOSES,
  SMOKING,
  STYLES,
} from "./options";

export function regionLabel(p: Pick<ProfileCard, "sido" | "sigungu" | "dong">): string {
  return [p.sido, p.sigungu, p.dong].filter(Boolean).join(" ");
}

export function presenceLabel(p: ProfileCard["presence"]) {
  return labelOf(PRESENCE, p);
}

export function availabilityLabel(a: ProfileCard["availability"]) {
  return labelOf(AVAILABILITY, a);
}

/** 카드에 쓸 짧은 요약: "178cm · 슬림탄탄 · 올" */
export function bodySummary(p: ProfileCard): string {
  return [
    p.height ? `${p.height}cm` : null,
    p.weight ? `${p.weight}kg` : null,
    p.body_type ? labelOf(BODY_TYPES, p.body_type as never) : null,
    p.position ? labelOf(POSITIONS, p.position as never) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type DetailSection = { title: string; items: string[] };

/** 상세 화면 섹션 (공개된 정보만 — 뷰에서 이미 마스킹됨) */
export function detailSections(p: ProfileCard): DetailSection[] {
  const map = <T extends string>(opts: readonly { value: T; label: string }[], arr: string[]) =>
    arr.map((v) => labelOf(opts, v as T));
  const sections: DetailSection[] = [
    { title: "만남 목적", items: map(PURPOSES, p.purposes) },
    { title: "외모 스타일", items: map(STYLES, p.styles) },
    { title: "성격", items: map(PERSONALITIES, p.personality) },
    { title: "관심사", items: map(INTERESTS, p.interests) },
    { title: "활동 시간대", items: map(ACTIVE_TIMES, p.active_times) },
    {
      title: "라이프스타일",
      items: [
        p.smoking ? `흡연: ${labelOf(SMOKING, p.smoking as never)}` : null,
        p.drinking ? `음주: ${labelOf(DRINKING, p.drinking as never)}` : null,
      ].filter((x): x is string => !!x),
    },
  ];
  return sections.filter((s) => s.items.length > 0);
}
