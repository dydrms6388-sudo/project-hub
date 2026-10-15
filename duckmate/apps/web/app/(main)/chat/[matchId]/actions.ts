"use server";

// =============================================================================
// E3 · 대화방 Server Actions — lib/chat/queries 의 얇은 래퍼
//
// 규약:
//  - lib/chat/queries.ts 는 서버 전용이라 클라이언트가 직접 부를 수 없다.
//    클라이언트 컴포넌트는 반드시 이 파일의 액션만 호출한다.
//  - profileId 는 클라이언트가 보내지 않는다 — 세션에서 서버가 재확인한다(IDOR 방어).
//    (queries.ts 도 인자 profileId 와 세션 프로필 일치를 다시 검증한다 = 이중 방어)
//  - 발신은 sendMessage(=send-message Edge Function) 가 유일 경로다. 여기서 messages
//    테이블을 건드리지 않는다(권한도 없다 — 14_schema D1 규약 ④).
//  - 반환은 ChatResult 그대로 — 화면이 code 로 분기한다(D4 §6.3).
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import {
  getMessages,
  getMessagesSince,
  markRead,
  sendMessage,
  type ChatMessage,
  type ChatResult,
  type MessagePage,
  type SendMessageData,
} from "@/lib/chat/queries";
import { sendSuggestion } from "@/lib/chat/suggestion";
import { logAppEvent } from "../../_components/analytics";

async function currentProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function authFail<T>(): ChatResult<T> {
  return { ok: false, code: "AUTH_REQUIRED", message: "로그인이 필요해요." };
}

// ---------------------------------------------------------------------------
// 발신
// ---------------------------------------------------------------------------

/**
 * 텍스트 발신. 성공 응답의 message.maskedBody 가 화면에 렌더될 유일한 본문이다
 * (낙관적 말풍선은 이 값으로 교체 — D4-10).
 */
export async function sendMessageAction(
  matchId: string,
  body: string,
  meta: { isFirst?: boolean; turnCount?: number } = {},
): Promise<ChatResult<SendMessageData>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<SendMessageData>();

  const res = await sendMessage({ matchId, body }, profileId);
  if (res.ok) {
    if (meta.isFirst) {
      void logAppEvent("first_message_sent", { match_id: matchId, via_suggestion: false });
    }
    void logAppEvent("message_sent", { match_id: matchId, turn_count: meta.turnCount ?? null });
  }
  return res;
}

/** 이미지 발신 — 파일 업로드(Storage)는 클라이언트가 먼저 끝내고 경로만 넘긴다. */
export async function sendImageMessageAction(
  matchId: string,
  imagePath: string,
): Promise<ChatResult<SendMessageData>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<SendMessageData>();

  const res = await sendMessage({ matchId, imagePath }, profileId);
  if (res.ok) void logAppEvent("message_sent", { match_id: matchId, kind: "image" });
  return res;
}

/**
 * 제안 카드 발신 — 본문이 아니라 **인덱스**로 보낸다(D4-9).
 * 문구 위조 방지 + 오프라인 제안의 공공장소 권장 문구 자동 부착이 서버에서 보장된다.
 */
export async function sendSuggestionAction(
  matchId: string,
  index: number,
  meta: { isFirst?: boolean; suggestionType?: string } = {},
): Promise<ChatResult<SendMessageData>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<SendMessageData>();

  const res = await sendSuggestion(matchId, index, profileId);
  if (res.ok) {
    void logAppEvent("suggestion_tap", {
      match_id: matchId,
      suggestion_type: meta.suggestionType ?? "hobby",
    });
    if (meta.isFirst) {
      void logAppEvent("first_message_sent", { match_id: matchId, via_suggestion: true });
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// 조회 / 읽음
// ---------------------------------------------------------------------------

/** 과거 더 불러오기 — keyset(before = 현재 페이지에서 가장 오래된 id) */
export async function loadOlderMessagesAction(
  matchId: string,
  before: number,
): Promise<ChatResult<MessagePage>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<MessagePage>();
  return getMessages(matchId, profileId, { before });
}

/**
 * Realtime 재구독(onResync) 직후 갭 복구 — broadcast 는 at-most-once 이므로
 * 끊긴 동안의 메시지는 이 호출로만 메울 수 있다(D4 §4.3 · E3 규약 2).
 */
export async function resyncMessagesAction(
  matchId: string,
  afterId: number,
): Promise<ChatResult<ChatMessage[]>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<ChatMessage[]>();
  return getMessagesSince(matchId, profileId, afterId);
}

/**
 * 읽음 처리 — mark_read(match_id) RPC 만 사용한다(read_at 직접 update 금지).
 * 호출 지점은 방 진입 1회 + 포커스 복귀 1회 (E3 규약 3).
 */
export async function markReadAction(matchId: string): Promise<ChatResult<number>> {
  const profileId = await currentProfileId();
  if (!profileId) return authFail<number>();
  return markRead(matchId, profileId);
}
