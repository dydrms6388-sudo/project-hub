"use server";

/**
 * 채팅 서버 액션 (E3). 전부 `ActionResult`, throw 없음.
 *
 *   sendMessage({ matchId, body })         → SentMessage   (TS scoreMessage 1차 → send_message RPC(service) → SQL 재마스킹 최종)
 *   markRead({ matchId })                  → { marked }
 *   leaveMatch({ matchId })                → { status, changed }
 *   getReportContext({ matchId })          → ReportContextItem[]  (신고 화면 미리보기 5개)
 *
 * 규칙: requireProfileForAction(2) → 분당 30건(rate_limits, fail-closed) → RPC. 자동 조치(신고·hold·제재)는 RPC 안에서 끝난다.
 */
import { z } from "zod";
import { scoreMessage } from "@duckmate/db/safety-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthError, fail, fromDbError, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { enforceRateLimit, rateLimitKey } from "@/lib/auth/otp";
import {
  CHAT_MESSAGE_MAX_LEN,
  CHAT_RATE_PER_MIN,
  chatErrorMessage,
  type ReportContextItem,
  type SendMessageResult,
  type SentMessage,
} from "@/lib/chat/types";

const matchIdSchema = z.object({ matchId: z.string().uuid() });
const sendSchema = z.object({
  matchId: z.string().uuid(),
  body: z.string().trim().min(1, "메시지를 입력해 주세요").max(CHAT_MESSAGE_MAX_LEN, `메시지는 ${CHAT_MESSAGE_MAX_LEN}자까지 보낼 수 있어요`),
});

const WARN_RULES = new Set(["BW_SEXUAL", "BW_HATE", "CT_LURE", "MN_SCHOOL"]);

/** RPC 에러 → 채팅 문구 (code 는 fromDbError 가 첫 토큰으로 매핑) */
function chatFailure(e: unknown) {
  const err = fromDbError(e);
  if (err.code === "INTERNAL") return toActionFailure(e);
  const message = chatErrorMessage(err.message, err.message);
  return fail(err.code, message, {
    ...(err.code === "NOT_VERIFIED" ? { redirectTo: "/verify" } : {}),
    ...(err.code === "RATE_LIMITED" ? { retryAfterSec: err.retryAfterSec ?? 60 } : {}),
  });
}

export async function sendMessage(input: unknown): Promise<ActionResult<SentMessage>> {
  try {
    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message, { field: "body" });
    const { matchId, body } = parsed.data;
    const ctx = await requireProfileForAction(2);
    if (ctx.state.sanctionLevel >= 2) return fail("SANCTIONED", "채팅이 24시간 제한됐어요");

    const admin = createAdminClient();
    await enforceRateLimit(admin, await rateLimitKey("chat_send", ctx.profileId), CHAT_RATE_PER_MIN, 60);

    // 1차: TS 룰 평가 (플래그·마스킹). 서버에서만 실행되므로 신뢰 가능
    const score = scoreMessage(body);
    const flags = score.flags.map((f) => ({ rule_id: f.ruleId, matched: f.matched, score: f.score }));

    const sent = await admin.rpc("send_message", {
      p_match_id: matchId,
      p_sender_id: ctx.profileId,
      p_body: body,
      p_image_path: null,
      p_flags: flags,
      p_client_masked: score.masked,
    });
    if (sent.error) throw sent.error;
    const r = sent.data as unknown as SendMessageResult;

    return ok({
      id: r.message_id,
      matchId,
      body: body.normalize("NFKC"),
      maskedBody: r.masked_body,
      imagePath: null,
      isHeld: r.is_held,
      createdAt: r.created_at,
      contactMasked: !r.unmasked && r.masked_body !== body.normalize("NFKC") && score.contactHits > 0,
      warnContact: r.warn_contact,
      warnRules: (r.flags as string[]).filter((f) => WARN_RULES.has(f)),
      offlineMeeting: score.offlineMeeting,
    });
  } catch (e) {
    if (e instanceof AuthError) return toActionFailure(e);
    return chatFailure(e);
  }
}

export async function markRead(input: unknown): Promise<ActionResult<{ matchId: string; marked: number }>> {
  try {
    const parsed = matchIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT");
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("mark_read", { p_match_id: parsed.data.matchId });
    if (error) throw error;
    const r = data as unknown as { match_id: string; marked: number };
    return ok({ matchId: r.match_id, marked: r.marked });
  } catch (e) {
    if (e instanceof AuthError) return toActionFailure(e);
    return chatFailure(e);
  }
}

export async function leaveMatch(input: unknown): Promise<ActionResult<{ matchId: string; status: string; changed: boolean }>> {
  try {
    const parsed = matchIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT");
    const ctx = await requireProfileForAction(1);
    const { data, error } = await ctx.supabase.rpc("leave_match", { p_match_id: parsed.data.matchId });
    if (error) throw error;
    const r = data as unknown as { match_id: string; status: string; changed: boolean };
    return ok({ matchId: r.match_id, status: r.status, changed: r.changed });
  } catch (e) {
    if (e instanceof AuthError) return toActionFailure(e);
    return chatFailure(e);
  }
}

/** 신고 화면 상단 미리보기(최근 5개). 스냅샷 50개는 create_report(D5) 가 저장 */
export async function getReportContext(input: unknown): Promise<ActionResult<ReportContextItem[]>> {
  try {
    const parsed = matchIdSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT");
    const ctx = await requireProfileForAction(1);
    const { data, error } = await ctx.supabase.rpc("get_report_context", { p_match_id: parsed.data.matchId });
    if (error) throw error;
    const r = data as unknown as ReportContextItem[] | null;
    if (r === null) return fail("FORBIDDEN");
    return ok(r);
  } catch (e) {
    if (e instanceof AuthError) return toActionFailure(e);
    return chatFailure(e);
  }
}
