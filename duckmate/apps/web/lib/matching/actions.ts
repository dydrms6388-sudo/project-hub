"use server";

/**
 * D3 서버 액션 (E2 추천/매칭 화면이 호출). 전부 ActionResult, throw 없음.
 *
 *   actOnRecommendation({ targetId, action: "like"|"super"|"pass" })
 *     → { action, recoId, matched, matchId, firstSuggestion?, superlike?, already }
 *     실패: NOT_FOUND(추천에 없음) / ALREADY_ACTED / NOT_VERIFIED / SANCTIONED / NOT_ENTITLED(field=superlike: 쿼터·일상한, 그 외 대상 불가) / RATE_LIMITED(분당 30)
 *   markRecommendationSeen({ recoId })   뷰포트 50%·1초 → seen_at (한 번만)
 *   undo()                              300초 되돌리기. 무료 = NOT_ENTITLED, 만료 = NOT_FOUND("EXPIRED"), 매칭된 좋아요 = ALREADY_ACTED
 *   ensureTodayRecommendations()        홈 진입 시 온디맨드 생성(멱등)
 */
import { z } from "zod";
import type { FirstSuggestion } from "@duckmate/db";
import { AuthError, fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { enforceRateLimit, rateLimitKey } from "@/lib/auth/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc, type ActResult, type EnsureTodayResult, type SuperlikeStatus, type UndoResult } from "./rpc";
import { ensureFirstSuggestion } from "./queries";

const uuid = z.string().uuid();
const actSchema = z.object({ targetId: uuid, action: z.enum(["like", "super", "pass"]) });
const seenSchema = z.object({ recoId: uuid });

/** 좋아요/패스 분당 30건 (15_auth §0-23 공용 레이트리밋, fail-closed) */
const ACT_RATE = { limit: 30, windowSec: 60 } as const;

export type ActOnRecommendationResult = {
  action: "like" | "super" | "pass";
  recoId: string;
  loopDate: string;
  already: boolean;
  matched: boolean;
  matchId: string | null;
  /** matched=true 일 때 매칭 화면용 3장 */
  firstSuggestion?: FirstSuggestion[];
  superlike?: SuperlikeStatus | null;
  /** E2 analytics `match_created{initiator:'me'}` 용 */
  matchCreated: boolean;
};

const SUPERLIKE_MESSAGES: Record<string, string> = {
  NO_SUPERLIKE: "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전",
  SUPERLIKE_DAILY_CAP: "슈퍼라이크는 하루 5개까지 보낼 수 있어요",
};

export async function actOnRecommendation(input: unknown): Promise<ActionResult<ActOnRecommendationResult>> {
  try {
    const parsed = actSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: parsed.error.issues[0]?.path.join(".") });
    const { targetId, action } = parsed.data;
    const ctx = await requireProfileForAction(2);

    const admin = createAdminClient();
    await enforceRateLimit(admin, await rateLimitKey("reco_act", ctx.profileId), ACT_RATE.limit, ACT_RATE.windowSec);

    let r: ActResult;
    try {
      r = await callRpc<ActResult>(ctx.supabase, "act_on_recommendation", { p_target_id: targetId, p_action: action });
    } catch (e) {
      const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "";
      const m = /^NOT_ENTITLED:\s*(NO_SUPERLIKE|SUPERLIKE_DAILY_CAP)/.exec(msg);
      if (m?.[1]) return fail("NOT_ENTITLED", SUPERLIKE_MESSAGES[m[1]], { field: "superlike" });
      if (/^NOT_FOUND:\s*recommendation/.test(msg)) return fail("NOT_FOUND", "오늘 추천에 없는 상대예요");
      throw e;
    }

    let firstSuggestion: FirstSuggestion[] | undefined;
    if (r.matched && r.match_id) {
      firstSuggestion = await ensureFirstSuggestion(ctx, r.match_id, r.suggestion_input ?? null);
    }
    return ok({
      action: r.action,
      recoId: r.reco_id,
      loopDate: r.loop_date,
      already: r.already,
      matched: r.matched || (r.already && Boolean(r.match_id)),
      matchId: r.match_id ?? null,
      ...(firstSuggestion ? { firstSuggestion } : {}),
      superlike: r.superlike ?? null,
      matchCreated: r.matched && !r.already,
    });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function markRecommendationSeen(input: unknown): Promise<ActionResult<{ recoId: string; seenAt: string }>> {
  try {
    const parsed = seenSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "recoId" });
    const ctx = await requireProfileForAction(2);
    const seenAt = new Date().toISOString();
    const { data, error } = await ctx.supabase
      .from("daily_recommendations")
      .update({ seen_at: seenAt })
      .eq("id", parsed.data.recoId)
      .eq("profile_id", ctx.profileId)
      .is("seen_at", null)
      .select("id, seen_at")
      .maybeSingle();
    if (error) throw error;
    return ok({ recoId: parsed.data.recoId, seenAt: data?.seen_at ?? seenAt });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function undo(): Promise<ActionResult<{ recoId: string; targetId: string; previousAction: "like" | "super" | "pass" }>> {
  try {
    const ctx = await requireProfileForAction(2);
    try {
      const r = await callRpc<UndoResult>(ctx.supabase, "undo_last_action");
      return ok({ recoId: r.reco_id, targetId: r.target_id, previousAction: r.previous_action });
    } catch (e) {
      const msg = typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "";
      if (/^NOT_ENTITLED/.test(msg)) return fail("NOT_ENTITLED", "되돌리기는 플러스 혜택이에요");
      if (/^NOT_FOUND:\s*EXPIRED/.test(msg)) return fail("NOT_FOUND", "되돌릴 수 있는 시간(5분)이 지났어요");
      if (/^ALREADY_ACTED/.test(msg)) return fail("ALREADY_ACTED", "이미 매칭된 좋아요는 되돌릴 수 없어요");
      throw e;
    }
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function ensureTodayRecommendations(): Promise<ActionResult<EnsureTodayResult>> {
  try {
    const ctx = await requireProfileForAction(2);
    return ok(await callRpc<EnsureTodayResult>(ctx.supabase, "ensure_today_recommendations"));
  } catch (e) {
    if (e instanceof AuthError) return toActionFailure(e);
    return toActionFailure(e);
  }
}
