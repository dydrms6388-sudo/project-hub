// =============================================================================
// D4 · 채팅 조회/액션 서버 함수 (apps/web/lib/chat/queries.ts)
//
// 규약:
// - 전부 서버 전용 — Server Component / Server Action / Route Handler 에서만 호출.
//   (클라이언트 구독 헬퍼는 lib/chat/realtime.ts 에 분리돼 있다.)
// - 결과는 ActionResult 패턴(15_auth D2-1: throw 대신 {ok, code, message}).
//   채팅 도메인 에러 코드는 ChatErrorCode 로 이 파일이 소유한다
//   (lib/auth/schemas.ts 는 D2 소유 — 수정 금지 제약. D3 도 동일 방식).
// - 메시지 발신은 **send-message Edge Function 이 유일한 경로**다(14_schema D1 규약 ④).
//   클라이언트/서버 모두 messages INSERT 권한 자체가 없다. 이 파일의 sendMessage 는
//   그 Edge Function 을 유저 JWT 로 호출하는 얇은 래퍼이며, 에러 코드를 그대로 전달한다.
// - 읽음 처리는 mark_read(match_id) RPC(00009) — 참여자 검증 + message_read
//   broadcast 1회를 보장한다. read_at 을 직접 update 하지 말 것.
// - 목록은 chat_rooms 뷰(00009), 메시지는 (match_id, id desc) keyset 페이지네이션.
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import type { Json, MatchStatus, ProfileMode, VerifyLevel } from "@duckmate/db";

// ---------------------------------------------------------------------------
// 결과 타입 (ActionResult 패턴 — 채팅 도메인 코드)
// ---------------------------------------------------------------------------

export type ChatErrorCode =
  // 공통
  | "AUTH_REQUIRED" //          세션 없음
  | "PROFILE_NOT_FOUND" //      내 프로필 없음
  | "PROFILE_MISMATCH" //       인자 profileId ≠ 세션 프로필 (IDOR 방어)
  | "INVALID_INPUT" //          입력 검증 실패 (빈 본문·길이 초과·경로 규약 위반)
  | "MATCH_NOT_FOUND" //        비참여자·차단·삭제 — 존재 자체를 노출하지 않는다
  | "MATCH_CLOSED" //           언매치/종료된 방
  | "DB_ERROR"
  // send-message Edge Function 이 그대로 돌려주는 코드 (A5 §5.2)
  | "VERIFY_LEVEL_REQUIRED" //  Lv2 미만 발신 / 이미지 전송 시 양측 Lv2 미만
  | "SANCTIONED" //             활성 제재 level≥2 (발신 정지) 또는 비활성 계정
  | "PARTNER_LEFT" //           상대 탈퇴·비활성 (12_flows §8.10)
  | "BLOCKED" //                차단 관계 (차단 사실은 비노출 문구)
  | "IMAGE_NOT_FOUND" //        업로드되지 않은 image_path
  | "MESSAGE_BLOCKED" //        BLOCK_SEND — 전송 자체 거부
  | "EDGE_UNAVAILABLE"; //      Edge Function 호출 실패(네트워크/5xx) — 재전송 대상

export type ChatResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ChatErrorCode; message: string };

function fail(code: ChatErrorCode, message: string): ChatResult<never> {
  return { ok: false, code, message };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/chat/queries.ts 는 서버 전용입니다 — 클라이언트에서 import 금지");
  }
}

// ---------------------------------------------------------------------------
// 공개 도메인 타입 (E3 가 그대로 쓰는 형태 — snake_case 행을 camelCase 로 정규화)
// ---------------------------------------------------------------------------

/** 클라이언트가 볼 수 있는 메시지 (원문 body·mask_rules 는 존재하지 않는다) */
export interface ChatMessage {
  id: number;
  matchId: string;
  /** null = 탈퇴한 상대가 보낸 과거 메시지 */
  senderId: string | null;
  /** R1~R5 마스킹이 적용된 유일한 본문 */
  maskedBody: string;
  imagePath: string | null;
  readAt: string | null;
  createdAt: string;
  /** 내가 보낸 메시지인가 (말풍선 좌/우) */
  mine: boolean;
}

