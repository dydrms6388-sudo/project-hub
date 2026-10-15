import "server-only";

/**
 * D5 어드민 서버 래퍼 (D8 어드민 UI/라우트가 호출). service role + p_actor_id — 역할은 SQL 이 admin_users 에서 다시 확인한다.
 * 호출 전 requireAdmin() 으로 세션을 확인하고, 그 user.id 를 actor 로 넘긴다. 증거 서명 URL 은 여기서 발급(SQL 불가, 10분).
 */
import type { Enums, Json } from "@duckmate/db";
import { STORAGE_BUCKETS } from "@duckmate/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { unwrapRpc } from "@/lib/supabase/rpc";
import type { EvidencePhotoSigned, ReportDetail, ReportListCursor, ReportListFilter, ReportListResult, ResolveOutcome, ResolveReportResult } from "./types";

export const EVIDENCE_SIGNED_URL_SEC = 600;

async function actor(role: "moderator" | "admin" = "moderator"): Promise<string> {
  const { user } = await requireAdmin(role);
  return user.id;
}

export async function adminModerationStats(): Promise<Record<string, Json>> {
  const a = await actor();
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_moderation_stats", { p_actor_id: a }));
}

export async function adminListReports(filter: ReportListFilter = {}, cursor: ReportListCursor | null = null, limit = 30): Promise<ReportListResult> {
  const a = await actor();
  return await unwrapRpc<ReportListResult>(createAdminClient().rpc("admin_list_reports", { p_actor_id: a, p_filter: filter as Json, p_cursor: (cursor as Json) ?? null, p_limit: limit }));
}

/** 상세 + evidence 버킷 서명 URL. 열람은 SQL 이 audit(evidence_viewed) */
export async function adminGetReport(reportId: string): Promise<ReportDetail> {
  const a = await actor();
  const admin = createAdminClient();
  const raw = await unwrapRpc<Omit<ReportDetail, "evidence_photos">>(admin.rpc("admin_get_report", { p_actor_id: a, p_report_id: reportId }));
  const evidence = (raw.report as { evidence?: { target_photos?: Array<{ photo_id: string; evidence_path: string }>; purged_at?: string } }).evidence;
  const photos = evidence && !evidence.purged_at ? (evidence.target_photos ?? []) : [];
  const evidence_photos: EvidencePhotoSigned[] = await Promise.all(
    photos.map(async (p) => {
      const { data, error } = await admin.storage.from(STORAGE_BUCKETS.evidence).createSignedUrl(p.evidence_path, EVIDENCE_SIGNED_URL_SEC);
      return error || !data ? { photo_id: p.photo_id, evidence_path: p.evidence_path, signed_url: null, error: error?.message ?? "missing" } : { photo_id: p.photo_id, evidence_path: p.evidence_path, signed_url: data.signedUrl };
    }),
  );
  return { ...raw, evidence_photos };
}

export async function adminTriageReport(reportId: string, opts: { priority?: Enums["report_priority"]; assigneeId?: string } = {}): Promise<Record<string, Json>> {
  const a = await actor();
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_triage_report", { p_actor_id: a, p_report_id: reportId, p_priority: opts.priority ?? null, p_assignee_id: opts.assigneeId ?? null }));
}

/** confirmed 시 level: moderator ≤3, admin ≤6 (SQL 이 강제). durationHours 는 기본값(레벨별) 덮어쓰기 */
export async function adminResolveReport(reportId: string, outcome: ResolveOutcome, opts: { sanctionLevel?: number; note?: string; durationHours?: number } = {}): Promise<ResolveReportResult> {
  const a = await actor(opts.sanctionLevel && opts.sanctionLevel > 3 ? "admin" : "moderator");
  return await unwrapRpc<ResolveReportResult>(
    createAdminClient().rpc("admin_resolve_report", {
      p_actor_id: a,
      p_report_id: reportId,
      p_outcome: outcome,
      p_sanction_level: opts.sanctionLevel ?? null,
      p_note: opts.note ?? null,
      p_duration: opts.durationHours ? `${opts.durationHours} hours` : null,
    }),
  );
}

export async function adminReviewPhoto(photoId: string, decision: "approved" | "rejected" | "held", opts: { rejectCode?: Enums["photo_reject_code"]; note?: string } = {}): Promise<Record<string, Json>> {
  const a = await actor();
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_review_photo", { p_actor_id: a, p_photo_id: photoId, p_decision: decision, p_reject_code: opts.rejectCode ?? null, p_note: opts.note ?? null }));
}

export async function adminSearchProfiles(q: string, limit = 20): Promise<Array<Record<string, Json>>> {
  const a = await actor();
  return await unwrapRpc<Array<Record<string, Json>>>(createAdminClient().rpc("admin_search_profiles", { p_actor_id: a, p_q: q, p_limit: limit }));
}

/** 사진 경로는 photos 버킷 서명 URL 로 (moderator 열람, 10분) */
export async function adminProfileDetail(profileId: string): Promise<Record<string, Json> & { photo_urls: Record<string, string | null> }> {
  const a = await actor();
  const admin = createAdminClient();
  const raw = await unwrapRpc<Record<string, Json>>(admin.rpc("admin_profile_detail", { p_actor_id: a, p_profile_id: profileId }));
  const photos = (raw.photos as Array<{ id: string; path: string }> | undefined) ?? [];
  const photo_urls: Record<string, string | null> = {};
  await Promise.all(
    photos.map(async (p) => {
      const { data } = await admin.storage.from(STORAGE_BUCKETS.photos).createSignedUrl(p.path, EVIDENCE_SIGNED_URL_SEC);
      photo_urls[p.id] = data?.signedUrl ?? null;
    }),
  );
  return { ...raw, photo_urls };
}

export async function adminLiftSanction(sanctionId: string, note?: string): Promise<Record<string, Json>> {
  const a = await actor();
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_lift_sanction", { p_actor_id: a, p_sanction_id: sanctionId, p_note: note ?? null }));
}

export async function adminDecideAppeal(appealId: string, decision: "accepted" | "rejected", note?: string): Promise<Record<string, Json>> {
  const a = await actor("admin");
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_decide_appeal", { p_actor_id: a, p_appeal_id: appealId, p_decision: decision, p_note: note ?? null }));
}

export async function adminSetLegalHold(reportId: string, hold: boolean, note?: string): Promise<Record<string, Json>> {
  const a = await actor("admin");
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("admin_set_legal_hold", { p_actor_id: a, p_report_id: reportId, p_hold: hold, p_note: note ?? null }));
}

/** 배치/점검용(라우트 핸들러 cron 이 service 로 호출; 호출자는 CRON_SECRET 검증 후). D7 purge_daily 에서 moderation_daily() 를 직접 불러도 된다 */
export async function runModerationDaily(): Promise<Record<string, Json>> {
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("moderation_daily"));
}
export async function runSlaCheck(): Promise<Record<string, Json>> {
  return await unwrapRpc<Record<string, Json>>(createAdminClient().rpc("sla_check"));
}
