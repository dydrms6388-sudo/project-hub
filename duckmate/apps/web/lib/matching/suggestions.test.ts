import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_BODY_RE,
  SUGGESTION_TEMPLATES,
  buildSuggestions,
  humanSlot,
  parseSuggestionInput,
  type SuggestionInput,
  type SuggestionInputJson,
} from "./suggestions";

const input = (patch: Partial<SuggestionInput> = {}): SuggestionInput => ({
  mode: "friend",
  commonHobbies: [],
  commonSlots: [],
  sameRegion: false,
  regionLabel: null,
  ...patch,
});
const running = { hobbyId: 11, slug: "running", name: "러닝", categorySlug: "fitness", rankSum: 2, sharedFav: null };
const boardgame = { hobbyId: 6, slug: "boardgame", name: "보드게임", categorySlug: "boardgame", rankSum: 3, sharedFav: null };
const idol = { hobbyId: 1, slug: "idol", name: "아이돌 덕질", categorySlug: "performance", rankSum: 2, sharedFav: "○○ 컴백 무대" };
const pcgame = { hobbyId: 21, slug: "pc_game", name: "PC 게임", categorySlug: "gaming", rankSum: 4, sharedFav: null };

describe("템플릿 규칙", () => {
  it("A3 18개 포함 29개, ID 유니크, 각 카테고리에 *-1 talk 존재", () => {
    expect(SUGGESTION_TEMPLATES.length).toBe(29);
    expect(new Set(SUGGESTION_TEMPLATES.map((t) => t.id)).size).toBe(29);
    for (const cat of ["performance", "boardgame", "fitness", "anime", "gaming", "cafe", "reading", "photo", "coding", "travel", "music", "pets"]) {
      expect(SUGGESTION_TEMPLATES.some((t) => t.category === cat && t.kind === "talk"), cat).toBe(true);
    }
    for (const id of ["GAME-1", "ANIME-1", "IDOL-2", "BOARD-2", "RUN-2", "CLIMB-1", "CAFE-1", "PHOTO-2", "CODE-1", "BOOK-1", "GEN-1", "GEN-2"]) {
      expect(SUGGESTION_TEMPLATES.some((t) => t.id === id), id).toBe(true);
    }
  });
  it("본문: 존댓말 1~2문장, 질문으로 끝남, 금지 표현 없음 (PRD §4.3)", () => {
    for (const t of SUGGESTION_TEMPLATES) {
      expect(t.body.trim().endsWith("?"), t.id).toBe(true);
      expect(t.body.split(/[.?!]\s/).filter(Boolean).length, t.id).toBeLessThanOrEqual(3);
      expect(FORBIDDEN_BODY_RE.test(t.body), t.id).toBe(false);
      expect(/요[?.!]|까요\?|세요\?|에요[?.!]|어요[?.!]|죠\?/.test(t.body), t.id).toBe(true);
    }
  });
});

