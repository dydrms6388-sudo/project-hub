/**
 * 개발 라우트(/dev/discover)·스크린샷용 목 데이터 + in-memory DiscoverApi. 프로덕션 번들에는 dev 페이지에서만 import 된다.
 * 인물·취미는 D1 시드 페르소나(서윤 시점: 민재·도현·하은) 기준. 실명·전화·사진 경로 없음.
 */
import type { FirstSuggestion, ProfilePublicView } from "@duckmate/db";
import { fail, ok } from "@/lib/auth/errors";
import type { RecoHobby } from "@/lib/matching/queries";
import type { CardPerson, DiscoverApi, HomeView, MatchView, RecoCardView, TodayView } from "./types";

const LOOP_DATE = "2026-09-02";
const ME = "10000000-0000-4000-8000-000000000001";

function profile(p: Partial<ProfilePublicView> & { id: string; nickname: string }): ProfilePublicView {
  return {
    birth_year: null,
    age_band: "20_late",
    gender: null,
    region_code: "11440",
    sido: "서울",
    sigungu: "마포구",
    bio: null,
    now_into: null,
    verify_level: 2,
    mode: "friend",
    last_active_at: "2026-09-02T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
    ...p,
  };
}

function hobby(hobbyId: number, slug: string, name: string, categoryId: number, rank: number, intensity: number, isCommon = false, favNote: string | null = null): RecoHobby {
  return { hobbyId, slug, name, categoryId, rank, intensity, favNote, isCommon };
}

const MINJAE = profile({ id: "10000000-0000-4000-8000-000000000003", nickname: "민재", age_band: "30_early", region_code: "11200", sigungu: "성동구", now_into: "10k 준비 중", bio: "주말 아침 한강 러닝. 10k 준비 중이에요.", verify_level: 3 });
const DOHYUN = profile({ id: "10000000-0000-4000-8000-000000000002", nickname: "도현", age_band: "20_early", region_code: "11620", sigungu: "관악구", now_into: "스플렌더 전략 공부", bio: "보드게임 입문 3개월차. 같이 배워요." });
const HAEUN = profile({ id: "10000000-0000-4000-8000-000000000004", nickname: "하은", age_band: "20_late", region_code: "41130", sido: "경기", sigungu: "성남시", now_into: "신작 웹툰 정주행" });
const JIWOO = profile({ id: "10000000-0000-4000-8000-000000000005", nickname: "지우", age_band: "20_mid", sigungu: "마포구", now_into: "출사 코스 찾는 중" });

function card(position: number, p: ProfilePublicView, score: number, hobbies: RecoHobby[], reasons: RecoCardView["reasons"]): RecoCardView {
  return {
    recoId: `20000000-0000-4000-8000-00000000000${position}`,
    position,
    loopDate: LOOP_DATE,
    score,
    scorePercent: Math.round(score * 100),
    reasons,
    seenAt: null,
    action: null,
    profile: p,
    hobbies,
    commonHobbyIds: hobbies.filter((h) => h.isCommon).map((h) => h.hobbyId),
    introWelcome: hobbies.some((h) => h.rank <= 3 && h.intensity <= 2),
    primaryPhotoPath: null,
    photoPaths: [],
    photoUrls: [],
  };
}

export const MOCK_CARDS: RecoCardView[] = [
  card(1, MINJAE, 0.78, [hobby(11, "running", "러닝", 3, 1, 4, true, "한강 야간 러닝"), hobby(6, "boardgame", "보드게임", 2, 2, 4, true), hobby(26, "cafe_tour", "카페투어", 6, 3, 3)], [
    { kind: "hobby_overlap", label: "공통 취미: 러닝·보드게임" },
    { kind: "slot_overlap", label: "토요일 아침에 시간이 맞아요" },
    { kind: "region_same", label: "서울 근처", level: "sido" },
  ]),
  card(2, DOHYUN, 0.62, [hobby(6, "boardgame", "보드게임", 2, 1, 2, true, "스플렌더"), hobby(21, "pc_game", "PC 게임", 5, 2, 3), hobby(31, "book_club", "북클럽", 7, 3, 2)], [
    { kind: "hobby_overlap", label: "공통 취미: 보드게임" },
    { kind: "quiz_similar", label: "궁합 퀴즈 7/10 일치" },
  ]),
  card(3, HAEUN, 0.55, [hobby(16, "webtoon", "웹툰", 4, 1, 5, false, "신작 정주행"), hobby(22, "coop_game", "협동 게임", 5, 2, 4), hobby(1, "idol", "아이돌 덕질", 1, 3, 2, true)], [
    { kind: "category_adjacent", label: "비슷한 취미 분야: 게임·보드게임" },
    { kind: "slot_overlap", label: "평일 저녁에 시간이 맞아요" },
  ]),
  card(4, JIWOO, 0.71, [hobby(36, "photography", "사진", 8, 1, 3, true, "필름 카메라"), hobby(11, "running", "러닝", 3, 2, 2, true), hobby(2, "concert", "콘서트·페스티벌", 1, 3, 4)], [
    { kind: "hobby_overlap", label: "공통 취미: 사진·러닝" },
    { kind: "region_same", label: "같은 구", level: "sigungu" },
  ]),
];

