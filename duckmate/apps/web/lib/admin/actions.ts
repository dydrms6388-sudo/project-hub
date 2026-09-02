"use server";

/**
 * 어드민 서버 액션 (D8). 전부 ActionResult 반환(throw 금지), 사유 필수, 역할 검증은 requireAdminAction + permissions.
 *
 *  쓰기 경로 우선순위:
 *   1) D5 `admin_*` RPC (api.ts 어댑터, p_actor_id 전달) — RPC 가 audit_logs 를 기록한다고 가정 → D8 은 기록하지 않는다.
 *   2) RPC 미존재(AdminRpcMissingError = PGRST202) → **D8 직접 구현 폴백**(service role update + audit_logs meta.fallback=true).
 *      D5 병합 후 오케스트레이터가 폴백 제거 여부를 결정한다(21_admin.md).
 *  RPC 밖 액션(비노출 토글·강제 로그아웃·삭제 예약·제재 발급은 0009 issue_sanction 이 자체 기록)은 D8 이 직접 audit.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Enums, SanctionLevel } from "@duckmate/db";
import { PHOTO_REJECT_CODES } from "@duckmate/db";
import { AuthError, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { getSession, invalidateGateCache } from "@/lib/auth/session";
import { AdminRpcMissingError, d5, writeAudit } from "./api";
import { requireAdminAction, type AdminContext } from "./auth";
import { ADMIN_REASON_MAX, ADMIN_REASON_MIN, AUDIT_ACTIONS, FORCE_LOGOUT_ALLOWED_DURATIONS, REPORT_OPEN_STATUSES } from "./constants";
import { canIssueSanctionLevel, canPerform, isPriorityUpgrade } from "./permissions";
import type {
  DecideAppealInput, ForceLogoutInput, IssueSanctionInput, LiftSanctionInput, PhotoReviewInput, ResolveInput, ScheduleDeleteInput,
  ToggleHiddenInput, TriageInput,
} from "./types";

const uuid = z.string().uuid();
const reason = z.string().trim().min(ADMIN_REASON_MIN, "사유를 입력해 주세요").max(ADMIN_REASON_MAX);
const priority = z.enum(["P0", "P1", "P2", "P3"]);
const sanctionLevel = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);
const hours = z.number().int().min(1).max(24 * 365).optional();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new AuthError("INVALID_INPUT", issue?.message, { field: issue?.path.join(".") || undefined });
  }
  return r.data;
}

function intervalHours(h: number | undefined): string | null {
  return h ? `${h} hours` : null;
}

function revalidateAdmin(...paths: string[]): void {
  for (const p of ["/admin", ...paths]) revalidatePath(p);
}

/** 사이드바 로그아웃 */
export async function adminSignOut(): Promise<never> {
  const { supabase } = await getSession();
  await supabase.auth.signOut();
  await invalidateGateCache();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// 신고: triage / resolve
// ---------------------------------------------------------------------------
export async function triageReport(input: unknown): Promise<ActionResult<{ reportId: string; via: "rpc" | "fallback" }>> {
  try {
    const ctx = await requireAdminAction("moderator");
    const data = parse(
      z.object({ reportId: uuid, priority: priority.optional(), assignToMe: z.boolean(), note: z.string().trim().max(ADMIN_REASON_MAX).optional() }) as z.ZodType<TriageInput>,
      input,
    );
    let via: "rpc" | "fallback" = "rpc";
    try {
      await d5.triageReport(ctx.admin, {
        p_report_id: data.reportId,
        p_priority: data.priority ?? null,
        p_assignee: data.assignToMe ? ctx.user.id : null,
        p_note: data.note ?? null,
        p_actor_id: ctx.user.id,
      });
    } catch (e) {
      if (!(e instanceof AdminRpcMissingError)) throw e;
      via = "fallback";
      await triageFallback(ctx, data);
    }
    revalidateAdmin("/admin/reports", `/admin/reports/${data.reportId}`);
    return ok({ reportId: data.reportId, via });
  } catch (e) {
    return toActionFailure(e);
  }
}

async function triageFallback(ctx: AdminContext, data: TriageInput): Promise<void> {
  const { data: report, error } = await ctx.admin.from("reports").select("id,status,priority,handled_by,due_at").eq("id", data.reportId).maybeSingle();
  if (error) throw error;
  if (!report) throw new AuthError("NOT_FOUND");
  if (!REPORT_OPEN_STATUSES.includes(report.status)) throw new AuthError("ALREADY_ACTED", "이미 종결된 신고예요");
  const patch: { status?: Enums["report_status"]; priority?: Enums["report_priority"]; handled_by?: string } = {};
  if (report.status === "queued") patch.status = "in_review";
  if (data.priority && isPriorityUpgrade(report.priority, data.priority)) patch.priority = data.priority; // 상향만(05 §3)
  if (data.assignToMe) patch.handled_by = ctx.user.id;
  const { error: upErr } = await ctx.admin.from("reports").update(patch).eq("id", data.reportId);
  if (upErr) throw upErr;
  await writeAudit(ctx.admin, {
    actorId: ctx.user.id, actorRole: ctx.role, action: "report_triaged", targetType: "report", targetId: data.reportId,
    before: { status: report.status, priority: report.priority, handled_by: report.handled_by }, after: patch,
    meta: { note: data.note ?? null, fallback: true },
  });
}

export async function resolveReport(input: unknown): Promise<ActionResult<{ reportId: string; sanctionId: string | null; via: "rpc" | "fallback" }>> {
  try {
    const ctx = await requireAdminAction("moderator");
    const data = parse(
      z.discriminatedUnion("decision", [
        z.object({ reportId: uuid, decision: z.literal("confirmed"), sanctionLevel, durationHours: hours, note: reason }),
        z.object({ reportId: uuid, decision: z.literal("dismissed"), note: reason }),
        z.object({ reportId: uuid, decision: z.literal("need_info"), note: reason }),
      ]) as z.ZodType<ResolveInput>,
      input,
    );
    if (data.decision === "confirmed" && !canIssueSanctionLevel(ctx.role, data.sanctionLevel)) {
      throw new AuthError("FORBIDDEN", `레벨 ${data.sanctionLevel} 제재는 admin 만 발급할 수 있어요`);
    }
    let via: "rpc" | "fallback" = "rpc";
    let sanctionId: string | null = null;
    try {
      const res = await d5.resolveReport(ctx.admin, {
        p_report_id: data.reportId,
        p_status: data.decision,
        p_sanction_level: data.decision === "confirmed" && data.sanctionLevel > 0 ? (data.sanctionLevel as SanctionLevel) : null,
        p_sanction_duration: data.decision === "confirmed" ? intervalHours(data.durationHours) : null,
        p_note: data.note,
        p_actor_id: ctx.user.id,
      });
      if (res && typeof res === "object" && "sanction_id" in res) sanctionId = (res as { sanction_id?: string | null }).sanction_id ?? null;
    } catch (e) {
      if (!(e instanceof AdminRpcMissingError)) throw e;
      via = "fallback";
      sanctionId = await resolveFallback(ctx, data);
    }
    revalidateAdmin("/admin/reports", `/admin/reports/${data.reportId}`, "/admin/users");
    return ok({ reportId: data.reportId, sanctionId, via });
  } catch (e) {
    return toActionFailure(e);
  }
}

async function resolveFallback(ctx: AdminContext, data: ResolveInput): Promise<string | null> {
  const { data: report, error } = await ctx.admin.from("reports").select("id,status,priority,target_id,reason_code,match_id").eq("id", data.reportId).maybeSingle();
  if (error) throw error;
  if (!report) throw new AuthError("NOT_FOUND");
  if (!REPORT_OPEN_STATUSES.includes(report.status)) throw new AuthError("ALREADY_ACTED", "이미 종결된 신고예요");

  let sanctionId: string | null = null;
  if (data.decision === "confirmed" && data.sanctionLevel > 0) {
    if (!report.target_id) throw new AuthError("INVALID_INPUT", "대상 프로필이 없어 제재를 발급할 수 없어요");
    const { data: sid, error: sErr } = await ctx.admin.rpc("issue_sanction", {
      p_profile_id: report.target_id,
      p_level: data.sanctionLevel,
      p_reason: `REPORT:${report.reason_code}: ${data.note}`,
      p_duration: intervalHours(data.durationHours),
      p_report_id: report.id,
      p_reason_code: report.reason_code,
      p_issued_by: ctx.user.id, // level≥3 은 issued_by 필수(0009)
    });
    if (sErr) throw sErr;
    sanctionId = sid; // issue_sanction 이 audit(sanction_issued) 기록
  }

  const { error: upErr } = await ctx.admin
    .from("reports")
    .update({ status: data.decision, resolution_note: data.note, handled_by: ctx.user.id, ...(data.decision !== "need_info" ? { handled_at: new Date().toISOString() } : {}) })
    .eq("id", data.reportId);
  if (upErr) throw upErr; // trg_reports_before_update 가 expires_at 계산

  const reverted: string[] = [];
  if (data.decision === "dismissed") {
    // 05 §4.4: dismissed 시 AUTO: 조치 즉시 해제 (이 신고가 만든 것만)
    const now = new Date().toISOString();
    const { data: revoked, error: rErr } = await ctx.admin
      .from("sanctions").update({ revoked_at: now, revoked_by: ctx.user.id })
      .eq("report_id", report.id).like("reason", "AUTO:%").is("revoked_at", null).select("id");
    if (rErr) throw rErr;
    if (revoked && revoked.length > 0) reverted.push(`sanctions:${revoked.length}`);
    if (report.target_id) {
      const { data: photos, error: pErr } = await ctx.admin
        .from("photos").update({ review_status: "pending", held_reason: null })
        .eq("profile_id", report.target_id).eq("review_status", "held").eq("held_reason", `AUTO:${report.reason_code}`).select("id");
      if (pErr) throw pErr;
      if (photos && photos.length > 0) reverted.push(`photos_unheld:${photos.length}`);
      if (report.reason_code === "MINOR_SUSPECT") {
        const { data: prof, error: hErr } = await ctx.admin
          .from("profiles").update({ hidden_at: null, hidden_reason: null })
          .eq("id", report.target_id).eq("hidden_reason", "MINOR_SUSPECT").select("id");
        if (hErr) throw hErr;
        if (prof && prof.length > 0) reverted.push("profile_unhidden");
      }
    }
  }

  await writeAudit(ctx.admin, {
    actorId: ctx.user.id, actorRole: ctx.role, action: "report_resolved", targetType: "report", targetId: data.reportId,
    before: { status: report.status }, after: { status: data.decision, sanction_id: sanctionId },
    meta: { note: data.note, reverted, fallback: true },
  });
  return sanctionId;
}

// ---------------------------------------------------------------------------
// 사진 검수 (단건·일괄). 승인/반려 → 트리거 recompute_verify_level 자동
// ---------------------------------------------------------------------------
export async function reviewPhotos(input: unknown): Promise<ActionResult<{ done: string[]; failed: Array<{ id: string; message: string }>; via: "rpc" | "fallback" }>> {
  try {
    const ctx = await requireAdminAction("moderator");
    const data = parse(
      z.object({
        photoIds: z.array(uuid).min(1).max(100),
        decision: z.enum(["approved", "held", ...PHOTO_REJECT_CODES]),
        note: z.string().trim().max(ADMIN_REASON_MAX).optional(),
      }) as z.ZodType<PhotoReviewInput>,
      input,
    );
    if (data.decision !== "approved" && !data.note && data.decision === "held") throw new AuthError("INVALID_INPUT", "보류 사유를 입력해 주세요", { field: "note" });
    const done: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];
    let via: "rpc" | "fallback" = "rpc";
    for (const id of data.photoIds) {
      try {
        try {
          await d5.reviewPhoto(ctx.admin, { p_photo_id: id, p_decision: data.decision, p_note: data.note ?? null, p_actor_id: ctx.user.id });
        } catch (e) {
          if (!(e instanceof AdminRpcMissingError)) throw e;
          via = "fallback";
          await reviewPhotoFallback(ctx, id, data);
        }
        done.push(id);
      } catch (e) {
        failed.push({ id, message: toActionFailure(e).message });
      }
    }
    revalidateAdmin("/admin/photos", "/admin/users");
    return ok({ done, failed, via });
  } catch (e) {
    return toActionFailure(e);
  }
}