describe("buildSuggestions", () => {
  it("항상 3장, template_id 서로 다름, id c1..c3", () => {
    const cards = buildSuggestions(input({ commonHobbies: [running, boardgame], commonSlots: [{ weekday: 6, slot: "morning" }], sameRegion: true, regionLabel: "성동구" }));
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.template_id)).size).toBe(3);
    expect(cards.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    for (const c of cards) expect(c.body.includes("{")).toBe(false);
  });
  it("3장 유형: online / offline / talk 각 1 (조건 충족 시)", () => {
    const cards = buildSuggestions(input({ commonHobbies: [pcgame, running], commonSlots: [{ weekday: 2, slot: "evening" }], sameRegion: true, regionLabel: "서울" }));
    expect(cards.map((c) => c.kind).sort()).toEqual(["offline", "online", "talk"]);
    expect(cards.map((c) => c.kind)).toEqual(["online", "offline", "talk"]);
    const online = cards.find((c) => c.kind === "online");
    expect(["GAME-1", "GAME-2"]).toContain(online?.template_id);
    expect(cards.find((c) => c.kind === "offline")?.template_id).toBe("RUN-2");
    expect(cards.find((c) => c.kind === "offline")?.body).toContain("서울");
  });
  it("오프모임 성향(friend + 같은 지역 + 겹치는 시간 + 오프라인 친화 취미) → offline 을 앞으로", () => {
    const cards = buildSuggestions(input({ commonHobbies: [boardgame], commonSlots: [{ weekday: 6, slot: "afternoon" }], sameRegion: true, regionLabel: "마포구" }));
    expect(cards[0]?.kind).toBe("offline");
    expect(cards[0]?.template_id).toBe("BOARD-2");
    expect(cards[0]?.body).toContain("마포구");
    expect(cards[0]?.body).toContain("주말 오후");
  });
  it("데이팅 모드는 offline 을 앞세우지 않는다", () => {
    const cards = buildSuggestions(input({ mode: "dating", commonHobbies: [boardgame], commonSlots: [{ weekday: 6, slot: "afternoon" }], sameRegion: true, regionLabel: "마포구" }));
    expect(cards[0]?.kind).toBe("online");
  });
  it("공통 취미 없음 → 범용 폴백(GEN-3 online, GEN-2 talk …), 지역 없으면 offline 은 talk 로 대체", () => {
    const cards = buildSuggestions(input());
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.template_id)).toEqual(["GEN-3", "GEN-2", "GEN-1"].slice(0, 2).concat([cards[2]!.template_id]));
    expect(cards.some((c) => c.kind === "offline")).toBe(false);
    const withRegion = buildSuggestions(input({ sameRegion: true, regionLabel: "인천" }));
    expect(withRegion.find((c) => c.kind === "offline")?.template_id).toBe("GEN-4");
    expect(withRegion.find((c) => c.kind === "offline")?.body).toContain("인천");
  });
  it("{fav} 는 두 사람의 최애가 같을 때만 (뷰어 중립), 다르면 fav 템플릿 미사용", () => {
    const withFav = buildSuggestions(input({ commonHobbies: [idol] }));
    const talk = withFav.find((c) => c.kind === "talk");
    expect(talk?.template_id).toBe("IDOL-1");
    expect(talk?.body).toContain("○○ 컴백 무대");
    const noFav = buildSuggestions(input({ commonHobbies: [{ ...idol, sharedFav: null }] }));
    expect(noFav.some((c) => c.template_id === "IDOL-1")).toBe(false);
    expect(noFav.every((c) => !c.body.includes("{fav}") && !c.body.startsWith(" "))).toBe(true);
  });
  it("최근 노출 템플릿은 우선순위 하향", () => {
    const base = buildSuggestions(input({ commonHobbies: [pcgame], commonSlots: [{ weekday: 2, slot: "evening" }] }));
    expect(base.find((c) => c.kind === "online")?.template_id).toBe("GAME-1");
    const rotated = buildSuggestions(input({ commonHobbies: [pcgame], commonSlots: [{ weekday: 2, slot: "evening" }] }), { recentTemplateIds: ["GAME-1"] });
    expect(rotated.find((c) => c.kind === "online")?.template_id).toBe("GAME-2");
    expect(rotated.find((c) => c.kind === "online")?.body).toContain("평일 저녁");
  });
  it("hobbySlugs 필터: 클라이밍은 CLIMB-1, 헬스는 FIT-1", () => {
    const climb = buildSuggestions(input({ commonHobbies: [{ ...running, hobbyId: 12, slug: "climbing", name: "클라이밍" }] }));
    expect(climb.some((c) => c.template_id === "CLIMB-1")).toBe(true);
    const gym = buildSuggestions(input({ commonHobbies: [{ ...running, hobbyId: 13, slug: "gym", name: "헬스·크로스핏" }] }));
    expect(gym.some((c) => c.template_id === "FIT-1")).toBe(true);
    expect(gym.some((c) => c.template_id === "RUN-1")).toBe(false);
  });
});

describe("parseSuggestionInput / humanSlot", () => {
  it("RPC jsonb → 입력 (rank_sum 정렬, 동일 fav 판정, same_sido && region_label)", () => {
    const json: SuggestionInputJson = {
      match_id: "m",
      mode: "friend",
      a_id: "a",
      b_id: "b",
      common_hobbies: [
        { hobby_id: 6, slug: "boardgame", name: "보드게임", category_slug: "boardgame", rank_sum: 5, intensity_a: 2, intensity_b: 4, fav_a: null, fav_b: "스플렌더" },
        { hobby_id: 1, slug: "idol", name: "아이돌 덕질", category_slug: "performance", rank_sum: 2, intensity_a: 5, intensity_b: 4, fav_a: " 뉴진스 ", fav_b: "뉴진스" },
      ],
      common_slots: [{ weekday: 6, slot: "afternoon" }],
      same_sido: true,
      same_sigungu: false,
      region_label: "서울",
    };
    const p = parseSuggestionInput(json);
    expect(p.commonHobbies.map((h) => h.slug)).toEqual(["idol", "boardgame"]);
    expect(p.commonHobbies[0]?.sharedFav).toBe("뉴진스");
    expect(p.commonHobbies[1]?.sharedFav).toBeNull();
    expect(p.sameRegion).toBe(true);
    expect(parseSuggestionInput({ ...json, region_label: null }).sameRegion).toBe(false);
  });
  it("humanSlot: 최다 조합, 빈 배열은 '주말'", () => {
    expect(humanSlot([])).toBe("주말");
    expect(humanSlot([{ weekday: 1, slot: "evening" }, { weekday: 3, slot: "evening" }, { weekday: 6, slot: "morning" }])).toBe("평일 저녁");
    expect(humanSlot([{ weekday: 7, slot: "night" }])).toBe("주말 밤");
  });
});