export interface ChatRoom {
  matchId: string;
  status: MatchStatus;
  matchedAt: string;
  closedAt: string | null;
  /** 첫 대화 제안 카드 3개 (D3 사전 생성) — lib/chat/suggestion.ts 로 파싱 */
  firstSuggestion: Json | null;
  /** 상대 탈퇴/차단/정지로 조회 불가면 null (12_flows §8.10 익명 처리) */
  partnerId: string | null;
  partner: {
    nickname: string;
    verifyLevel: VerifyLevel;
    favNote: string | null;
    currentObsession: string | null;
    mode: ProfileMode;
    regionCode: string;
  } | null;
  lastMessage: {
    id: number;
    body: string;
    senderId: string | null;
    imagePath: string | null;
    createdAt: string;
    mine: boolean;
  } | null;
  unreadCount: number;
  /** 정렬 키 = 마지막 메시지 시각, 없으면 matched_at */
  sortAt: string;
  /** A5 §5.3 해제 상태 (matched_at+72h && 양측 Lv≥2) — 마스킹 안내 바 문구 분기 */
  contactUnlocked: boolean;
  /** 메시지가 아직 0건 = /chat 상단 "새 매칭" 스트립 대상 (12_flows §4.1) */
  isNew: boolean;
}

export interface MessagePage {
  /** 오름차순(오래된 → 최신). 화면은 그대로 아래로 렌더 */
  messages: ChatMessage[];
  /** 더 과거 메시지가 있는가 */
  hasMore: boolean;
  /** 다음 호출의 before 값 (이 페이지에서 가장 오래된 id). 없으면 null */
  nextCursor: number | null;
}

export interface SendMessageData {
  message: ChatMessage;
  /** WARN/QUEUE 시 발신자에게 노출할 일반 문구 (탐지 로직 비노출 — A5 §5.2) */
  warn: { message: string } | null;
}

/** 채팅 발신 상한 — send-message Edge Function 의 MAX_BODY_LENGTH 와 동일 */
export const MAX_MESSAGE_LENGTH = 2000;

/** D2 §5 규약: messages.image_path = "chat-images/{match_id}/{uuid}.webp" */
const CHAT_IMAGE_PATH_RE =
  /^chat-images\/[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Ctx = { supabase: SupabaseServerClient; profileId: string };

/** 세션 프로필 로드 + 인자 profileId 일치 검증 (IDOR 방어 — D3 와 동일 규약) */
async function getOwnCtx(profileId: string): Promise<ChatResult<Ctx>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return fail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");
  const myId = (profile as { id: string }).id;
  if (myId !== profileId) return fail("PROFILE_MISMATCH", "본인 프로필로만 호출할 수 있어요.");

  return { ok: true, data: { supabase, profileId: myId } };
}

interface ChatRoomRow {
  match_id: string;
  status: MatchStatus;
  matched_at: string;
  closed_at: string | null;
  first_suggestion: Json | null;
  my_profile_id: string | null;
  partner_id: string | null;
  partner_nickname: string | null;
  partner_verify_level: VerifyLevel | null;
  partner_fav_note: string | null;
  partner_current_obsession: string | null;
  partner_mode: ProfileMode | null;
  partner_region_code: string | null;
  last_message_id: number | null;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_message_image_path: string | null;
  last_message_at: string | null;
  unread_count: number;
  sort_at: string;
  contact_unlocked: boolean;
}

function toChatRoom(row: ChatRoomRow, myId: string): ChatRoom {
  return {
    matchId: row.match_id,
    status: row.status,
    matchedAt: row.matched_at,
    closedAt: row.closed_at,
    firstSuggestion: row.first_suggestion,
    partnerId: row.partner_id,
    partner:
      row.partner_nickname === null
        ? null
        : {
            nickname: row.partner_nickname,
            verifyLevel: (row.partner_verify_level ?? 0) as VerifyLevel,
            favNote: row.partner_fav_note,
            currentObsession: row.partner_current_obsession,
            mode: (row.partner_mode ?? "friend") as ProfileMode,
            regionCode: row.partner_region_code ?? "",
          },
    lastMessage:
      row.last_message_id === null
        ? null
        : {
            id: row.last_message_id,
            body: row.last_message_body ?? "",
            senderId: row.last_message_sender_id,
            imagePath: row.last_message_image_path,
            createdAt: row.last_message_at ?? row.matched_at,
            mine: row.last_message_sender_id === myId,
          },
    unreadCount: row.unread_count ?? 0,
    sortAt: row.sort_at,
    contactUnlocked: row.contact_unlocked,
    isNew: row.last_message_id === null,
  };
}

interface MessageRow {
  id: number;
  match_id: string;
  sender_id: string | null;
  masked_body: string;
  image_path: string | null;
  read_at: string | null;
  created_at: string;
}

function toChatMessage(row: MessageRow, myId: string): ChatMessage {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    maskedBody: row.masked_body,
    imagePath: row.image_path,
    readAt: row.read_at,
    createdAt: row.created_at,
    mine: row.sender_id === myId,
  };
}

// ---------------------------------------------------------------------------
// getChatRooms — /chat 목록 (F-CHT-01)
// ---------------------------------------------------------------------------

