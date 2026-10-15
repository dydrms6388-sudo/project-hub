/**
 * 첫 대화 제안 카드 3장 — 룰 기반 템플릿 (A3 §5, PRD §0-41). LLM 호출 없음.
 *
 * 판정(16_matching §0-5): 템플릿은 **TS(여기)** 에 둔다. 매칭 생성 RPC(`act_on_recommendation`)가
 * `suggestion_input`(= `match_suggestion_input(match_id)`) 을 돌려주면 서버 액션이 `buildSuggestions()` 로
 * 3장을 만들어 `set_match_first_suggestion(match_id, cards)`(service, 비어 있을 때만) 로 기록한다.
 * 상대 화면이 먼저 열려 `first_suggestion` 이 비어 있으면 `getMatch()` 가 같은 함수로 자기 치유한다.
 *
 * 규칙
 *  - 3장 유형 고정: online(지금 온라인에서) / offline(오프라인 활동) / talk(최애·취미 질문). 기본 순서 online→offline→talk,
 *    오프모임 성향(같은 지역 + 겹치는 시간대 + 오프라인 친화 카테고리, friend 모드)이면 offline 을 앞으로.
 *  - 템플릿 requires: hobby(공통 취미) / fav(두 사람의 fav_note 가 같은 취미에서 동일) / same_region / common_slot.
 *    `{fav}` 는 카드가 양쪽에 공유되므로 **두 사람의 최애가 같을 때만** 사용(뷰어 중립).
 *  - 같은 두 사람의 3장은 서로 다른 template_id. 최근 30일 노출 템플릿(opts.recentTemplateIds)은 우선순위를 낮춘다.
 *  - 본문: 존댓말 1~2문장, 질문으로 끝남. 외모·장소 특정·연락처·시간 확정 표현 금지(테스트로 강제).
 *  - A3 18개 + 규칙("새 카테고리는 *-1 talk 동반")·유형 고정 폴백에 따른 11개 추가 = 29개.
 */
import type { FirstSuggestion } from "@duckmate/db";

export type SuggestionKind = FirstSuggestion["kind"];
export type TemplateRequire = "hobby" | "fav" | "same_region" | "common_slot";

export type SuggestionTemplate = {
  id: string;
  /** hobby_categories.slug 또는 'general' */
  category: string;
  /** 세부 취미 slug 로 더 좁힐 때 (예: climbing, running) */
  hobbySlugs?: string[];
  requires: TemplateRequire[];
  kind: SuggestionKind;
  title: string;
  body: string;
};

