"use server";

/**
 * D5 유저 측 서버 액션 (E5 신고 화면·차단 모달·제재 화면·이의신청이 호출). 전부 ActionResult (15_auth §0-1).
 *
 *   submitReport({ targetId, matchId?, reasonCode, detail?, surface? })  → D1 create_report(사용자 JWT) + 완료 화면 데이터
 *   blockProfile({ targetId }) / unblockProfile({ targetId })            → apply_block / remove_block
 *   acknowledgeSanction({ sanctionId })                                   → level 1 경고 모달 확인
 *   submitAppeal({ sanctionId, body })                                    → submit_appeal (7일·1회·72h)
 */
import { z } from "zod";
import { REPORT_DETAIL_MAX, REPORT_REASON_CODES, type CreateReportResult, type Enums } from "@duckmate/db";
import { fail, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { invalidateGateCache, requireProfileForAction } from "@/lib/auth/session";
import { APPEAL_COPY, REPORT_COPY, slaCopyFor } from "./constants";
import { unwrapRpc } from "@/lib/supabase/rpc";
import type { SubmitAppealResult, SubmitReportResult } from "./types";

const reportSchema = z.object({
  targetId: z.string().uuid(),
  matchId: z.string().uuid().nullable().optional(),
  reasonCode: z.enum(REPORT_REASON_CODES as unknown as [Enums["report_reason"], ...Enums["report_reason"][]]),
  detail: z.string().trim().max(REPORT_DETAIL_MAX, `${REPORT_DETAIL_MAX}자 이내로 적어 주세요`).nullable().optional(),
  surface: z.enum(["profile", "chat"]).optional(),
  photoIds: z.array(z.string().uuid()).max(6).optional(),
});

export async function submitReport(input: unknown): Promise<ActionResult<SubmitReportResult>> {
  try {
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail("INVALID_INPUT", issue?.message, { field: String(issue?.path[0] ?? "") });
    }
    const { targetId, matchId, reasonCode, detail, surface } = parsed.data;
    const cleanDetail = detail && detail.length > 0 ? detail : null;
    if (reasonCode === "OTHER" && !cleanDetail) return fail("INVALID_INPUT", REPORT_COPY.detailRequiredForOther, { field: "detail" });

    // 신고/차단은 L0 부터 가능(A5 §2) — 온보딩 중에도 허용
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    if (targetId === ctx.profileId) return fail("INVALID_INPUT", "자기 자신은 신고할 수 없어요", { field: "targetId" });

    const { data, error } = await ctx.supabase.rpc("create_report", {
      p_target_id: targetId,
      p_reason_code: reasonCode,
      p_detail: cleanDetail,
      p_match_id: matchId ?? null,
      p_surface: surface ?? (matchId ? "chat" : "profile"),
      p_reporter_id: null,
    });
    if (error) throw error;
    const r = data as unknown as CreateReportResult;
    const sla = slaCopyFor(r.priority);
    return ok({
      reportId: r.report_id,
      deduped: r.deduped,
      priority: r.priority,
      autoActions: r.auto_actions ?? [],
      done: {
        title: REPORT_COPY.done.title,
        sla,
        notify: REPORT_COPY.done.notify,
        blockDefaultChecked: true,
        blockCheckbox: REPORT_COPY.done.blockCheckbox,
        blockHint: REPORT_COPY.done.blockHint,
        message: r.deduped ? REPORT_COPY.deduped : null,
      },
    });
  } catch (e) {
    return toActionFailure(e);
  }
}

const targetSchema = z.object({ targetId: z.string().uuid() });

export async function blockProfile(input: unknown): Promise<ActionResult<{ targetId: string; blocked: true }>> {
  try {
    const parsed = targetSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "targetId" });
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    if (parsed.data.targetId === ctx.profileId) return fail("INVALID_INPUT", "자기 자신은 차단할 수 없어요", { field: "targetId" });
    const { error } = await ctx.supabase.rpc("apply_block", { p_blocked_id: parsed.data.targetId });
    if (error) throw error;
    return ok({ targetId: parsed.data.targetId, blocked: true });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function unblockProfile(input: unknown): Promise<ActionResult<{ targetId: string; blocked: false }>> {
  try {
    const parsed = targetSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "targetId" });
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    const { error } = await ctx.supabase.rpc("remove_block", { p_blocked_id: parsed.data.targetId });
    if (error) throw error;
    return ok({ targetId: parsed.data.targetId, blocked: false });
  } catch (e) {
    return toActionFailure(e);
  }
}

const sanctionSchema = z.object({ sanctionId: z.string().uuid() });

export async function acknowledgeSanction(input: unknown): Promise<ActionResult<{ sanctionId: string; acknowledgedAt: string }>> {
  try {
    const parsed = sanctionSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", undefined, { field: "sanctionId" });
    const ctx = await requireProfileForAction(1, { allowOnboarding: true });
    const data = await unwrapRpc<{ sanction_id: string; acknowledged_at: string }>(
      ctx.supabase.rpc("acknowledge_sanction", { p_sanction_id: parsed.data.sanctionId }),
    );
    return ok({ sanctionId: data.sanction_id, acknowledgedAt: data.acknowledged_at });
  } catch (e) {
    return toActionFailure(e);
  }
}

const appealSchema = z.object({
  sanctionId: z.string().uuid(),
  body: z.string().trim().min(1, "사유를 적어 주세요").max(1000, "1,000자 이내로 적어 주세요"),
});

/** 정지 중(게이트 ③) 사용자가 /appeal 에서 호출 → 게이트를 통과하지 못하므로 세션만 확인한다 */
export async function submitAppeal(input: unknown): Promise<ActionResult<SubmitAppealResult>> {
  try {
    const parsed = appealSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail("INVALID_INPUT", issue?.message, { field: String(issue?.path[0] ?? "") });
    }
    const { getSession } = await import("@/lib/auth/session");
    const { supabase, user } = await getSession();
    if (!user) return fail("NOT_AUTHENTICATED", undefined, { redirectTo: "/login" });
    let data: { appeal_id: string; status: "pending"; decision_due_at: string };
    try {
      data = await unwrapRpc<typeof data>(supabase.rpc("submit_appeal", { p_sanction_id: parsed.data.sanctionId, p_body: parsed.data.body }));
    } catch (e) {
      const msg = (e as { message?: string }).message ?? "";
      if (msg.includes("appeal_window_closed")) return fail("NOT_ENTITLED", APPEAL_COPY.windowClosed);
      if (msg.includes("appeal_exists")) return fail("ALREADY_ACTED", APPEAL_COPY.alreadyFiled);
      if (msg.includes("minor_confirmed")) return fail("NOT_ENTITLED", APPEAL_COPY.minorNotAllowed);
      if (msg.includes("appeal_only_for_suspension")) return fail("NOT_ENTITLED", APPEAL_COPY.notSuspension);
      throw e;
    }
    await invalidateGateCache();
    return ok({ appealId: data.appeal_id, status: "pending", decisionDueAt: data.decision_due_at });
  } catch (e) {
    return toActionFailure(e);
  }
}
