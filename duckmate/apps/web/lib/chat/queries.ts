/**
 * 채팅 읽기 쿼리 (서버 컴포넌트 / 라우트 핸들러 / 서버 액션에서 호출). 사용자 권한 클라이언트(RLS) 만 사용.
 *
 *   getChatList()                              → ChatListItem[]         TanStack ['matches']
 *   getChatRoom(matchId)                       → ChatRoom | NOT_FOUND    방 헤더·배너 파생값
 *   getMessages(matchId, { before?, limit? })  → { items, nextBefore }   TanStack ['messages', matchId], v_messages 역순 커서
 */
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { CHAT_PAGE_SIZE, type ChatListItem, type ChatMessage, type ChatRoom } from "@/lib/chat/types";

export async function getChatList(): Promise<ActionResult<ChatListItem[]>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("get_chat_list", {});
    if (error) throw error;
    return ok((data as unknown as ChatListItem[] | null) ?? []);
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function getChatRoom(matchId: string): Promise<ActionResult<ChatRoom>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("get_chat_list", { p_match_id: matchId });
    if (error) throw error;
    const room = (data as unknown as ChatRoom[] | null)?.[0];
    if (!room) return fail("NOT_FOUND", "대화방을 찾을 수 없어요");
    return ok(room);
  } catch (e) {
    return toActionFailure(e);
  }
}

export type MessagesPage = { items: ChatMessage[]; nextBefore: string | null };

/** 최신순으로 limit 개, `before`(created_at ISO) 이전 페이지. 반환 items 는 시간 오름차순 */
export async function getMessages(matchId: string, opts: { before?: string; limit?: number } = {}): Promise<ActionResult<MessagesPage>> {
  try {
    const ctx = await requireProfileForAction(2);
    const limit = Math.min(Math.max(opts.limit ?? CHAT_PAGE_SIZE, 1), 100);
    let q = ctx.supabase.from("v_messages").select("*").eq("match_id", matchId).order("created_at", { ascending: false }).limit(limit);
    if (opts.before) q = q.lt("created_at", opts.before);
    const { data, error } = await q;
    if (error) throw error;
    const desc = data ?? [];
    const nextBefore = desc.length === limit ? (desc[desc.length - 1]?.created_at ?? null) : null;
    return ok({ items: [...desc].reverse(), nextBefore });
  } catch (e) {
    return toActionFailure(e);
  }
}
