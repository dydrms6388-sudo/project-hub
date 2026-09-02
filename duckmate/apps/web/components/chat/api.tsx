"use client";

/**
 * 채팅 화면이 쓰는 데이터 접근 계약 `ChatApi` + React 컨텍스트.
 * 기본값 = 실제 서버 액션(`lib/chat/*`, `lib/moderation/actions`, `app/(app)/chat/actions`) + Realtime 구독.
 * `/dev/chat` 목 라우트와 테스트는 `<ChatApiProvider api={mock}>` 로 갈아끼운다.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { ActionResult } from "@/lib/auth/errors";
import { leaveMatch, markRead, sendMessage } from "@/lib/chat/actions";
import { createChatImageUploadUrl, getChatImageUrl, sendImageMessage, type ChatImageTicket } from "@/lib/chat/images";
import type { MessagesPage } from "@/lib/chat/queries";
import { subscribeToInbox, subscribeToMatch } from "@/lib/chat/realtime";
import { CHAT_IMAGE_BUCKET, type ChatListItem, type ChatRoom, type SentMessage } from "@/lib/chat/types";
import { blockProfile } from "@/lib/moderation/actions";
import { fetchChatList, fetchChatRoom, fetchMessages, fetchPartnerRiskBanner } from "@/app/(app)/chat/actions";

export type ChatApi = {
  fetchChatList: () => Promise<ActionResult<ChatListItem[]>>;
  fetchChatRoom: (matchId: string) => Promise<ActionResult<ChatRoom>>;
  fetchMessages: (matchId: string, opts?: { before?: string; limit?: number }) => Promise<ActionResult<MessagesPage>>;
  fetchPartnerRiskBanner: (matchId: string) => Promise<boolean>;
  sendMessage: (input: { matchId: string; body: string }) => Promise<ActionResult<SentMessage>>;
  markRead: (input: { matchId: string }) => Promise<ActionResult<{ matchId: string; marked: number }>>;
  leaveMatch: (input: { matchId: string }) => Promise<ActionResult<{ matchId: string; status: string; changed: boolean }>>;
  blockProfile: (input: { targetId: string }) => Promise<ActionResult<{ targetId: string; blocked: true }>>;
  createChatImageUploadUrl: (input: { matchId: string; contentType: string; sizeBytes: number }) => Promise<ActionResult<ChatImageTicket>>;
  /** 서명 URL 로 PUT (supabase storage uploadToSignedUrl) */
  uploadImage: (ticket: ChatImageTicket, blob: Blob, contentType: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  sendImageMessage: (input: { matchId: string; messageId: string }) => Promise<ActionResult<SentMessage>>;
  getChatImageUrl: (input: { path: string }) => Promise<ActionResult<{ url: string; expiresAt: string }>>;
  subscribeToMatch: typeof subscribeToMatch;
  subscribeToInbox: typeof subscribeToInbox;
};

async function uploadImage(ticket: ChatImageTicket, blob: Blob, contentType: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().storage.from(CHAT_IMAGE_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType, upsert: false });
    if (error) return { ok: false, message: "사진을 올리지 못했어요. 다시 시도해 주세요" };
    return { ok: true };
  } catch {
    return { ok: false, message: "사진을 올리지 못했어요. 다시 시도해 주세요" };
  }
}

export const realChatApi: ChatApi = {
  fetchChatList,
  fetchChatRoom,
  fetchMessages,
  fetchPartnerRiskBanner,
  sendMessage,
  markRead,
  leaveMatch,
  blockProfile,
  createChatImageUploadUrl,
  uploadImage,
  sendImageMessage,
  getChatImageUrl,
  subscribeToMatch,
  subscribeToInbox,
};

const ChatApiContext = createContext<ChatApi>(realChatApi);

export function ChatApiProvider({ api, children }: { api: ChatApi; children: ReactNode }) {
  return <ChatApiContext.Provider value={api}>{children}</ChatApiContext.Provider>;
}

export function useChatApi(): ChatApi {
  return useContext(ChatApiContext);
}
