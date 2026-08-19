// =============================================================================
// D8 · 신고 큐 — 조회(우선순위·SLA 임박순) / 상세(evidence 열람) / 조치 확정
//
// A5 §6 파이프라인의 ③(어드민 큐)·④(조치 확정)·을 담당한다.
//   - 큐 정렬: P0 → P1 → P2, 각 우선순위 내 sla_due_at 오름차순 (임박 우선)
//     — idx_reports_queue (priority, sla_due_at) partial 과 일치.
//   - evidence(원문 스냅샷)는 service role 전용 — 열람 자체를 audit_logs 에 남긴다.
//   - 조치: 기각(DISMISSED) 또는 제재 부과(ACTIONED + sanctions 생성).
//     레벨 5(영구정지)는 4-eyes: 부승인 어드민 검증 필수 (A5 §6-④).
//   - ⚠ 조치 확정은 **00010 의 resolve_report() RPC 단일 경로**로 수행한다
//     (G2-05). 이전 구현은 "resolve_report 는 존재하지 않는다"는 잘못된 전제로
//     다중 UPDATE 를 직접 수행했고, 그 결과 **기각(DISMISS) 시 자동 임시 제재
//     (AUTO_P0_FREEZE 등)가 REVOKED 로 해제되지 않아** 무고 신고로 걸린 72h
//     제재가 그대로 집행됐다(A5 §3.2 위반). RPC 안에 4-eyes·SLA 기록·자동 제재
//     해제·level 5 파생 처리(banned + CI 블랙리스트)가 모두 들어 있다.
// =============================================================================

import type {
  Profile,
  Report,
  ReportPriority,
  Sanction,
  SanctionLevel,
} from "@duckmate/db";
import {
  adminAudit,
  adminDb,
  adminFail,
  requireAdminActor,
  verifyCoApprover,
  type AdminResult,
} from "./service";

/** 미종결 상태 (큐 대상) — triage 후 RECEIVED 는 이론상 잔존하지 않지만 방어적으로 포함 */
export const OPEN_REPORT_STATUSES = ["RECEIVED", "AUTO_TRIAGED", "IN_REVIEW"] as const;

export interface ReportQueueFilter {
  /** 기본 open (미종결만) */
  scope?: "open" | "all";
  priority?: ReportPriority;
  /** reason_code prefix (예: "SCAM", "HARASS") 또는 전체 코드 */
  reason?: string;
  limit?: number;
}

export interface ReportQueueRow {
  id: string;
  reason_code: Report["reason_code"];
  status: Report["status"];
  priority: ReportPriority | null;
  sla_due_at: string | null;
  created_at: string;
  target_id: string | null;
  target_nickname: string | null;
  reporter_id: string | null;
}

/** 신고 큐 조회 — evidence 제외 명시 컬럼 (D1→D8 규약) */
export async function listReports(
  filter: ReportQueueFilter = {}
): Promise<AdminResult<ReportQueueRow[]>> {
  await requireAdminActor();
  const db = adminDb();

  let q = db
    .from("reports")
    .select(
      "id, reporter_id, target_id, match_id, reason_code, status, priority, sla_due_at, handled_by, handled_at, created_at"
    )
    .order("priority", { ascending: true, nullsFirst: false })
    .order("sla_due_at", { ascending: true, nullsFirst: false })
    .limit(filter.limit ?? 100);

  if ((filter.scope ?? "open") === "open") {
    q = q.in("status", [...OPEN_REPORT_STATUSES]);
  }
  if (filter.priority) q = q.eq("priority", filter.priority);
  if (filter.reason) q = q.like("reason_code", `${filter.reason}%`);

  const { data, error } = await q;
  if (error) return adminFail("DB_ERROR", error.message);

  const rows = (data ?? []) as Report[];
  const targetIds = [...new Set(rows.map((r) => r.target_id).filter((v): v is string => !!v))];
  const nicknames = new Map<string, string>();
  if (targetIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, nickname")
      .in("id", targetIds);
    for (const p of (profiles ?? []) as Pick<Profile, "id" | "nickname">[]) {
      nicknames.set(p.id, p.nickname);
    }
  }

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      reason_code: r.reason_code,
      status: r.status,
      priority: r.priority,
      sla_due_at: r.sla_due_at,
      created_at: r.created_at,
      target_id: r.target_id,
      target_nickname: r.target_id ? nicknames.get(r.target_id) ?? null : null,
      reporter_id: r.reporter_id,
    })),
  };
}