async function reviewPhotoFallback(ctx: AdminContext, photoId: string, data: PhotoReviewInput): Promise<void> {
  const { data: photo, error } = await ctx.admin.from("photos").select("id,profile_id,review_status,reject_code,is_primary").eq("id", photoId).maybeSingle();
  if (error) throw error;
  if (!photo) throw new AuthError("NOT_FOUND");
  const now = new Date().toISOString();
  const patch =
    data.decision === "approved"
      ? { review_status: "approved" as const, reject_code: null, held_reason: null, reviewed_by: ctx.user.id, reviewed_at: now }
      : data.decision === "held"
        ? { review_status: "held" as const, reject_code: null, held_reason: `MANUAL: ${data.note ?? ""}`.trim(), reviewed_by: ctx.user.id, reviewed_at: now }
        : { review_status: "rejected" as const, reject_code: data.decision, held_reason: null, reviewed_by: ctx.user.id, reviewed_at: now };
  const { error: upErr } = await ctx.admin.from("photos").update(patch).eq("id", photoId);
  if (upErr) throw upErr;
  await writeAudit(ctx.admin, {
    actorId: ctx.user.id, actorRole: ctx.role, action: "photo_reviewed", targetType: "photo", targetId: photoId,
    before: { review_status: photo.review_status, reject_code: photo.reject_code },
    after: { review_status: patch.review_status, reject_code: patch.reject_code },
    meta: { profile_id: photo.profile_id, is_primary: photo.is_primary, note: data.note ?? null, fallback: true },
  });
}

