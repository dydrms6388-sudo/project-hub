"use server";

/**
 * E2 홈 서버 액션.
 *   fetchHomeView()      → matching_home_summary + 채팅 미답장 수(get_chat_list 요약, 실패 0) + 안전 모달 여부
 *   markSafetyModalSeen() → profiles.safety_modal_seen_at (사용자 권한 컬럼 update, 14_schema §0-10 — 전용 RPC 없음)
 */
import { ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { getProfile, requireProfileForAction } from "@/lib/auth/session";
import { getChatList } from "@/lib/chat/queries";
import { getHomeSummary, getMatches } from "@/lib/matching/queries";
import type { HomeView } from "@/components/discover/types";

export async function fetchHomeView(): Promise<ActionResult<HomeView>> {
  const summary = await getHomeSummary();
  if (!summary.ok) return summary;
  const [chats, matches, profile] = await Promise.all([
    getChatList().catch(() => null),
    getMatches().catch(() => null),
    getProfile().catch(() => null),
  ]);
  const unansweredChats = chats && chats.ok ? chats.data.filter((c) => c.unread_count > 0).length : 0;
  const matchCount = matches && matches.ok ? matches.data.length : 0;
  const showSafetyModal = matchCount > 0 && !profile?.safety_modal_seen_at;
  return ok({ summary: summary.data, unansweredChats, matchCount, showSafetyModal });
}

export async function markSafetyModalSeen(): Promise<ActionResult<{ seenAt: string }>> {
  try {
    const ctx = await requireProfileForAction(1);
    const seenAt = new Date().toISOString();
    const { data, error } = await ctx.supabase
      .from("profiles")
      .update({ safety_modal_seen_at: seenAt })
      .eq("id", ctx.profileId)
      .is("safety_modal_seen_at", null)
      .select("safety_modal_seen_at")
      .maybeSingle();
    if (error) throw error;
    return ok({ seenAt: data?.safety_modal_seen_at ?? seenAt });
  } catch (e) {
    return toActionFailure(e);
  }
}