/**
 * chat_rooms 뷰(00009)를 유저 세션으로 읽는다 — RLS 가 참여자·차단을 자동 필터.
 * 정렬: 활성 방 우선, 그 안에서 sort_at 내림차순. "새 매칭"(isNew) 은 E3 가
 * 상단 스트립으로 분리 렌더한다(12_flows §4.1). 7일 무응답 하단 정렬 규칙도
 * lastMessage.createdAt 으로 E3 가 판단한다(재촉 문구 금지).
 */
export async function getChatRooms(profileId: string): Promise<ChatResult<ChatRoom[]>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .order("sort_at", { ascending: false });
  if (error) return fail("DB_ERROR", error.message);

  const rooms = ((data ?? []) as ChatRoomRow[]).map((row) => toChatRoom(row, profileId));
  rooms.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0;
  });
  return { ok: true, data: rooms };
}

// ---------------------------------------------------------------------------
// getChatRoom — 대화방 단건 헤더 (상대 카드 요약·마스킹 상태 바)
// ---------------------------------------------------------------------------

export async function getChatRoom(
  matchId: string,
  profileId: string,
): Promise<ChatResult<ChatRoom>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const { data, error } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message);
  if (!data) return fail("MATCH_NOT_FOUND", "대화방을 찾을 수 없어요.");

  return { ok: true, data: toChatRoom(data as ChatRoomRow, profileId) };
}

// ---------------------------------------------------------------------------
// getMessages — (match_id, id desc) keyset 페이지네이션 (F-CHT-02)
// ---------------------------------------------------------------------------

export interface GetMessagesOptions {
  /** 이 id 보다 과거(작은 id)만 가져온다. 첫 페이지는 생략 */
  before?: number | null;
  /** 기본 30, 최대 100 */
  limit?: number;
}

/**
 * offset 이 아니라 keyset 을 쓰는 이유: created_at 동률/실시간 삽입 중에도 페이지
 * 경계가 밀리지 않는다(idx_messages_pagination = (match_id, id desc)).
 * 반환 배열은 항상 오름차순이며, 더 과거를 가져오려면 nextCursor 를 before 로 넘긴다.
 * Realtime 재연결 후 누락분 복구는 getMessagesSince(matchId, afterId) 를 쓴다.
 */
export async function getMessages(
  matchId: string,
  profileId: string,
  options: GetMessagesOptions = {},
): Promise<ChatResult<MessagePage>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  let query = supabase
    .from("messages")
    .select("id, match_id, sender_id, masked_body, image_path, read_at, created_at")
    .eq("match_id", matchId)
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (typeof options.before === "number") query = query.lt("id", options.before);

  const { data, error } = await query;
  if (error) return fail("DB_ERROR", error.message);

  const rows = (data ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const oldest = page[page.length - 1];

  return {
    ok: true,
    data: {
      messages: page.map((r) => toChatMessage(r, profileId)).reverse(),
      hasMore,
      nextCursor: hasMore && oldest ? oldest.id : null,
    },
  };
}

/**
 * afterId 이후(더 최신) 메시지 전량 — Realtime 재연결 직후 누락 복구용.
 * broadcast 는 at-most-once 이므로 재구독 시 반드시 이 함수로 갭을 메운다(E3 규약).
 */
export async function getMessagesSince(
  matchId: string,
  profileId: string,
  afterId: number,
): Promise<ChatResult<ChatMessage[]>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const { data, error } = await supabase
    .from("messages")
    .select("id, match_id, sender_id, masked_body, image_path, read_at, created_at")
    .eq("match_id", matchId)
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(MAX_PAGE_SIZE);
  if (error) return fail("DB_ERROR", error.message);

  return { ok: true, data: ((data ?? []) as MessageRow[]).map((r) => toChatMessage(r, profileId)) };
}

// ---------------------------------------------------------------------------
// sendMessage — send-message Edge Function 래퍼 (F-CHT-03)
// ---------------------------------------------------------------------------

export interface SendMessageInput {
  matchId: string;
  /** 본문. 이미지만 보낼 때는 빈 문자열 허용 */
  body?: string;
  /** "chat-images/{match_id}/{uuid}.webp" — Storage 업로드 성공 후에만 */
  imagePath?: string | null;
}

/** Edge Function 이 반환하는 에러 코드 문자열 → ChatErrorCode */
const EDGE_ERROR_CODES: ReadonlySet<string> = new Set<ChatErrorCode>([
  "INVALID_INPUT",
  "AUTH_REQUIRED",
  "PROFILE_NOT_FOUND",
  "VERIFY_LEVEL_REQUIRED",
  "SANCTIONED",
  "MATCH_NOT_FOUND",
  "MATCH_CLOSED",
  "PARTNER_LEFT",
  "BLOCKED",
  "IMAGE_NOT_FOUND",
  "MESSAGE_BLOCKED",
  "DB_ERROR",
]);

