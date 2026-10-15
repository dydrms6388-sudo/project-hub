/**
 * E2 화면 데이터 계약 (서버 액션 응답 → 클라이언트). 타입만 — 서버 전용 모듈은 `import type` 으로만 참조한다.
 */
import type { AgeBand, FirstSuggestion, MatchRow, ProfilePublicView } from "@duckmate/db";
import type { ActionResult } from "@/lib/auth/errors";
import type { SentMessage } from "@/lib/chat/types";
import type { ActOnRecommendationResult } from "@/lib/matching/actions";
import type { RecoCard, RecoHobby, TodayRecommendations } from "@/lib/matching/queries";
import type { HomeSummary, SuperlikeStatus } from "@/lib/matching/rpc";

export type RecoReasonLike = { kind: string; label: string; level?: unknown };

/** RecoCard + 서명 URL(1h). `is_from_liker/is_boosted` 는 애초에 RecoCard 에 없다(16_matching §0-13) */
export type RecoCardView = RecoCard & { photoUrls: string[] };

export type TodayView = Omit<TodayRecommendations, "cards"> & {
  cards: RecoCardView[];
  /** superlike_status (실패 시 null → 버튼은 활성, 서버가 최종 판정) */
  superlike: SuperlikeStatus | null;
  /** 티어 권한 `undo` (Phase 1 무료 = false → 되돌리기 버튼 비활성 + "플러스에서" 문구) */
  canUndo: boolean;
};

export type HomeView = {
  summary: HomeSummary;
  /** 미답장 = 미읽음 메시지가 있는 대화 수 (get_chat_list 요약, 실패 시 0) */
  unansweredChats: number;
  /** 매칭 1건 이상 + safety_modal_seen_at null → 안전 모달 (레이스: 상대가 먼저 매칭 화면을 연 경우 홈에서 보완) */
  showSafetyModal: boolean;
  matchCount: number;
};

/** 덕질 카드에 그리는 사람 (추천 카드·매칭 리빌·프로필 시트 공용) */
export type CardPerson = {
  profileId: string;
  nickname: string;
  ageBand: AgeBand | null;
  region: string;
  verifyLevel: 0 | 1 | 2 | 3;
  hobbies: RecoHobby[];
  favorite: string | null;
  nowInto: string | null;
  bio: string | null;
  photoUrls: string[];
};

export type MatchView = {
  matchId: string;
  mode: MatchRow["mode"];
  status: MatchRow["status"];
  matchedAt: string;
  firstMessageAt: string | null;
  me: CardPerson;
  /** 상대가 탈퇴·차단 등으로 뷰에서 사라지면 null */
  partner: CardPerson | null;
  partnerProfile: ProfilePublicView | null;
  firstSuggestion: FirstSuggestion[];
  /** 겹치는 취미 이름(리빌 코랄 점등) */
  overlapLabels: string[];
  /** 첫 매칭(내 매칭 수 1) + safety_modal_seen_at null → 확인 필수 모달 */
  showSafetyModal: boolean;
};

export type ActInput = { targetId: string; action: "like" | "super" | "pass" };

/** 화면이 쓰는 API 표면. 기본 = 서버 액션(`serverApi`), 개발 라우트 = `mockApi` */
export type DiscoverApi = {
  fetchToday(): Promise<ActionResult<TodayView>>;
  fetchHome(): Promise<ActionResult<HomeView>>;
  act(input: ActInput): Promise<ActionResult<ActOnRecommendationResult>>;
  seen(input: { recoId: string }): Promise<ActionResult<{ recoId: string; seenAt: string }>>;
  undo(): Promise<ActionResult<{ recoId: string; targetId: string; previousAction: "like" | "super" | "pass" }>>;
  fetchMatch(matchId: string): Promise<ActionResult<MatchView>>;
  /** 첫 메시지 전송(제안 카드). E3 `SuggestionPicker.send` 계약과 동일한 반환 타입 — H2 통합 */
  sendFirst(input: { matchId: string; body: string }): Promise<ActionResult<SentMessage>>;
  block(input: { targetId: string }): Promise<ActionResult<{ targetId: string; blocked: true }>>;
  markSafetySeen(): Promise<ActionResult<{ seenAt: string }>>;
};
