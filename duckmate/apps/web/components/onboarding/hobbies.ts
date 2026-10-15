/**
 * 취미 상수 — supabase/migrations/20260902000013 `hobby_categories`(12) · `hobbies`(60) 시드 미러.
 * 런타임은 서버 페이지가 DB 를 우선 읽고 실패 시 폴백. ID 는 시드와 동일(profile_hobbies.hobby_id).
 * `@duckmate/ui` 의 HOBBY_CATEGORIES slug(fandom·game·book·code·pet)와 DB slug(performance·gaming·reading·coding·pets)가 다르므로
 * HobbyChip/HobbyAvatar 의 `category` prop 에는 `uiCategorySlug()` 결과를 넘긴다.
 */
import { HOBBY_CATEGORIES as DB_CATEGORIES } from "@duckmate/db";

export type HobbyCategoryItem = { id: number; slug: string; name: string; icon: string; isInitial: boolean; sortOrder: number };
export type HobbyItem = { id: number; slug: string; name: string; categoryId: number; icon: string; sortOrder: number };

export const HOBBY_CATEGORIES_FALLBACK: readonly HobbyCategoryItem[] = DB_CATEGORIES.map((c) => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  icon: c.icon,
  isInitial: c.isInitial,
  sortOrder: c.id,
}));

const H = (id: number, slug: string, name: string, categoryId: number, icon: string, sortOrder: number): HobbyItem => ({ id, slug, name, categoryId, icon, sortOrder });

export const HOBBIES_FALLBACK: readonly HobbyItem[] = [
  H(1, "idol", "아이돌 덕질", 1, "💜", 1), H(2, "concert", "콘서트·페스티벌", 1, "🎪", 2), H(3, "musical", "뮤지컬·연극", 1, "🎭", 3), H(4, "fan_goods", "굿즈·팬아트", 1, "🧸", 4), H(5, "indie_live", "인디 공연·라이브", 1, "🎸", 5),
  H(6, "boardgame", "보드게임", 2, "🎲", 1), H(7, "trpg", "TRPG", 2, "🐉", 2), H(8, "escape_room", "방탈출·퍼즐", 2, "🔐", 3), H(9, "tcg", "TCG·카드게임", 2, "🃏", 4), H(10, "chess_go", "체스·바둑", 2, "♟️", 5),
  H(11, "running", "러닝", 3, "🏃", 1), H(12, "climbing", "클라이밍", 3, "🧗", 2), H(13, "gym", "헬스·크로스핏", 3, "🏋️", 3), H(14, "hiking", "등산·트레킹", 3, "⛰️", 4), H(15, "cycling", "자전거", 3, "🚴", 5),
  H(16, "anime", "애니메이션", 4, "📺", 1), H(17, "webtoon", "웹툰·만화", 4, "📖", 2), H(18, "cosplay", "코스프레", 4, "🪄", 3), H(19, "vtuber", "버튜버·스트리머", 4, "🎙️", 4), H(20, "figure", "피규어·프라모델", 4, "🤖", 5),
  H(21, "pc_game", "PC 게임", 5, "🖥️", 1), H(22, "console_game", "콘솔 게임", 5, "🎮", 2), H(23, "mobile_game", "모바일 게임", 5, "📱", 3), H(24, "rhythm_game", "리듬게임", 5, "🎧", 4), H(25, "esports", "e스포츠 관람", 5, "🏆", 5),
  H(26, "cafe_tour", "카페투어", 6, "☕", 1), H(27, "dessert", "디저트·베이커리", 6, "🍰", 2), H(28, "baking", "베이킹", 6, "🥐", 3), H(29, "coffee", "커피·홈카페", 6, "🫖", 4), H(30, "tea", "차·티룸", 6, "🍵", 5),
  H(31, "reading", "독서", 7, "📚", 1), H(32, "bookclub", "북클럽", 7, "🗣️", 2), H(33, "writing", "글쓰기", 7, "✍️", 3), H(34, "bookstore", "독립서점 탐방", 7, "🏬", 4), H(35, "essay", "에세이·인문", 7, "📝", 5),
  H(36, "photography", "사진·출사", 8, "📷", 1), H(37, "film_camera", "필름카메라", 8, "🎞️", 2), H(38, "exhibition", "전시·미술관", 8, "🖼️", 3), H(39, "movie", "영화", 8, "🎬", 4), H(40, "drama", "드라마·OTT", 8, "📺", 5),
  H(41, "coding", "코딩·사이드프로젝트", 9, "💻", 1), H(42, "maker", "전자공작·3D프린팅", 9, "🔧", 2), H(43, "design", "디자인·일러스트", 9, "🎨", 3), H(44, "ai_tools", "AI 도구", 9, "🤖", 4), H(45, "productivity", "생산성·노션", 9, "🗂️", 5),
  H(46, "domestic_travel", "국내 여행", 10, "🚄", 1), H(47, "overseas_travel", "해외 여행", 10, "✈️", 2), H(48, "walking", "산책·동네 탐방", 10, "🚶", 3), H(49, "camping", "캠핑", 10, "🏕️", 4), H(50, "roadtrip", "드라이브", 10, "🚗", 5),
  H(51, "instrument", "악기 연주", 11, "🎹", 1), H(52, "singing", "노래·노래방", 11, "🎤", 2), H(53, "band", "밴드", 11, "🥁", 3), H(54, "vinyl", "LP·음악 감상", 11, "💿", 4), H(55, "dance", "댄스", 11, "💃", 5),
  H(56, "dog", "강아지", 12, "🐶", 1), H(57, "cat", "고양이", 12, "🐱", 2), H(58, "plants", "식물·가드닝", 12, "🪴", 3), H(59, "aquarium", "물생활", 12, "🐠", 4), H(60, "small_pets", "소동물", 12, "🐹", 5),
];

/** DB 카테고리 slug → @duckmate/ui HOBBY_CATEGORIES slug */
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

export function uiCategorySlug(dbSlug: string): string {
  return DB_TO_UI_CATEGORY[dbSlug] ?? dbSlug;
}

export function categoryOf(categories: readonly HobbyCategoryItem[], categoryId: number): HobbyCategoryItem | undefined {
  return categories.find((c) => c.id === categoryId);
}

export function hobbyById(hobbies: readonly HobbyItem[], id: number): HobbyItem | undefined {
  return hobbies.find((h) => h.id === id);
}

/** 검색: 이름·slug·카테고리명 부분 일치(공백·대소문자 무시) */
export function searchHobbies(hobbies: readonly HobbyItem[], categories: readonly HobbyCategoryItem[], query: string): HobbyItem[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  return hobbies.filter((h) => {
    const cat = categoryOf(categories, h.categoryId);
    const hay = `${h.name}${h.slug}${cat?.name ?? ""}`.toLowerCase().replace(/[\s·]+/g, "");
    return hay.includes(q);
  });
}