export interface ReportDetail {
  report: Report; // evidence 포함 (service role 열람 — audit 기록됨)
  target: Pick<Profile, "id" | "nickname" | "verify_level" | "status" | "mode" | "created_at"> | null;
  targetSanctions: Sanction[];
  /** 동일 대상에 대한 다른 신고 수 (30일, AUTO_3REPORTS 참고치) */
  targetReportCount30d: number;
}

/** 신고 상세 — evidence 스냅샷 열람 (열람 사실을 audit_logs 에 기록) */
export async function getReportDetail(reportId: string): Promise<AdminResult<ReportDetail>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const { data: report, error } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!report) return adminFail("NOT_FOUND", "신고를 찾을 수 없어요.");
  const r = report as Report;

  // evidence(원문) 열람 감사 기록 — A5 §4.1 목적 제한 추적
  await adminAudit(ctx.profile.id, "admin.report.evidence_view", `report:${r.id}`, {
    has_evidence: r.evidence !== null,
  });

  let target: ReportDetail["target"] = null;
  let targetSanctions: Sanction[] = [];
  let targetReportCount30d = 0;

  if (r.target_id) {
    const { data: p } = await db
      .from("profiles")
      .select("id, nickname, verify_level, status, mode, created_at")
      .eq("id", r.target_id)
      .maybeSingle();
    target = (p as ReportDetail["target"]) ?? null;

    const { data: sanctions } = await db
      .from("sanctions")
      .select("*")
      .eq("profile_id", r.target_id)
      .order("created_at", { ascending: false })
      .limit(20);
    targetSanctions = (sanctions ?? []) as Sanction[];

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("target_id", r.target_id)
      .gte("created_at", since);
    targetReportCount30d = count ?? 0;
  }

  return { ok: true, data: { report: r, target, targetSanctions, targetReportCount30d } };
}

export interface ResolveReportInput {
  reportId: string;
  decision: "sanction" | "dismiss";
  /** decision=sanction 일 때 필수 */
  sanctionLevel?: SanctionLevel;
  /** 기각 사유 또는 제재 사유 (필수 — 통보·이의제기의 근거) */
  reason: string;
  /** 레벨 5 필수 — 부승인 어드민 닉네임 (4-eyes) */
  coApproverNickname?: string;
}

/**
 * 신고 조치 확정 (A5 §6-④) — 00010 `resolve_report()` RPC 위임 (G2-05).
 *  - dismiss: status=DISMISSED + **이 신고가 부과한 자동 임시 제재 REVOKED**.
 *  - sanction: sanctions 생성 → 레벨 5 는 banned + CI 블랙리스트 → status=ACTIONED.
 *  - 통보(⑤ NOTIFIED)는 D7 알림 파이프라인 소관 — 여기서는 ACTIONED 까지만.
 */