export const SUGGESTION_TEMPLATES: ReadonlyArray<SuggestionTemplate> = [
  // ---- A3 §5.3 (18) ----
  { id: "GAME-1", category: "gaming", requires: ["hobby"], kind: "online", title: "같이 한 판", body: "{hobby} 하시는군요! 저도 요즘 계속 하고 있어요. 주로 어떤 모드 하세요?" },
  { id: "GAME-2", category: "gaming", requires: ["hobby", "common_slot"], kind: "online", title: "듀오 시간 맞추기", body: "둘 다 {slot}에 시간이 맞는 것 같아요. 언제 한 번 같이 플레이해볼까요?" },
  { id: "ANIME-1", category: "anime", requires: ["fav"], kind: "talk", title: "최애 토크", body: "{fav} 좋아하신다고요! 어느 편이 제일 인상 깊으셨어요?" },
  { id: "ANIME-2", category: "anime", requires: ["hobby"], kind: "online", title: "이번 분기 신작", body: "이번 분기에 보고 계신 작품 있어요? 저는 추천받고 싶은데 하나만 골라주실래요?" },
  { id: "IDOL-1", category: "performance", requires: ["fav"], kind: "talk", title: "입덕 계기", body: "{fav} 팬이시군요. 저는 무대 영상 보고 빠졌는데, 어떻게 입덕하셨어요?" },
  { id: "IDOL-2", category: "performance", requires: ["hobby", "same_region"], kind: "offline", title: "공연 같이", body: "{region}에서 공연 자주 가세요? 다음에 같은 공연 있으면 같이 가도 좋을까요?" },
  { id: "BOARD-1", category: "boardgame", requires: ["hobby"], kind: "talk", title: "인생 보드게임", body: "보드게임 좋아하시네요! 제일 자주 하는 게임이 뭐예요?" },
  { id: "BOARD-2", category: "boardgame", requires: ["hobby", "same_region", "common_slot"], kind: "offline", title: "보드게임 카페", body: "{region} 쪽 보드게임 카페 가보셨어요? {slot}에 한 번 같이 가면 재밌을 것 같지 않아요?" },
  { id: "RUN-1", category: "fitness", hobbySlugs: ["running"], requires: ["hobby"], kind: "talk", title: "러닝 루틴", body: "러닝 하시는군요! 저는 5km 루틴인데, 보통 몇 km 정도 뛰세요?" },
  { id: "RUN-2", category: "fitness", hobbySlugs: ["running", "hiking", "cycling"], requires: ["hobby", "same_region"], kind: "offline", title: "같이 뛰기", body: "{region} 근처 {hobby} 코스 추천해주실 수 있어요? 주말에 같이 하는 것도 어때요?" },
  { id: "CLIMB-1", category: "fitness", hobbySlugs: ["climbing"], requires: ["hobby"], kind: "talk", title: "볼더링 난이도", body: "클라이밍 하신다고요! 요즘 어느 난이도 하세요?" },
  { id: "CAFE-1", category: "cafe", requires: ["hobby", "same_region"], kind: "offline", title: "카페 리스트", body: "{region} 카페 많이 다니세요? 제 리스트랑 교환할래요?" },
  { id: "PHOTO-1", category: "photo", requires: ["hobby"], kind: "talk", title: "장비 토크", body: "사진 찍으시는군요. 폰이세요, 카메라세요? 요즘 뭐 찍으세요?" },
  { id: "PHOTO-2", category: "photo", requires: ["hobby", "common_slot"], kind: "offline", title: "출사", body: "{slot}에 시간 맞으시면 가볍게 출사 한 번 어때요?" },
  { id: "CODE-1", category: "coding", requires: ["hobby"], kind: "talk", title: "사이드 프로젝트", body: "코딩 하시네요! 저는 토이 프로젝트 중인데, 요즘 만들고 있는 거 있으세요?" },
  { id: "BOOK-1", category: "reading", requires: ["fav"], kind: "talk", title: "최근 읽은 책", body: "{fav} 좋아하신다니 반가워요. 최근에 읽은 책 한 권 추천해주실래요?" },
  { id: "GEN-1", category: "general", requires: ["common_slot"], kind: "talk", title: "시간대", body: "둘 다 {slot}에 활동하시네요. 그 시간엔 보통 뭐 하세요?" },
  { id: "GEN-2", category: "general", requires: [], kind: "talk", title: "요즘 빠진 것", body: "프로필에 적으신 \"요즘 빠진 것\" 이야기 더 듣고 싶어요! 어떻게 시작하셨어요?" },
  // ---- D3 추가 (유형 고정 폴백 + 카테고리 규칙) ----
  { id: "GEN-3", category: "general", requires: [], kind: "online", title: "같이 보기", body: "요즘 보거나 듣는 것 중에 추천할 만한 거 있어요? 제목만 알려주시면 저도 오늘 볼게요, 어떤 게 좋을까요?" },
  { id: "GEN-4", category: "general", requires: ["same_region"], kind: "offline", title: "동네 취미 토크", body: "{region} 쪽이시군요! 나중에 취미 얘기 하러 근처 카페에서 가볍게 만나면 어떨까요?" },
  { id: "GAME-3", category: "gaming", requires: ["hobby"], kind: "talk", title: "요즘 게임", body: "요즘 제일 재밌게 하는 게임이 뭐예요? 저는 하나에 꽂히면 오래 하는 편인데, 어떠세요?" },
  { id: "CAFE-2", category: "cafe", requires: ["hobby"], kind: "talk", title: "카페 취향", body: "카페 고를 때 제일 중요하게 보는 게 뭐예요? 저는 디저트가 우선인데, 커피파세요?" },
  { id: "BOOK-2", category: "reading", requires: ["hobby"], kind: "talk", title: "요즘 읽는 책", body: "요즘 읽고 있는 책 있으세요? 저는 밤에 조금씩 읽는 편인데, 어떤 장르 좋아하세요?" },
  { id: "ANIME-3", category: "anime", requires: ["hobby"], kind: "talk", title: "정주행 중", body: "요즘 정주행 중인 작품 있어요? 저는 한 번 빠지면 밤새는 편인데, 어떠세요?" },
  { id: "GEN-5", category: "general", requires: [], kind: "talk", title: "취미의 시작", body: "제일 오래 한 취미가 뭐예요? 저는 시작 계기가 좀 엉뚱했는데, 어떻게 시작하셨어요?" },
  { id: "FIT-1", category: "fitness", requires: ["hobby"], kind: "talk", title: "운동 루틴", body: "{hobby} 하시는군요! 일주일에 몇 번 정도 하세요?" },
  { id: "TRAVEL-1", category: "travel", requires: ["hobby"], kind: "talk", title: "다음 여행지", body: "{hobby} 좋아하시네요! 최근에 가장 좋았던 곳이 어디였어요?" },
  { id: "MUSIC-1", category: "music", requires: ["hobby"], kind: "talk", title: "요즘 플리", body: "{hobby} 하시는군요! 요즘 제일 많이 듣는 곡이 뭐예요?" },
  { id: "PETS-1", category: "pets", requires: ["hobby"], kind: "talk", title: "반려 이야기", body: "{hobby} 좋아하시는군요! 같이 지내는 친구가 있으세요, 아니면 관심 단계세요?" },
];

