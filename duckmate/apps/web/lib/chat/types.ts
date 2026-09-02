/**
 * 채팅 도메인 타입·상수 (E3 화면 ↔ D4 서버 액션 공용). 런타임 의존성 없음.
 *
 * RPC 타입은 `packages/db/src/types.ts` 의 `Database.Functions` 에 아직 없다(D4 경로 제한) → `rpc.ts` 의 `callRpc()` 로 호출하고
 * 여기 정의한 결과 타입으로 좁힌다. 오케스트레이터 병합 시 types.ts 에 옮긴다(17_chat.md 병합 요청).
 */
import type { Enums, MessageView, VerifyLevel } from "@duckmate/db";
import type { SafetyRuleId } from "@duckmate/db/safety-rules";

export const CHAT_MESSAGE_MAX_LEN = 2000;
export const CHAT_PAGE_SIZE = 50;
export const CHAT_DAILY_CAP_PER_MATCH = 200;
export const CHAT_UNANSWERED_STREAK_CAP = 20;
export const CHAT_RATE_PER_MIN = 30;
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_BUCKET = "chat-images";
export const CHAT_IMAGE_URL_TTL_SEC = 3600;
export const CHAT_IMAGE_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** v_messages 행 (RLS: display_body = 본인 원문 / 상대 masked) */
export type ChatMessage = MessageView;

/** get_chat_list() 원소 */
export type ChatListItem = {
  match_id: string;
  status: Enums["match_status"];
  mode: Enums["profile_mode"];
  matched_at: string;
  first_message_at: string | null;
  last_message_at: string | null;
  ended_at: string | null;
  partner_id: string;
  partner_nickname: string | null;
  partner_verify_level: VerifyLevel;
  partner_status: Enums["profile_status"];
  partner_age_band: string | null;
  partner_sigungu: string | null;
  partner_photo_path: string | null;
  unread_count: number;
  last_preview: string | null;
  /** matched_at+72h 경과 AND 양쪽 L3 → 연락처 원문 전달 */
  contact_unmasked: boolean;
  unmask_at: string;
  both_l3: boolean;
  image_allowed: boolean;
  image_allowed_at: string;
  can_send: boolean;
  my_sanction_level: number;
  /** 내가 이 방에서 마스킹된 연락처 히트를 낸 메시지 수(3회↑ 경고 배너) */
  my_contact_hits: number;
  /** 상대의 SC_MONEY/SC_INVEST hit(7일) → A5 §10.3 스캠 배너 */
  partner_scam_banner: boolean;
  /** getChatRoom 에서만 채움 */
  first_suggestion: unknown | null;
};

export type ChatRoom = ChatListItem;

/** send_message RPC 반환 */
export type SendMessageResult = {
  message_id: string;
  masked_body: string;
  is_held: boolean;
  unmasked: boolean;
  flags: SafetyRuleId[] | string[];
  contact_hit_count: number;
  warn_contact: boolean;
  scam_banner: boolean;
  scam_score_7d: number;
  auto_actions: string[];
  created_at: string;
};

/** 서버 액션 sendMessage 응답 (E3 가 낙관적 UI 확정에 사용) */
export type SentMessage = {
  id: string;
  matchId: string;
  /** 발신자 화면 렌더용 원문(NFKC 정규화됨) */
  body: string | null;
  maskedBody: string;
  imagePath: string | null;
  isHeld: boolean;
  createdAt: string;
  /** 연락처가 마스킹돼 상대에게 [연락처 숨김] 으로 보임 → A5 §10.4 인라인 안내 */
  contactMasked: boolean;
  /** 같은 방 연락처 히트 3회↑ → "연락처 공유 시도가 반복되면 자동으로 신고돼요" */
  warnContact: boolean;
  /** 금칙어 인라인 경고(BW_SEXUAL/BW_HATE/CT_LURE 1회) */
  warnRules: string[];
  offlineMeeting: boolean;
};

export type ReportContextItem = {
  id: string;
  sender_id: string;
  is_mine: boolean;
  display_body: string | null;
  has_image: boolean;
  created_at: string;
};

/** Realtime 브로드캐스트 페이로드 — 원문 body 없음 (0030 trg_messages_broadcast) */
export type RealtimeMessagePayload = {
  id: string;
  match_id: string;
  sender_id: string;
  masked_body: string;
  image_path: string | null;
  suggestion_template_id: string | null;
  created_at: string;
  scam_signal: boolean;
};
export type RealtimeInboxPayload = {
  match_id: string;
  message_id: string;
  sender_id: string;
  preview: string;
  created_at: string;
};
export type RealtimeMatchStatusPayload = { match_id: string; status: Enums["match_status"]; ended_at: string | null };

export type RealtimeStatus = "connecting" | "connected" | "polling";

/** RPC 가 `raise exception 'CODE: detail'` 로 던지는 detail 토큰 (fromDbError 가 code 로 매핑, detail 은 message) */
export const CHAT_ERROR_DETAILS = {
  MATCH_LEFT: "대화가 종료되었어요",
  MATCH_BLOCKED: "대화가 종료되었어요",
  MATCH_PAUSED: "대화가 종료되었어요",
  BLOCKED: "대화가 종료되었어요",
  IMAGE_NOT_ALLOWED: "이미지는 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요",
  DAILY_CAP: "오늘은 이 대화에 더 보낼 수 없어요. 내일 다시 이야기해요",
  WAIT_FOR_REPLY: "상대의 답장을 기다려 주세요",
  chat_restricted: "채팅이 24시간 제한됐어요",
} as const;

export function chatErrorMessage(detail: string | undefined, fallback: string): string {
  if (!detail) return fallback;
  const key = detail.trim().split(/\s/, 1)[0] as keyof typeof CHAT_ERROR_DETAILS;
  return CHAT_ERROR_DETAILS[key] ?? fallback;
}

/** 이미지 storage 경로: chat-images/{match_id}/{message_id}.webp (D1 §0-12) */
export function chatImagePath(matchId: string, messageId: string): string {
  return `${matchId}/${messageId}.webp`;
}
