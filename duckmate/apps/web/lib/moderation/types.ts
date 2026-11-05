/**
 * D5 타입 — RPC 반환 형태 + Database["public"]["Functions"] 델타(병합 요청: packages/db/src/types.ts).
 * D4 safety-rules.ts 는 아직 없으므로 최소 인터페이스만 선언(D4 파일이 생기면 import 로 교체).
 */
import type { Enums, Json, SanctionLevel } from "@duckmate/db";

// ---- D4 통합 지점 (packages/db/src/safety-rules.ts 가 소유). D5 는 rule_id 접두어와 score 만 본다 ----
export type SafetyRuleCategory = "CT" | "BW" | "SC" | "MN";
export interface SafetyRuleRef {
  id: string; // CT_PHONE / BW_VIOLENCE / SC_MONEY / MN_AGE …
  category: SafetyRuleCategory;
  /** SC_* 만 의미. message_flags.score 로 저장하면 SQL 이 그 값을 우선 사용 */
  score?: number;
}

// ---- 유저 측 ----
export type SubmitReportInput = {
  targetId: string;
  matchId?: string | null;
  reasonCode: Enums["report_reason"];
  detail?: string | null;
  surface?: Enums["report_surface"];
  /** 향후 확장(사진 신고). create_report 는 대상의 전체 사진을 스냅샷하므로 현재는 참고값 */
  photoIds?: string[];
};
export type SubmitReportResult = {
  reportId: string;
  deduped: boolean;
  priority: Enums["report_priority"];
  autoActions: string[];
  /** 완료 화면 */
  done: { title: string; sla: string; notify: string; blockDefaultChecked: boolean; blockCheckbox: string; blockHint: string; message: string | null };
};

export type BlockListItem = { blockedId: string; nickname: string | null; verifyLevel: number; blockedAt: string };

export type ActiveSanction = {
  id: string;
  level: SanctionLevel;
  reasonCode: Enums["report_reason"] | null;
  isAuto: boolean;
  startsAt: string;
  endsAt: string | null;
  acknowledgedAt: string | null;
  appealDeadline: string;
  canAppeal: boolean;
};
export type AppealState = {
  id: string;
  sanctionId: string;
  status: Enums["appeal_status"];
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  decisionDueAt: string;
};
export type MyModerationState = {
  profileId: string;
  activeLevel: number;
  active: ActiveSanction[];
  top: Pick<ActiveSanction, "id" | "level" | "reasonCode" | "startsAt" | "endsAt" | "isAuto"> | null;
  pendingWarning: { id: string; reasonCode: Enums["report_reason"] | null; startsAt: string } | null;
  appeal: AppealState | null;
  status: Enums["profile_status"];
  appealWindowDays: number;
  /** E 화면 분기: modal(1) / banner(2) / suspended(3~5) / permanent(6) / none */
  screen: "none" | "modal" | "banner" | "suspended" | "permanent";
};

export type SubmitAppealResult = { appealId: string; status: "pending"; decisionDueAt: string };

// ---- 어드민 (D8) ----
export type ReportListFilter = {
  status?: Enums["report_status"][];
  priority?: Enums["report_priority"][];
  reason_code?: Enums["report_reason"];
  assignee?: "me" | "none" | string;
  overdue?: boolean;
  legal_hold?: boolean;
  target_id?: string;
};
export type ReportListCursor = { priority: Enums["report_priority"]; due_at: string; id: string };
export type ReportListItem = {
  id: string;
  priority: Enums["report_priority"];
  due_at: string;
  reason_code: Enums["report_reason"];
  status: Enums["report_status"];
  surface: Enums["report_surface"];
  target_id: string | null;
  is_system: boolean;
  handled_by: string | null;
  detector_hit_count: number;
  legal_hold: boolean;
  created_at: string;
  handled_at: string | null;
  overdue: boolean;
  due_in_sec: number;
  target_nickname: string | null;
  target_verify_level: number | null;
  target_status: Enums["profile_status"] | null;
  target_report_count: number;
  target_sanction_level: number;
};
export type ReportListResult = { items: ReportListItem[]; next_cursor: ReportListCursor | null };

export type EvidencePhotoSigned = { photo_id: string; evidence_path: string; signed_url: string | null; error?: string };
export type ReportDetail = {
  report: Record<string, Json>;
  target: Record<string, Json> | null;
  reporter: Record<string, Json> | null;
  sanctions: Json[];
  prior_reports: Json[];
  copy_job: Record<string, Json> | null;
  risk: Record<string, Json> | null;
  suggested_level: SanctionLevel | null;
  /** TS 래퍼가 채움(서명 URL, 10분) */
  evidence_photos: EvidencePhotoSigned[];
};

export type ResolveOutcome = "confirmed" | "dismissed" | "need_info";
export type ResolveReportResult = { report_id: string; status: ResolveOutcome; sanction_id: string | null; reverted: Record<string, Json>; expires_at: string | null };

/** D7 통보 훅 행 (moderation_notifications) */
export type ModerationNotification = {
  id: number;
  audience: "admin" | "user";
  kind: string;
  profile_id: string | null;
  report_id: string | null;
  sanction_id: string | null;
  payload: Record<string, Json>;
  created_at: string;
  delivered_at: string | null;
};

// RPC 이름·인자·반환 타입은 `packages/db` 의 `Database["public"]["Functions"]` 로 병합됐다(H1/0071).
// 예전의 `ModerationFunctions` 로컬 선언과 `lib/moderation/rpc.ts` 는 삭제 — 호출은 `supabase.rpc(...)` + `unwrapRpc`.
