"use server";

/**
 * 채팅 화면 전용 서버 액션 래퍼 (E3). `lib/chat/queries.ts` 는 "use server" 파일이 아니라 클라이언트에서 직접 부를 수 없어
 * (페이지네이션·5초 폴링·목록 갱신용) 여기서 한 겹 감싼다. 로직은 전부 D4 소유 `lib/chat/*` 에 있다.
 */
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/auth/errors";
import { getChatList, getChatRoom, getMessages, type MessagesPage } from "@/lib/chat/queries";
import type { ChatListItem, ChatRoom } from "@/lib/chat/types";
import { partnerRiskBanner } from "@/lib/moderation/queries";

const idSchema = z.string().uuid();
const pageSchema = z.object({ before: z.string().datetime({ offset: true }).optional(), limit: z.number().int().min(1).max(100).optional() });

export async function fetchChatList(): Promise<ActionResult<ChatListItem[]>> {
  return getChatList();
}

export async function fetchChatRoom(matchId: string): Promise<ActionResult<ChatRoom>> {
  if (!idSchema.safeParse(matchId).success) return fail("INVALID_INPUT");
  return getChatRoom(matchId);
}

export async function fetchMessages(matchId: string, opts: { before?: string; limit?: number } = {}): Promise<ActionResult<MessagesPage>> {
  if (!idSchema.safeParse(matchId).success) return fail("INVALID_INPUT");
  const parsed = pageSchema.safeParse(opts);
  if (!parsed.success) return fail("INVALID_INPUT");
  return getMessages(matchId, parsed.data);
}

/** D5 `partner_risk_banner` — 실패·비로그인은 false */
export async function fetchPartnerRiskBanner(matchId: string): Promise<boolean> {
  if (!idSchema.safeParse(matchId).success) return false;
  return partnerRiskBanner(matchId);
}
