import "server-only";

/**
 * 어드민 RPC 어댑터 (D8).
 *
 *  1) D5 `admin_*` RPC (apps/web/lib/moderation/admin.ts 래퍼가 완성되면 그쪽으로 교체) — 이름 문자열 + 인자 타입만 여기서 고정.
 *     실제 함수 존재·시그니처는 오케스트레이터가 D5 완료 후 대조한다(21_admin.md §D5 대조표).
 *     service role 로 호출하므로 RPC 안에서 auth.uid() 가 null → **행위자는 p_actor_id 로 전달**한다.
 *  2) D8 0060 지표 RPC.
 *  3) 함수 미존재(PostgREST PGRST202) 는 `AdminRpcMissingError` 로 구분 → actions.ts 가 D8 직접 구현 폴백을 쓴다.
 *
 * Database["public"]["Functions"] 에 이 함수들이 아직 없어(D1 타입 갱신은 D5/오케스트레이터 몫) 이름·인자를 느슨하게 캐스팅한다.
 */
import type { Enums, Json, SanctionLevel } from "@duckmate/db";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { ADMIN_RPC, METRICS_RPC, type PhotoReviewDecision } from "./constants";
import type {
  ActiveUsers, DailyMetricRow, FunnelRow, GenderRow, PhotoMetrics, QueueSummary, SanctionMetricRow, SlaRow, VerifyLevelRow,
} from "./types";

export class AdminRpcMissingError extends Error {
  readonly fn: string;
  constructor(fn: string) {
    super(`RPC not found: ${fn}`);
    this.name = "AdminRpcMissingError";
    this.fn = fn;
  }
}

type LooseClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

/** 함수 이름이 Database 타입에 없는 RPC 호출. 미존재(PGRST202) → AdminRpcMissingError */
export async function adminRpc<T>(client: AdminSupabase, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const loose = client as unknown as LooseClient;
  const { data, error } = await loose.rpc(fn, args);
  if (error) {
    if (error.code === "PGRST202" || /Could not find the function/i.test(error.message)) throw new AdminRpcMissingError(fn);
    throw error;
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// D5 admin_* 어댑터 — 인자명은 D1 관례(p_*) 로 가정. 대조표 참조.
// ---------------------------------------------------------------------------
export type D5ListReportsArgs = {
  p_status?: Enums["report_status"] | null;
  p_priority?: Enums["report_priority"] | null;
  p_reason?: Enums["report_reason"] | null;
  p_overdue_only?: boolean;
  p_limit?: number;
  p_offset?: number;
};
export type D5TriageArgs = { p_report_id: string; p_priority?: Enums["report_priority"] | null; p_assignee?: string | null; p_note?: string | null; p_actor_id: string };
export type D5ResolveArgs = {
  p_report_id: string;
  p_status: "confirmed" | "dismissed" | "need_info";
  p_sanction_level?: SanctionLevel | null;
  p_sanction_duration?: string | null; // interval 문자열 ('72 hours')
  p_note: string;
  p_actor_id: string;
};
export type D5ReviewPhotoArgs = { p_photo_id: string; p_decision: "approved" | PhotoReviewDecision; p_note?: string | null; p_actor_id: string };
export type D5SearchProfilesArgs = { p_query: string; p_kind?: "nickname" | "phone_hash" | "profile_id" | "user_id"; p_limit?: number };
export type D5ProfileDetailArgs = { p_profile_id: string };
export type D5LiftSanctionArgs = { p_sanction_id: string; p_reason: string; p_actor_id: string };
export type D5DecideAppealArgs = { p_appeal_id: string; p_decision: "accepted" | "rejected"; p_note: string; p_actor_id: string };

export const d5 = {
  listReports: (c: AdminSupabase, a: D5ListReportsArgs) => adminRpc<Json>(c, ADMIN_RPC.listReports, a),
  getReport: (c: AdminSupabase, reportId: string, actorId: string) => adminRpc<Json>(c, ADMIN_RPC.getReport, { p_report_id: reportId, p_actor_id: actorId }),
  triageReport: (c: AdminSupabase, a: D5TriageArgs) => adminRpc<Json>(c, ADMIN_RPC.triageReport, a),
  resolveReport: (c: AdminSupabase, a: D5ResolveArgs) => adminRpc<Json>(c, ADMIN_RPC.resolveReport, a),
  reviewPhoto: (c: AdminSupabase, a: D5ReviewPhotoArgs) => adminRpc<Json>(c, ADMIN_RPC.reviewPhoto, a),
  searchProfiles: (c: AdminSupabase, a: D5SearchProfilesArgs) => adminRpc<Json>(c, ADMIN_RPC.searchProfiles, a),
  profileDetail: (c: AdminSupabase, a: D5ProfileDetailArgs) => adminRpc<Json>(c, ADMIN_RPC.profileDetail, a),
  liftSanction: (c: AdminSupabase, a: D5LiftSanctionArgs) => adminRpc<Json>(c, ADMIN_RPC.liftSanction, a),
  decideAppeal: (c: AdminSupabase, a: D5DecideAppealArgs) => adminRpc<Json>(c, ADMIN_RPC.decideAppeal, a),
} as const;

// ---------------------------------------------------------------------------
// D8 0060 지표 RPC
// ---------------------------------------------------------------------------
export const metricsRpc = {
  queueSummary: (c: AdminSupabase) => adminRpc<QueueSummary>(c, METRICS_RPC.queueSummary),
  activeUsers: (c: AdminSupabase) => adminRpc<ActiveUsers>(c, METRICS_RPC.activeUsers),
  daily: (c: AdminSupabase, days: number) => adminRpc<DailyMetricRow[]>(c, METRICS_RPC.daily, { p_days: days }),
  funnel: (c: AdminSupabase, days: number) => adminRpc<FunnelRow[]>(c, METRICS_RPC.funnel, { p_days: days }),
  verifyLevels: (c: AdminSupabase) => adminRpc<VerifyLevelRow[]>(c, METRICS_RPC.verifyLevels),
  gender: (c: AdminSupabase) => adminRpc<GenderRow[]>(c, METRICS_RPC.gender),
  sla: (c: AdminSupabase, days: number) => adminRpc<SlaRow[]>(c, METRICS_RPC.sla, { p_days: days }),
  sanctions: (c: AdminSupabase, days: number) => adminRpc<SanctionMetricRow[]>(c, METRICS_RPC.sanctions, { p_days: days }),
  photos: (c: AdminSupabase, days: number) => adminRpc<PhotoMetrics>(c, METRICS_RPC.photos, { p_days: days }),
} as const;

// ---------------------------------------------------------------------------
// audit_logs — RPC 밖 액션·열람만 D8 이 직접 기록 (RPC 가 기록하는 것은 중복 금지)
// ---------------------------------------------------------------------------
export type AuditInput = {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Json;
  after?: Json;
  meta?: Json;
};

export async function writeAudit(admin: AdminSupabase, input: AuditInput): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
    meta: input.meta ?? {},
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// storage 서명 URL (evidence 우선 → photos 원본). 실패 시 null (화면은 "미리보기 없음")
// ---------------------------------------------------------------------------
export async function signedUrl(admin: AdminSupabase, bucket: "photos" | "evidence" | "chat-images", path: string, ttlSec: number): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttlSec);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