// ---------------------------------------------------------------------------
// 제재 발급 / 해제 / 이의신청
// ---------------------------------------------------------------------------
export async function issueSanction(input: unknown): Promise<ActionResult<{ sanctionId: string }>> {
  try {
    const ctx = await requireAdminAction("moderator");
    const data = parse(
      z.object({
        profileId: uuid, level: sanctionLevel.refine((l) => l >= 1) as z.ZodType<SanctionLevel>, reason, durationHours: hours,
        reportId: uuid.optional(), reasonCode: z.string().optional() as z.ZodType<Enums["report_reason"] | undefined>,
      }) as z.ZodType<IssueSanctionInput>,
      input,
    );
    if (!canIssueSanctionLevel(ctx.role, data.level)) throw new AuthError("FORBIDDEN", `레벨 ${data.level} 제재는 admin 만 발급할 수 있어요`);
    // 0009 issue_sanction: service role 전용, audit(sanction_issued) 자체 기록. level 5 매칭 paused / 6 banned+CI 는 트리거.
    const { data: sid, error } = await ctx.admin.rpc("issue_sanction", {
      p_profile_id: data.profileId,
      p_level: data.level,
      p_reason: `ADMIN: ${data.reason}`,
      p_duration: intervalHours(data.durationHours),
      p_report_id: data.reportId ?? null,
      p_reason_code: data.reasonCode ?? null,
      p_issued_by: ctx.user.id,
    });
    if (error) throw error;
    revalidateAdmin(`/admin/users/${data.profileId}`, "/admin/users");
    return ok({ sanctionId: sid });
  } catch (e) {
    return toActionFailure(e);
  }
}