/**
 * 발신의 유일한 경로. 마스킹(R1~R5)·자동 탐지 조치(LOG~BLOCK_SEND)·insert 는
 * 전부 Edge Function 이 service role 로 수행한다 — 여기서는 절대 messages 에
 * 쓰지 않는다(권한도 없다).
 *
 * 반환된 message 는 이미 마스킹된 masked_body 를 담고 있으므로 낙관적 UI 는
 * "전송 중" 말풍선을 이 응답으로 교체해야 한다(로컬 원문을 그대로 렌더 금지 —
 * 마스킹 결과와 화면이 어긋난다).
 *
 * 실패 시 EDGE_UNAVAILABLE 은 재전송 대상(12_flows §8.4 로컬 큐 보존),
 * MESSAGE_BLOCKED 는 재전송 금지(내용 자체가 거부됨).
 */
export async function sendMessage(
  input: SendMessageInput,
  profileId: string,
): Promise<ChatResult<SendMessageData>> {
  assertServerOnly();

  const body = input.body ?? "";
  const imagePath = input.imagePath ?? null;
  if (!body.trim() && !imagePath) {
    return fail("INVALID_INPUT", "메시지 내용 또는 이미지가 필요해요.");
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    return fail("INVALID_INPUT", `메시지는 ${MAX_MESSAGE_LENGTH}자까지 보낼 수 있어요.`);
  }
  if (imagePath && !CHAT_IMAGE_PATH_RE.test(imagePath)) {
    return fail("INVALID_INPUT", "이미지 경로 규약(chat-images/{match_id}/{uuid}.webp) 위반이에요.");
  }

  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return fail("EDGE_UNAVAILABLE", "메시지를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.");
  }

  let payload: unknown;
  let status = 0;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        match_id: input.matchId,
        body,
        ...(imagePath ? { image_path: imagePath } : {}),
      }),
      cache: "no-store",
    });
    status = res.status;
    payload = await res.json();
  } catch {
    return fail("EDGE_UNAVAILABLE", "연결이 불안정해요. 잠시 후 다시 시도해 주세요.");
  }

  const result = payload as
    | { ok: true; data: { message: MessageRow; warn: { message: string } | null } }
    | { ok: false; code?: string; message?: string }
    | null;

  if (!result || typeof result !== "object") {
    return fail("EDGE_UNAVAILABLE", "메시지를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.");
  }

  if (result.ok === false) {
    const code = result.code && EDGE_ERROR_CODES.has(result.code) ? (result.code as ChatErrorCode) : "DB_ERROR";
    return fail(code, result.message ?? "메시지를 보낼 수 없어요.");
  }
  if (status >= 500 || result.ok !== true) {
    return fail("EDGE_UNAVAILABLE", "메시지를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.");
  }

  return {
    ok: true,
    data: {
      message: toChatMessage(result.data.message, profileId),
      warn: result.data.warn,
    },
  };
}

// ---------------------------------------------------------------------------
// markRead — 읽음 처리 (F-CHT-04)
// ---------------------------------------------------------------------------

/**
 * mark_read(match_id) RPC(00009). 상대가 보낸 미읽음 메시지를 한 문장으로 갱신하고
 * message_read broadcast 를 1회만 발사한다. 반환 = 갱신된 건수(0 이면 no-op).
 * 방 진입 시 1회 + 포커스 복귀 시 1회 호출을 권장(E3 규약).
 */
export async function markRead(matchId: string, profileId: string): Promise<ChatResult<number>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const { data, error } = await supabase.rpc("mark_read", { p_match_id: matchId });
  if (error) {
    if (error.message.includes("DUCKMATE_MATCH_NOT_FOUND")) {
      return fail("MATCH_NOT_FOUND", "대화방을 찾을 수 없어요.");
    }
    if (error.message.includes("DUCKMATE_AUTH_REQUIRED")) {
      return fail("AUTH_REQUIRED", "로그인이 필요해요.");
    }
    return fail("DB_ERROR", error.message);
  }
  return { ok: true, data: typeof data === "number" ? data : 0 };
}

// ---------------------------------------------------------------------------
// getUnreadTotal — 하단 탭 배지 (채팅 탭 안읽음 합계)
// ---------------------------------------------------------------------------

export async function getUnreadTotal(profileId: string): Promise<ChatResult<number>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const { data, error } = await supabase
    .from("chat_rooms")
    .select("unread_count, status")
    .eq("status", "active");
  if (error) return fail("DB_ERROR", error.message);

  const total = ((data ?? []) as { unread_count: number }[]).reduce(
    (sum, r) => sum + (r.unread_count ?? 0),
    0,
  );
  return { ok: true, data: total };
}