/** `match_suggestion_input` RPC 반환(snake_case) */
export type SuggestionInputJson = {
  match_id: string;
  mode: "friend" | "dating";
  a_id: string;
  b_id: string;
  common_hobbies: Array<{
    hobby_id: number;
    slug: string;
    name: string;
    category_slug: string;
    rank_sum: number;
    intensity_a: number;
    intensity_b: number;
    fav_a: string | null;
    fav_b: string | null;
  }>;
  common_slots: Array<{ weekday: number; slot: "morning" | "afternoon" | "evening" | "night" }>;
  same_sido: boolean;
  same_sigungu: boolean;
  region_label: string | null;
  categories_a?: string[];
  categories_b?: string[];
  has_now_into_a?: boolean;
  has_now_into_b?: boolean;
  first_suggestion_set?: boolean;
};

export type CommonHobby = {
  hobbyId: number;
  slug: string;
  name: string;
  categorySlug: string;
  rankSum: number;
  /** 두 사람의 fav_note 가 같은 취미에서 동일할 때만 (뷰어 중립) */
  sharedFav: string | null;
};

export type SuggestionInput = {
  mode: "friend" | "dating";
  commonHobbies: CommonHobby[];
  commonSlots: Array<{ weekday: number; slot: "morning" | "afternoon" | "evening" | "night" }>;
  sameRegion: boolean;
  /** 시/도 또는 구 단위 표기 (동 이하 금지) */
  regionLabel: string | null;
};

const normalizeFav = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, "").toLowerCase();

export function parseSuggestionInput(json: SuggestionInputJson): SuggestionInput {
  const commonHobbies = [...(json.common_hobbies ?? [])]
    .sort((x, y) => x.rank_sum - y.rank_sum || x.hobby_id - y.hobby_id)
    .map((h) => ({
      hobbyId: h.hobby_id,
      slug: h.slug,
      name: h.name,
      categorySlug: h.category_slug,
      rankSum: h.rank_sum,
      sharedFav: h.fav_a && h.fav_b && normalizeFav(h.fav_a) === normalizeFav(h.fav_b) ? h.fav_a.trim() : null,
    }));
  return {
    mode: json.mode,
    commonHobbies,
    commonSlots: json.common_slots ?? [],
    sameRegion: Boolean(json.same_sido) && Boolean(json.region_label),
    regionLabel: json.region_label ?? null,
  };
}

const SLOT_KO: Record<SuggestionInput["commonSlots"][number]["slot"], string> = {
  morning: "아침",
  afternoon: "오후",
  evening: "저녁",
  night: "밤",
};