async function revokeSanctionDirect(ctx: AdminContext, sanctionId: string, why: string, action: string, extraMeta: Record<string, unknown> = {}): Promise<void> {
  const { data: s, error } = await ctx.admin.from("sanctions").select("id,profile_id,level,revoked_at,reason").eq("id", sanctionId).maybeSingle();
  if (error) throw error;
  if (!s) throw new AuthError("NOT_FOUND");
  if (s.revoked_at) throw new AuthError("ALREADY_ACTED", "이미 해제된 제재예요");
  const now = new Date().toISOString();
  const { error: upErr } = await ctx.admin.from("sanctions").update({ revoked_at: now, revoked_by: ctx.user.id }).eq("id", sanctionId);
  if (upErr) throw upErr;
  let unbanned = false;
  if (s.level === 6 && s.profile_id) {
    // 트리거는 발급만 처리하므로 영구정지 해제는 여기서 복구. blocked_ci_hashes 는 유지(수동 검토 필요 — 21_admin.md)
    const { data: p, error: pErr } = await ctx.admin
      .from("profiles").update({ status: "active", banned_at: null, hidden_at: null, hidden_reason: null })
      .eq("id", s.profile_id).eq("status", "banned").select("id");
    if (pErr) throw pErr;
    unbanned = (p?.length ?? 0) > 0;
  }
  await writeAudit(ctx.admin, {
    actorId: ctx.user.id, actorRole: ctx.role, action, targetType: "sanction", targetId: sanctionId,
    before: { level: s.level, revoked_at: null }, after: { revoked_at: now, unbanned },
    meta: { reason: why, profile_id: s.profile_id, fallback: true, ...extraMeta },
  });
}