export async function resolveReport(
  input: ResolveReportInput
): Promise<AdminResult<{ sanctionId: string | null }>> {
  const ctx = await requireAdminActor();
  const db = adminDb();

  const reason = input.reason.trim();
  if (reason.length < 2) return adminFail("INVALID_INPUT", "처리 사유를 입력해 주세요.");

  const { data: report, error } = await db
    .from("reports")
    .select("id, target_id, status, reason_code, priority")
    .eq("id", input.reportId)
    .maybeSingle();
  if (error) return adminFail("DB_ERROR", error.message);
  if (!report) return adminFail("NOT_FOUND", "신고를 찾을 수 없어요.");
  if (!(OPEN_REPORT_STATUSES as readonly string[]).includes(report.status as string)) {
    return adminFail("ALREADY_HANDLED", "이미 종결된 신고예요.");
  }

  // 레벨 5 = 4-eyes (A5 §6-④: 어드민 2인 승인). 닉네임 → id 해석은 여기서,
  // 실제 강제는 RPC 안에서도 한 번 더 이루어진다(양쪽 모두 필요).
  let coApproverId: string | null = null;
  let level: SanctionLevel | null = null;

  if (input.decision === "sanction") {
    level = input.sanctionLevel ?? null;
    if (!level || level < 1 || level > 5) {
      return adminFail("INVALID_INPUT", "제재 레벨(1~5)을 선택해 주세요.");
    }
    if (!report.target_id) {
      return adminFail("TARGET_MISSING", "신고 대상 프로필이 없어요(탈퇴 등). 기각으로 종결해 주세요.");
    }
    if (level === 5) {
      if (!input.coApproverNickname?.trim()) {
        return adminFail("FOUR_EYES_REQUIRED", "영구정지는 부승인 어드민 닉네임이 필요해요 (2인 승인).");
      }
      const co = await verifyCoApprover(ctx.profile.id, input.coApproverNickname);
      if (!co.ok) return co;
      coApproverId = co.data.coApproverId;
    }
  }

  const action = input.decision === "dismiss" ? "DISMISS" : `LEVEL_${level}`;

  // ---- 조치 확정 = resolve_report() RPC 단일 호출 (G2-05) ----
  //   RPC 가 수행하는 것: 상태 전이 검증 → 어드민 자격 → 4-eyes(level 5) →
  //   **이 신고가 만든 자동 임시 제재 REVOKED** → 제재 insert(또는 기각) →
  //   level 5 파생(banned + blocked_hashes) → reports 종결 → SLA 감사기록.
  const { data, error: rpcError } = await db.rpc("resolve_report", {
    p_report_id: input.reportId,
    p_action: action,
    p_admin_id: ctx.profile.id,
    p_reason: reason,
    p_second_admin_id: coApproverId,
  });
  if (rpcError) return mapResolveReportError(rpcError.message);

  const sanctionId = ((data as { sanction_id?: string | null } | null)?.sanction_id ?? null) as
    | string
    | null;

  // 어드민 조치 감사(admin.* 접두 — 21_admin 규약). RPC 도 moderation.resolve_report
  // 를 남기므로 두 로그가 쌍으로 남는다(어드민 화면 조회는 admin.* 기준).
  await adminAudit(
    ctx.profile.id,
    input.decision === "dismiss" ? "admin.report.dismiss" : "admin.report.resolve",
    `report:${input.reportId}`,
    {
      sanction_id: sanctionId,
      sanction_level: level,
      target_profile_id: report.target_id,
      reason_code: report.reason_code,
      reason,
      co_approver_id: coApproverId, // 레벨 5 4-eyes 증적
      via: "resolve_report_rpc",
    }
  );

  return { ok: true, data: { sanctionId } };
}

/** resolve_report() 가 raise 하는 DUCKMATE_* 예외를 AdminResult 코드로 매핑 */
function mapResolveReportError(message: string): AdminResult<never> {
  if (message.includes("DUCKMATE_REPORT_NOT_FOUND")) {
    return adminFail("NOT_FOUND", "신고를 찾을 수 없어요.");
  }
  if (message.includes("DUCKMATE_REPORT_ALREADY_RESOLVED")) {
    return adminFail("ALREADY_HANDLED", "이미 종결된 신고예요.");
  }
  if (message.includes("DUCKMATE_RESOLVE_TARGET_GONE")) {
    return adminFail("TARGET_MISSING", "신고 대상 프로필이 없어요(탈퇴 등). 기각으로 종결해 주세요.");
  }
  if (message.includes("DUCKMATE_RESOLVE_4EYES")) {
    return adminFail("FOUR_EYES_REQUIRED", "영구정지는 다른 활성 어드민 1인의 추가 승인이 필요해요.");
  }
  if (message.includes("DUCKMATE_RESOLVE_NOT_ADMIN")) {
    return adminFail("INVALID_INPUT", "어드민 권한을 확인할 수 없어요.");
  }
  if (message.includes("DUCKMATE_RESOLVE_INVALID_ACTION")) {
    return adminFail("INVALID_INPUT", "처리 유형이 올바르지 않아요.");
  }
  return adminFail("DB_ERROR", message);
}