export const MOCK_TODAY: TodayView = {
  loopDate: LOOP_DATE,
  generated: false,
  limit: 5,
  cards: MOCK_CARDS,
  remaining: MOCK_CARDS.length,
  short: true,
  superlike: { tier: "free", weekly_quota: 1, weekly_used: 0, weekly_remaining: 1, daily_cap: 5, used_today: 0, week_start: "2026-08-31", resets_at: "2026-09-06T22:00:00Z" },
  canUndo: false,
};

export const MOCK_HOME: HomeView = {
  summary: {
    loop_date: LOOP_DATE,
    reco_total: 5,
    reco_remaining: 4,
    pending_results: 2,
    matches_today: 1,
    likers_count: 3,
    superlike: MOCK_TODAY.superlike!,
  },
  unansweredChats: 1,
  matchCount: 1,
  showSafetyModal: false,
};

const ME_PERSON: CardPerson = {
  profileId: ME,
  nickname: "서윤",
  ageBand: "20_late",
  region: "마포구",
  verifyLevel: 2,
  hobbies: [hobby(1, "idol", "아이돌 덕질", 1, 1, 4, false, "○○ 컴백 무대"), hobby(11, "running", "러닝", 3, 2, 2, true), hobby(36, "photography", "사진", 8, 3, 3, false)],
  favorite: "○○ 컴백 무대",
  nowInto: "컴백 무대 정주행",
  bio: null,
  photoUrls: [],
};

const MINJAE_PERSON: CardPerson = {
  profileId: MINJAE.id,
  nickname: "민재",
  ageBand: "30_early",
  region: "성동구",
  verifyLevel: 3,
  hobbies: MOCK_CARDS[0]!.hobbies,
  favorite: "한강 야간 러닝",
  nowInto: "10k 준비 중",
  bio: MINJAE.bio,
  photoUrls: [],
};

export const MOCK_SUGGESTIONS: FirstSuggestion[] = [
  { id: "c1", template_id: "RUN-2", title: "같이 뛰기", body: "성동구 근처 러닝 코스 추천해 주실 수 있어요? 주말에 같이 뛰어도 좋고요.", kind: "offline" },
  { id: "c2", template_id: "GEN-3", title: "온라인으로 먼저", body: "요즘 러닝 기록 어떻게 관리하세요? 저는 앱으로 매주 정리하는데, 기록 공유해도 재밌을 것 같아요.", kind: "online" },
  { id: "c3", template_id: "FIT-1", title: "운동 루틴", body: "러닝 하시는군요! 일주일에 몇 번 정도 하세요?", kind: "talk" },
];

export const MOCK_MATCH: MatchView = {
  matchId: "30000000-0000-4000-8000-000000000001",
  mode: "friend",
  status: "active",
  matchedAt: "2026-09-02T01:20:00Z",
  firstMessageAt: null,
  me: ME_PERSON,
  partner: MINJAE_PERSON,
  partnerProfile: MINJAE,
  firstSuggestion: MOCK_SUGGESTIONS,
  overlapLabels: ["러닝"],
  showSafetyModal: false,
};

/** in-memory API: 액션은 즉시 성공, 민재(1번)에게 좋아요 → 매칭, 슈퍼라이크는 1회만 */
export function createMockApi(opts: { safetyModal?: boolean; matchOnLike?: string } = {}): DiscoverApi {
  let superRemaining = 1;
  const acted = new Map<string, "like" | "super" | "pass">();
  const matchTarget = opts.matchOnLike ?? MINJAE.id;
  return {
    fetchToday: async () => ok({ ...MOCK_TODAY, cards: MOCK_TODAY.cards.filter((c) => !acted.has(c.profile.id)), superlike: { ...MOCK_TODAY.superlike!, weekly_remaining: superRemaining } }),
    fetchHome: async () => ok({ ...MOCK_HOME, showSafetyModal: Boolean(opts.safetyModal) }),
    act: async ({ targetId, action }) => {
      const prev = acted.get(targetId);
      if (prev && prev !== action) return fail("ALREADY_ACTED");
      if (action === "super") {
        if (superRemaining <= 0) return fail("NOT_ENTITLED", "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전", { field: "superlike" });
        superRemaining -= 1;
      }
      acted.set(targetId, action);
      const c = MOCK_CARDS.find((x) => x.profile.id === targetId);
      const matched = action !== "pass" && targetId === matchTarget;
      return ok({
        action,
        recoId: c?.recoId ?? "",
        loopDate: LOOP_DATE,
        already: Boolean(prev),
        matched,
        matchId: matched ? MOCK_MATCH.matchId : null,
        ...(matched ? { firstSuggestion: MOCK_SUGGESTIONS } : {}),
        superlike: { ...MOCK_TODAY.superlike!, weekly_remaining: superRemaining, weekly_used: 1 - superRemaining },
        matchCreated: matched && !prev,
      });
    },
    seen: async ({ recoId }) => ok({ recoId, seenAt: new Date().toISOString() }),
    undo: async () => fail("NOT_ENTITLED", "되돌리기는 플러스 혜택이에요"),
    fetchMatch: async () => ok({ ...MOCK_MATCH, showSafetyModal: Boolean(opts.safetyModal) }),
    sendFirst: async () => ok({ id: "40000000-0000-4000-8000-000000000001" }),
    block: async ({ targetId }) => ok({ targetId, blocked: true as const }),
    markSafetySeen: async () => ok({ seenAt: new Date().toISOString() }),
  };
}