export async function liftSanction(input: unknown): Promise<ActionResult<{ sanctionId: string; via: "rpc" | "fallback" }>> {
  try {
    const ctx = await requireAdminAction("admin");
    const data = parse(z.object({ sanctionId: uuid, reason }) as z.ZodType<LiftSanctionInput>, input);
    let via: "rpc" | "fallback" = "rpc";
    try {
      await d5.liftSanction(ctx.admin, { p_sanction_id: data.sanctionId, p_reason: data.reason, p_actor_id: ctx.user.id });
    } catch (e) {
      if (!(e instanceof AdminRpcMissingError)) throw e;
      via = "fallback";
      await revokeSanctionDirect(ctx, data.sanctionId, data.reason, "sanction_lifted");
    }
    revalidateAdmin("/admin/users");
    return ok({ sanctionId: data.sanctionId, via });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function decideAppeal(input: unknown): Promise<ActionResult<{ appealId: string; via: "rpc" | "fallback" }>> {
  try {
    const ctx = await requireAdminAction("admin");
    const data = parse(z.object({ appealId: uuid, decision: z.enum(["accepted", "rejected"]), note: reason }) as z.ZodType<DecideAppealInput>, input);
    let via: "rpc" | "fallback" = "rpc";
    try {
      await d5.decideAppeal(ctx.admin, { p_appeal_id: data.appealId, p_decision: data.decision, p_note: data.note, p_actor_id: ctx.user.id });
    } catch (e) {
      if (!(e instanceof AdminRpcMissingError)) throw e;
      via = "fallback";
      const { data: ap, error } = await ctx.admin.from("appeals").select("id,sanction_id,status,profile_id").eq("id", data.appealId).maybeSingle();
      if (error) throw error;
      if (!ap) throw new AuthError("NOT_FOUND");
      if (ap.status !== "pending") throw new AuthError("ALREADY_ACTED", "이미 판정된 이의신청이에요");
      const now = new Date().toISOString();
      const { error: upErr } = await ctx.admin.from("appeals").update({ status: data.decision, decision_note: data.note, decided_by: ctx.user.id, decided_at: now }).eq("id", ap.id);
      if (upErr) throw upErr;
      if (data.decision === "accepted") await revokeSanctionDirect(ctx, ap.sanction_id, `APPEAL_ACCEPTED: ${data.note}`, "sanction_lifted", { appeal_id: ap.id });
      await writeAudit(ctx.admin, {
        actorId: ctx.user.id, actorRole: ctx.role, action: "appeal_decided", targetType: "appeal", targetId: ap.id,
        before: { status: "pending" }, after: { status: data.decision }, meta: { note: data.note, sanction_id: ap.sanction_id, profile_id: ap.profile_id, fallback: true },
      });
    }
    revalidateAdmin("/admin/users");
    return ok({ appealId: data.appealId, via });
  } catch (e) {
    return toActionFailure(e);
  }
}

// ---------------------------------------------------------------------------
// RPC 밖 액션 — D8 이 직접 audit
// ---------------------------------------------------------------------------
export async function toggleProfileHidden(input: unknown): Promise<ActionResult<{ profileId: string; hidden: boolean }>> {
  try {
    const ctx = await requireAdminAction("moderator");
    if (!canPerform(ctx.role, "profile_hide_toggle")) throw new AuthError("FORBIDDEN");
    const data = parse(z.object({ profileId: uuid, hidden: z.boolean(), reason }) as z.ZodType<ToggleHiddenInput>, input);
    const { data: p, error } = await ctx.admin.from("profiles").select("id,hidden_at,hidden_reason").eq("id", data.profileId).maybeSingle();
    if (error) throw error;
    if (!p) throw new AuthError("NOT_FOUND");
    const patch = data.hidden ? { hidden_at: new Date().toISOString(), hidden_reason: `ADMIN: ${data.reason}` } : { hidden_at: null, hidden_reason: null };
    const { error: upErr } = await ctx.admin.from("profiles").update(patch).eq("id", data.profileId);
    if (upErr) throw upErr;
    await writeAudit(ctx.admin, {
      actorId: ctx.user.id, actorRole: ctx.role, action: data.hidden ? AUDIT_ACTIONS.profileHidden : AUDIT_ACTIONS.profileUnhidden,
      targetType: "profile", targetId: data.profileId, before: { hidden_at: p.hidden_at, hidden_reason: p.hidden_reason }, after: patch, meta: { reason: data.reason },
    });
    revalidateAdmin(`/admin/users/${data.profileId}`);
    return ok({ profileId: data.profileId, hidden: data.hidden });
  } catch (e) {
    return toActionFailure(e);
  }
}

/**
 * 강제 로그아웃 = Supabase Auth admin `ban_duration`. GoTrue 는 banned_until 동안 /user 검증·리프레시를 거부하므로
 * 서버 게이트(getUser)가 즉시 세션을 무효 처리한다(액세스 토큰 자체 만료는 최대 1h). 재로그인은 기간 후 가능.
 * (auth-js 2.112 의 admin.signOut 은 사용자 JWT 가 필요해 타 사용자에게 쓸 수 없다 → ban_duration 채택, 21_admin.md)
 */
export async function forceLogout(input: unknown): Promise<ActionResult<{ userId: string; duration: string }>> {
  try {
    const ctx = await requireAdminAction("admin");
    const data = parse(z.object({ userId: uuid, reason, duration: z.enum(FORCE_LOGOUT_ALLOWED_DURATIONS) }) as z.ZodType<ForceLogoutInput>, input);
    if (data.userId === ctx.user.id) throw new AuthError("INVALID_INPUT", "자기 자신은 강제 로그아웃할 수 없어요");
    const { error } = await ctx.admin.auth.admin.updateUserById(data.userId, { ban_duration: data.duration });
    if (error) throw new AuthError("INTERNAL", undefined, { cause: error });
    await writeAudit(ctx.admin, {
      actorId: ctx.user.id, actorRole: ctx.role, action: AUDIT_ACTIONS.forceLogout, targetType: "user", targetId: data.userId,
      after: { ban_duration: data.duration }, meta: { reason: data.reason },
    });
    revalidateAdmin("/admin/users");
    return ok({ userId: data.userId, duration: data.duration });
  } catch (e) {
    return toActionFailure(e);
  }
}

/** 계정 삭제 예약(7일 유예, D7 purge_daily) / 취소. request_delete RPC 는 본인 세션 전용이라 service role 로 직접 갱신 */
export async function scheduleAccountDelete(input: unknown): Promise<ActionResult<{ profileId: string; status: Enums["profile_status"] }>> {
  try {
    const ctx = await requireAdminAction("admin");
    const data = parse(z.object({ profileId: uuid, reason, cancel: z.boolean().optional() }) as z.ZodType<ScheduleDeleteInput>, input);
    const { data: p, error } = await ctx.admin.from("profiles").select("id,user_id,status,delete_requested_at").eq("id", data.profileId).maybeSingle();
    if (error) throw error;
    if (!p) throw new AuthError("NOT_FOUND");
    if (p.user_id === ctx.user.id) throw new AuthError("INVALID_INPUT", "자기 계정은 여기서 삭제할 수 없어요");
    let patch: { status: Enums["profile_status"]; delete_requested_at: string | null };
    if (data.cancel) {
      if (p.status !== "deleting") throw new AuthError("ALREADY_ACTED", "삭제 예약 상태가 아니에요");
      patch = { status: "active", delete_requested_at: null };
    } else {
      if (p.status === "deleting") throw new AuthError("ALREADY_ACTED", "이미 삭제 예약된 계정이에요");
      if (p.status === "banned") throw new AuthError("INVALID_INPUT", "영구정지 계정은 제재 해제 후 처리해 주세요");
      patch = { status: "deleting", delete_requested_at: new Date().toISOString() };
    }
    const { error: upErr } = await ctx.admin.from("profiles").update(patch).eq("id", data.profileId);
    if (upErr) throw upErr;
    await writeAudit(ctx.admin, {
      actorId: ctx.user.id, actorRole: ctx.role, action: data.cancel ? AUDIT_ACTIONS.accountDeleteCanceled : AUDIT_ACTIONS.accountDeleteScheduled,
      targetType: "profile", targetId: data.profileId, before: { status: p.status, delete_requested_at: p.delete_requested_at }, after: patch, meta: { reason: data.reason },
    });
    revalidateAdmin(`/admin/users/${data.profileId}`, "/admin/users");
    return ok({ profileId: data.profileId, status: patch.status });
  } catch (e) {
    return toActionFailure(e);
  }
}
