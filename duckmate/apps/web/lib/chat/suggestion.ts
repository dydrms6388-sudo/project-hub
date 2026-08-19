// =============================================================================
// D4 · 첫 대화 제안 카드 (apps/web/lib/chat/suggestion.ts)
//
// matches.first_suggestion 은 D3 의 make_first_suggestion() 이 매칭 성립 트리거에서
// 미리 채운 jsonb 배열이다(00008). 형식:
//   [{ "type": "hobby", "hobby_slug": string|null, "hobby_name": string|null,
//      "text": string }] × 3
//
// 이 모듈이 하는 일:
//   ① 위 jsonb 를 화면이 쓸 수 있는 타입으로 안전 파싱 (형식 위반 행은 버린다)
//   ② 제안 카드 클릭 → 그 텍스트를 첫 메시지로 발신 (sendMessage 래퍼)
//   ③ 오프라인 만남 뉘앙스의 제안에는 공공장소 권장 문구를 자동 부착
//      (A5 부록 / 12_flows §4.2 — "첫 오프라인 만남 제안엔 공공장소 권장 문구 자동 삽입")
//
// ⚠ 이 파일은 queries.ts 를 import 하므로 **서버 전용**이다. 카드 렌더는 서버에서
//   파싱한 결과(SuggestionCard[])를 props 로 내려 클라이언트 컴포넌트가 그린다.
//   parseFirstSuggestion 자체는 순수 함수지만 이 모듈 경유로 클라이언트 번들에
//   포함시키지 말 것.
// =============================================================================

import type { Json } from "@duckmate/db";
import {
  getChatRoom,
  MAX_MESSAGE_LENGTH,
  sendMessage,
  type ChatResult,
  type SendMessageData,
} from "./queries";

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

/** Phase 1 은 hobby 소스만. Phase 2 에서 battle|quiz 추가 (A3 부록-4) */
export type SuggestionType = "hobby" | "battle" | "quiz";

export interface SuggestionCard {
  /** first_suggestion 배열 인덱스 — sendSuggestion 의 키 */
  index: number;
  type: SuggestionType;
  hobbySlug: string | null;
  hobbyName: string | null;
  /** 카드에 보이는 문구 = 실제로 전송될 문구(자동 부착 문구 제외) */
  text: string;
  /** 오프라인 만남 뉘앙스 → 전송 시 공공장소 권장 문구가 붙는다 */
  offline: boolean;
}

export interface FirstSuggestionState {
  matchId: string;
  cards: SuggestionCard[];
  /** 이미 대화가 시작됐는가 (true 면 리믹스 = "제안 카드 다시 보내기" 맥락) */
  chatStarted: boolean;
}

const SUGGESTION_TYPES: ReadonlySet<string> = new Set<SuggestionType>(["hobby", "battle", "quiz"]);

// ---------------------------------------------------------------------------
// 오프라인 만남 감지 + 안전 문구 (A5 부록)
// ---------------------------------------------------------------------------

/** 공공장소 권장 문구 — 오프라인 활동 제안에 자동 부착 */
export const PUBLIC_PLACE_NOTE = "(첫 만남은 사람 많은 공공장소에서 만나요!)";

/**
 * make_first_suggestion 의 카테고리 템플릿 중 실제 오프라인 만남을 함의하는 것들:
 *   스포츠·러닝·클라이밍("같이 어때요"), 보드게임(보드게임카페), 카페·맛집(같이 가 봐요),
 *   공연·전시(가고 싶은 공연·전시). 온라인 활동(게임 한 판·추천 교환)은 제외한다.
 */
const OFFLINE_HINT_RE =
  /(보드게임\s*카페|카페|맛집|같이\s*가|공연|전시|만나|주말에\s*가볍게|입문\s*코스|여행지)/u;
const ONLINE_ONLY_RE = /(온라인으로|추천\s*교환|플레이리스트|한\s*판)/u;