/** 겹치는 시간대 → "평일 저녁" / "주말 오후" (가장 많은 조합). 없으면 "주말" 폴백(A3 §5.1) */
export function humanSlot(slots: SuggestionInput["commonSlots"]): string {
  if (slots.length === 0) return "주말";
  const counts = new Map<string, number>();
  for (const s of slots) {
    const day = s.weekday >= 6 ? "주말" : "평일";
    const k = `${day} ${SLOT_KO[s.slot]}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = "";
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

const OFFLINE_FRIENDLY = new Set(["fitness", "cafe", "boardgame", "travel", "photo", "performance"]);

type Filled = { template: SuggestionTemplate; body: string; hobbyId: number | null };

function fill(t: SuggestionTemplate, ctx: { hobby: CommonHobby | null; slot: string; region: string | null }): string {
  return t.body
    .replaceAll("{hobby}", ctx.hobby?.name ?? "취미")
    .replaceAll("{fav}", ctx.hobby?.sharedFav ?? "")
    .replaceAll("{slot}", ctx.slot)
    .replaceAll("{region}", ctx.region ?? "근처");
}

function satisfied(t: SuggestionTemplate, input: SuggestionInput, hobby: CommonHobby | null): boolean {
  for (const r of t.requires) {
    if (r === "hobby" && !hobby) return false;
    if (r === "fav" && !hobby?.sharedFav) return false;
    if (r === "same_region" && !(input.sameRegion && input.regionLabel)) return false;
    if (r === "common_slot" && input.commonSlots.length === 0) return false;
  }
  if (t.category !== "general") {
    if (!hobby || hobby.categorySlug !== t.category) return false;
    if (t.hobbySlugs && !t.hobbySlugs.includes(hobby.slug)) return false;
  }
  return true;
}

/** kind 별 후보를 (공통 취미 우선순위 → 템플릿 정의 순) 로 나열 */
function candidatesFor(kind: SuggestionKind, input: SuggestionInput, slot: string): Filled[] {
  const out: Filled[] = [];
  const hobbies: Array<CommonHobby | null> = [...input.commonHobbies, null];
  for (const hobby of hobbies) {
    for (const t of SUGGESTION_TEMPLATES) {
      if (t.kind !== kind) continue;
      if (hobby === null && t.category !== "general") continue;
      if (hobby !== null && t.category === "general") continue;
      if (!satisfied(t, input, hobby)) continue;
      out.push({ template: t, body: fill(t, { hobby, slot, region: input.regionLabel }), hobbyId: hobby?.hobbyId ?? null });
    }
  }
  return out;
}

export type BuildOptions = {
  /** 최근 30일 이 유저에게 노출된 템플릿 ID (우선순위 하향) */
  recentTemplateIds?: ReadonlyArray<string>;
};

/**
 * 3장 조립. 반환은 `matches.first_suggestion` 형식 그대로 (`id` = c1/c2/c3, 노출 순서).
 * 오프라인 카드가 불가능(지역·시간대 없음)하면 talk 템플릿으로 채우되 3장·서로 다른 template_id 는 항상 보장.
 */
export function buildSuggestions(input: SuggestionInput, opts: BuildOptions = {}): FirstSuggestion[] {
  const slot = humanSlot(input.commonSlots);
  const recent = new Set(opts.recentTemplateIds ?? []);
  const used = new Set<string>();
  const usedHobby = new Set<number>();

  const top = input.commonHobbies[0];
  const offlineFirst =
    input.mode === "friend" && input.sameRegion && input.commonSlots.length > 0 && top !== undefined && OFFLINE_FRIENDLY.has(top.categorySlug);
  const order: SuggestionKind[] = offlineFirst ? ["offline", "online", "talk"] : ["online", "offline", "talk"];

  const pick = (kind: SuggestionKind): Filled | null => {
    const cands = candidatesFor(kind, input, slot).filter((c) => !used.has(c.template.id));
    if (cands.length === 0) return null;
    // 다양성: 최근 노출 템플릿 뒤로, 이미 쓴 취미 뒤로 (정의 순 안정 정렬)
    const scored = cands.map((c, i) => ({ c, i, penalty: (recent.has(c.template.id) ? 2 : 0) + (c.hobbyId !== null && usedHobby.has(c.hobbyId) ? 1 : 0) }));
    scored.sort((x, y) => x.penalty - y.penalty || x.i - y.i);
    return scored[0]?.c ?? null;
  };

  const cards: FirstSuggestion[] = [];
  for (const kind of order) {
    let chosen = pick(kind);
    if (!chosen && kind === "offline") chosen = pick("talk");
    if (!chosen && kind === "online") chosen = pick("talk");
    if (!chosen) chosen = pick("talk");
    if (!chosen) continue;
    used.add(chosen.template.id);
    if (chosen.hobbyId !== null) usedHobby.add(chosen.hobbyId);
    cards.push({ id: `c${cards.length + 1}`, template_id: chosen.template.id, title: chosen.template.title, body: chosen.body, kind: chosen.template.kind });
  }
  // 이론상 GEN-2/GEN-3(+GEN-1) 로 항상 3장이 채워진다. 방어적으로 부족분은 범용 순환
  for (const t of SUGGESTION_TEMPLATES) {
    if (cards.length >= 3) break;
    if (t.category !== "general" || used.has(t.id) || !satisfied(t, input, null)) continue;
    used.add(t.id);
    cards.push({ id: `c${cards.length + 1}`, template_id: t.id, title: t.title, body: fill(t, { hobby: null, slot, region: input.regionLabel }), kind: t.kind });
  }
  return cards;
}

/** 금지 표현 검사(테스트·리뷰용): 연락처/URL/시간 확정/장소명 힌트 */
export const FORBIDDEN_BODY_RE = /(\d{2,3}-\d{3,4}-\d{4}|https?:\/\/|카톡|카카오|인스타|번호|계좌|\d{1,2}시에|내일 봐요|오늘 봐요)/;
