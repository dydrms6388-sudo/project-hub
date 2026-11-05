/**
 * E2 표시용 순수 헬퍼 (서버·클라이언트 공용, 런타임 의존성 없음).
 *  - 연령대 라벨 / 지역 라벨 / DB 취미 카테고리(id·slug) → UI 카테고리 slug
 *  - RecoCard → DuckCard props 변환, reasons → 시간대 겹침·같은 구 추출
 */
import { HOBBY_CATEGORIES as DB_HOBBY_CATEGORIES, type AgeBand } from "@duckmate/db";
import type { DuckCardHobby } from "@duckmate/ui";
import { ageYearsKst } from "@/lib/onboarding/schemas";
import type { CardPerson, RecoCardView, RecoReasonLike } from "./types";

/** v_profile_public.age_band → 카드 표기 (생년월일 원본 금지) */
export const AGE_BAND_LABELS: Readonly<Record<AgeBand, string>> = {
  "20_early": "20대 초반",
  "20_mid": "20대 중반",
  "20_late": "20대 후반",
  "30_early": "30대 초반",
  "30_mid": "30대 중반",
  "30_late": "30대 후반",
  "40_plus": "40대 이상",
};

export function ageBandLabel(band: AgeBand | null | undefined): string {
  return band ? AGE_BAND_LABELS[band] : "연령대 비공개";
}

/** 내 프로필(profiles.birth_date) → age_band. SQL v_profile_public 의 경계와 동일 */
export function ageBandOf(birthDate: string | null | undefined, now = new Date()): AgeBand | null {
  if (!birthDate) return null;
  const y = ageYearsKst(birthDate, now);
  if (y < 24) return "20_early";
  if (y < 27) return "20_mid";
  if (y < 30) return "20_late";
  if (y < 34) return "30_early";
  if (y < 37) return "30_mid";
  if (y < 40) return "30_late";
  return "40_plus";
}

/** 구 단위까지만. 시도 폴백 행이면 "서울 전체" 같은 sigungu 값이 그대로 온다 */
export function regionLabel(sigungu: string | null | undefined, sido: string | null | undefined): string {
  return sigungu ?? sido ?? "지역 비공개";
}

/** DB(hobby_categories.slug, 14_schema) → @duckmate/ui HOBBY_CATEGORIES slug(11_design_system) */
export const DB_TO_UI_CATEGORY: Readonly<Record<string, string>> = {
  performance: "fandom",
  boardgame: "boardgame",
  fitness: "fitness",
  anime: "anime",
  gaming: "game",
  cafe: "cafe",
  reading: "book",
  photo: "photo",
  coding: "code",
  travel: "travel",
  music: "music",
  pets: "pet",
};

const DB_CATEGORY_SLUG_BY_ID: ReadonlyMap<number, string> = new Map(DB_HOBBY_CATEGORIES.map((c) => [c.id, c.slug]));

export function uiCategoryOf(categoryId: number): string {
  const dbSlug = DB_CATEGORY_SLUG_BY_ID.get(categoryId) ?? "performance";
  return DB_TO_UI_CATEGORY[dbSlug] ?? "fandom";
}

export function uiCategoryOfSlug(dbSlug: string): string {
  return DB_TO_UI_CATEGORY[dbSlug] ?? "fandom";
}

/** reasons(jsonb, 16_matching §0-4) → DuckCard 보조 표기 */
export function reasonExtras(reasons: ReadonlyArray<RecoReasonLike>): { availabilityOverlap: string | null; sameRegion: boolean } {
  let availabilityOverlap: string | null = null;
  let sameRegion = false;
  for (const r of reasons) {
    if (r.kind === "slot_overlap" && !availabilityOverlap) availabilityOverlap = r.label;
    if (r.kind === "region_same" && r.level === "sigungu") sameRegion = true;
  }
  return { availabilityOverlap, sameRegion };
}

/** "같이 할 수 있는 것" 1줄 = hobby_overlap 1순위 공통 취미 (A3 §4). 공통 없음 → null */
export function suggestionLine(hobbies: ReadonlyArray<{ name: string; isCommon: boolean; rank: number }>): string | null {
  const common = [...hobbies].filter((h) => h.isCommon).sort((a, b) => a.rank - b.rank)[0];
  return common ? `${common.name} 같이 하기` : null;
}

export function toDuckCardHobbies(hobbies: ReadonlyArray<{ name: string; categoryId: number; intensity: number; rank: number; isCommon: boolean }>): DuckCardHobby[] {
  return [...hobbies]
    .sort((a, b) => a.rank - b.rank)
    .map((h) => ({
      category: uiCategoryOf(h.categoryId),
      label: h.name,
      intensity: clampIntensity(h.intensity),
      overlap: h.isCommon,
    }));
}

export function clampIntensity(v: number): 1 | 2 | 3 | 4 | 5 {
  const n = Math.min(5, Math.max(1, Math.round(v)));
  return n as 1 | 2 | 3 | 4 | 5;
}

export function clampVerifyLevel(v: number): 0 | 1 | 2 | 3 {
  const n = Math.min(3, Math.max(0, Math.round(v)));
  return n as 0 | 1 | 2 | 3;
}

/** rank1 fav_note = "최애" 행 */
export function favoriteOf(hobbies: ReadonlyArray<{ rank: number; favNote: string | null }>): string | null {
  return hobbies.find((h) => h.rank === 1)?.favNote ?? null;
}

/** RecoCard → 카드 사람 정보(매칭 화면·시트 공용) */
export function personOfRecoCard(card: RecoCardView): CardPerson {
  return {
    profileId: card.profile.id,
    nickname: card.profile.nickname ?? "닉네임 없음",
    ageBand: card.profile.age_band,
    region: regionLabel(card.profile.sigungu, card.profile.sido),
    verifyLevel: clampVerifyLevel(card.profile.verify_level),
    hobbies: card.hobbies,
    favorite: favoriteOf(card.hobbies),
    nowInto: card.profile.now_into,
    bio: card.profile.bio,
    photoUrls: card.photoUrls,
  };
}

/** 07:00 리셋 정적 문구 (03_core_loop §0: 시각은 항상 고정 텍스트, 카운트다운 금지) */
export const RESET_TEXT = "내일 07:00";

/** 슈퍼라이크 잔여 표기 */
export function superlikeLabel(remaining: number | null | undefined): string {
  if (remaining === null || remaining === undefined) return "슈퍼라이크";
  return `슈퍼라이크 ${remaining}`;
}