export function isOfflineSuggestion(text: string): boolean {
  if (ONLINE_ONLY_RE.test(text)) return false;
  return OFFLINE_HINT_RE.test(text);
}

/** 전송 직전 본문 조립 — 오프라인 제안이면 공공장소 권장 문구를 한 번만 덧붙인다 */
export function buildSuggestionBody(card: Pick<SuggestionCard, "text" | "offline">): string {
  const text = card.text.trim();
  if (!card.offline) return text;
  if (text.includes(PUBLIC_PLACE_NOTE)) return text;
  const merged = `${text}\n\n${PUBLIC_PLACE_NOTE}`;
  return merged.length <= MAX_MESSAGE_LENGTH ? merged : text;
}

// ---------------------------------------------------------------------------
// 파싱
// ---------------------------------------------------------------------------

/**
 * first_suggestion(jsonb) → SuggestionCard[].
 * 형식이 깨진 원소는 조용히 버린다 — 제안 카드가 0개여도 화면은 동작해야 한다
 * (탈퇴로 한쪽이 null 인 매칭은 make_first_suggestion 이 [] 를 저장한다).
 */
export function parseFirstSuggestion(raw: Json | null | undefined): SuggestionCard[] {
  if (!Array.isArray(raw)) return [];

  const cards: SuggestionCard[] = [];
  raw.forEach((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return;
    const row = item as Record<string, Json | undefined>;

    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) return;

    const rawType = typeof row.type === "string" ? row.type : "hobby";
    const type = (SUGGESTION_TYPES.has(rawType) ? rawType : "hobby") as SuggestionType;

    cards.push({
      index,
      type,
      hobbySlug: typeof row.hobby_slug === "string" ? row.hobby_slug : null,
      hobbyName: typeof row.hobby_name === "string" ? row.hobby_name : null,
      text,
      offline: isOfflineSuggestion(text),
    });
  });

  return cards;
}

// ---------------------------------------------------------------------------
// 조회 — 매칭 리빌 모달 / 새 매칭 스트립 / 리믹스 [F-CHT-05]
// ---------------------------------------------------------------------------

/**
 * chat_rooms 뷰에서 first_suggestion 과 대화 시작 여부를 함께 읽는다
 * (뷰는 RLS security_invoker — 비참여자·차단은 행 자체가 안 보인다).
 */
export async function getFirstSuggestions(
  matchId: string,
  profileId: string,
): Promise<ChatResult<FirstSuggestionState>> {
  const roomRes = await getChatRoom(matchId, profileId);
  if (!roomRes.ok) return roomRes;

  const room = roomRes.data;
  return {
    ok: true,
    data: {
      matchId,
      cards: parseFirstSuggestion(room.firstSuggestion),
      chatStarted: !room.isNew,
    },
  };
}

// ---------------------------------------------------------------------------
// 발신 — 제안 카드 클릭 → 첫 메시지
// ---------------------------------------------------------------------------

/**
 * 카드 인덱스로 발신한다(본문을 클라이언트가 만들어 보내지 않는 이유: 제안 문구
 * 위조/변조 방지 + 오프라인 안전 문구 부착을 서버에서 보장하기 위해).
 * 실제 발신은 send-message Edge Function 이 수행하므로 마스킹·자동 탐지 파이프라인이
 * 일반 메시지와 완전히 동일하게 적용된다.
 */
export async function sendSuggestion(
  matchId: string,
  suggestionIndex: number,
  profileId: string,
): Promise<ChatResult<SendMessageData>> {
  const stateRes = await getFirstSuggestions(matchId, profileId);
  if (!stateRes.ok) return stateRes;

  const card = stateRes.data.cards.find((c) => c.index === suggestionIndex);
  if (!card) {
    return { ok: false, code: "INVALID_INPUT", message: "선택한 제안 카드를 찾을 수 없어요." };
  }

  return sendMessage({ matchId, body: buildSuggestionBody(card) }, profileId);
}
