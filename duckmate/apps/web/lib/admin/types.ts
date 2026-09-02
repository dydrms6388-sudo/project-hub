/**
 * 어드민 화면·액션 타입 (D8). 런타임 의존성 없음.
 * DB Row 타입은 @duckmate/db 를 그대로 쓰고, 화면용 조합 타입만 여기 둔다.
 */
import type {
  AppealRow, AuditLogRow, BlockRow, ConsentRow, Enums, IdentityVerificationRow, MatchRow, PhotoRow, ProfileRow,
  ReportEvidence, ReportRow, SanctionLevel, SanctionRow, VerifyLevel,
} from "@duckmate/db";
import type { AdminRole, PhotoReviewDecision } from "./constants";

export type { AdminRole, PhotoReviewDecision };

// ---------------------------------------------------------------------------
// 신고 큐
// ---------------------------------------------------------------------------
export type ReportStatusFilter = Enums["report_status"] | "open" | "all";
export type ReportQueueFilters = {
  status: ReportStatusFilter;
  priority: Enums["report_priority"] | "all";
  reason: Enums["report_reason"] | "all";
  overdue: boolean;
  /** due_at 오름차순(기본) / created_at 내림차순 */
  sort: "due_at" | "created_at";
  page: number;
};

export type ReportListItem = {
  id: string;
  reporter_id: string | null;
  reporter_nickname: string | null;
  target_id: string | null;
  target_nickname: string | null;
  surface: Enums["report_surface"];
  reason_code: Enums["report_reason"];
  priority: Enums["report_priority"];
  status: Enums["report_status"];
  due_at: string;
  created_at: string;
  handled_by: string | null;
  handled_at: string | null;
  detector_hit_count: number;
  auto_actions: string[];
  /** 같은 대상에 대한 미종결 신고 수(본 건 포함) — 큐 행의 dedupe 카운트 */
  target_open_reports: number;
  /** 같은 대상 누적 신고 수(전체) */
  target_total_reports: number;
  legal_hold: boolean;
};

export type ReportQueuePage = { items: ReportListItem[]; page: number; pageSize: number; total: number };

export type ProfileSummary = {
  id: string;
  nickname: string | null;
  verify_level: VerifyLevel;
  status: Enums["profile_status"];
  mode: Enums["profile_mode"];
  gender: Enums["gender"] | null;
  birth_year: number | null;
  region_code: string | null;
  created_at: string;
  hidden_at: string | null;
  active_sanction_level: number;
};

export type ReportDetail = {
  report: ReportRow;
  evidence: ReportEvidence | null;
  reporter: ProfileSummary | null;
  target: ProfileSummary | null;
  match: Pick<MatchRow, "id" | "status" | "mode" | "matched_at" | "ended_at" | "first_message_at"> | null;
  /** 대상 유저의 다른 신고(본 건 제외, 최신순) */
  targetReports: Array<Pick<ReportRow, "id" | "reason_code" | "priority" | "status" | "created_at" | "handled_at">>;
  targetSanctions: Array<Pick<SanctionRow, "id" | "level" | "reason" | "starts_at" | "ends_at" | "revoked_at" | "report_id">>;
  /** 이 신고로 발급된 제재 */
  sanctionsFromReport: Array<Pick<SanctionRow, "id" | "level" | "reason" | "starts_at" | "ends_at" | "revoked_at">>;
  /** photo_id → 서명 URL(증거 복사본 우선, 없으면 원본). 발급 실패 시 null */
  photoUrls: Record<string, string | null>;
  /** 이 열람이 audit_logs(evidence_viewed) 로 기록됐는지 */
  audited: boolean;
};

// ---------------------------------------------------------------------------
// 사진 검수
// ---------------------------------------------------------------------------
export type PhotoAutoFlags = {
  face?: "unknown" | "none" | "one" | "many";
  detector?: "none" | "external";
  resized?: boolean;
  [k: string]: unknown;
};

export type PhotoQueueItem = {
  id: string;
  profile_id: string;
  nickname: string | null;
  profile_verify_level: VerifyLevel;
  path: string;
  is_primary: boolean;
  review_status: Enums["review_status"];
  held_reason: string | null;
  face_count: number | null;
  face_confidence: number | null;
  auto_flags: PhotoAutoFlags;
  created_at: string;
  /** 서명 URL (발급 실패 시 null) */
  url: string | null;
  /** 이 프로필의 기존 반려 횟수(24h) — 5회 → 업로드 제한 참고값 */
  recent_rejections: number;
};

export type PhotoQueueFilters = { status: "pending" | "held" | "both"; page: number };
export type PhotoQueuePage = { items: PhotoQueueItem[]; page: number; pageSize: number; total: number };

// ---------------------------------------------------------------------------
// 유저
// ---------------------------------------------------------------------------
export type UserSearchKind = "nickname" | "phone_hash" | "profile_id" | "user_id";
export type UserSearchItem = ProfileSummary & { user_id: string; last_active_at: string; onboarding_step: Enums["onboarding_step"] };

export type AuthUserSummary = {
  id: string;
  phone_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  created_at: string | null;
  /** app_metadata.role (JWT 경로) — admin_users 와 불일치 시 경고 */
  app_role: string | null;
};

export type UserDetail = {
  profile: ProfileRow;
  authUser: AuthUserSummary | null;
  identity: Array<Omit<IdentityVerificationRow, "ci_hash" | "di_hash" | "meta">>;
  photos: Array<Pick<PhotoRow, "id" | "path" | "is_primary" | "review_status" | "reject_code" | "reviewed_at" | "created_at" | "held_reason"> & { url: string | null }>;
  sanctions: SanctionRow[];
  appeals: Array<AppealRow & { sanction_level: SanctionLevel | null }>;
  reportsSent: Array<Pick<ReportRow, "id" | "target_id" | "reason_code" | "priority" | "status" | "created_at">>;
  reportsReceived: Array<Pick<ReportRow, "id" | "reporter_id" | "reason_code" | "priority" | "status" | "created_at">>;
  blocksGiven: BlockRow[];
  blocksReceived: BlockRow[];
  consents: Array<Pick<ConsentRow, "id" | "key" | "document_key" | "version" | "agreed" | "agreed_at" | "withdrawn_at" | "source">>;
  recentAudit: AuditLogRow[];
  activeSanctionLevel: number;
  matchCount: number;
  adminRole: AdminRole | null;
};

// ---------------------------------------------------------------------------
// 지표 (0060)
// ---------------------------------------------------------------------------
export type QueueSummary = {
  as_of: string;
  reports_open: number;
  reports_queued: number;
  reports_overdue: number;
  reports_overdue_p0_p2: number;
  reports_p0_open: number;
  photos_pending: number;
  photos_held: number;
  photos_oldest_pending_at: string | null;
  appeals_pending: number;
  inquiries_open: number;
};

export type ActiveUsers = { as_of: string; dau: number; wau: number; mau: number; total_active: number; total_l2_plus: number };

export type DailyMetricRow = {
  loop_date: string;
  active_users: number;
  signups: number;
  onboarding_completed: number;
  reco_count: number;
  reco_seen: number;
  reco_acted: number;
  likes: number;
  superlikes: number;
  matches: number;
  first_messages: number;
  messages: number;
  reports: number;
  sanctions: number;
  sanctions_auto: number;
};

export type FunnelRow = { ord: number; step: string; label: string; cnt: number };
export type VerifyLevelRow = { verify_level: VerifyLevel; cnt: number };
export type GenderRow = { mode: Enums["profile_mode"]; gender: string; cnt: number };
export type SlaRow = {
  priority: Enums["report_priority"];
  total: number;
  handled: number;
  within_sla: number;
  overdue_open: number;
  open_in_sla: number;
  avg_handle_minutes: number | null;
};
export type SanctionMetricRow = { level: SanctionLevel; total: number; auto_cnt: number; manual_cnt: number; revoked_cnt: number };
export type PhotoMetrics = {
  pending: number;
  held: number;
  uploaded: number;
  reviewed: number;
  approved: number;
  rejected: number;
  within_24h: number;
  pending_over_24h: number;
  reject_codes: Record<string, number>;
};

export type MetricsBundle = {
  days: number;
  active: ActiveUsers;
  daily: DailyMetricRow[];
  funnel: FunnelRow[];
  verifyLevels: VerifyLevelRow[];
  gender: GenderRow[];
  sla: SlaRow[];
  sanctions: SanctionMetricRow[];
  photos: PhotoMetrics;
};

// ---------------------------------------------------------------------------
// 감사로그
// ---------------------------------------------------------------------------
export type AuditFilters = { actor: string; action: string; target: string; page: number };
export type AuditPage = { items: AuditLogRow[]; page: number; pageSize: number; total: number };

// ---------------------------------------------------------------------------
// 액션 입력 (서버 액션 ↔ 클라이언트 폼)
// ---------------------------------------------------------------------------
export type TriageInput = { reportId: string; priority?: Enums["report_priority"]; assignToMe: boolean; note?: string };
export type ResolveInput =
  | { reportId: string; decision: "confirmed"; sanctionLevel: SanctionLevel | 0; durationHours?: number; note: string }
  | { reportId: string; decision: "dismissed"; note: string }
  | { reportId: string; decision: "need_info"; note: string };
export type PhotoReviewInput = { photoIds: string[]; decision: "approved" | PhotoReviewDecision; note?: string };
export type IssueSanctionInput = { profileId: string; level: SanctionLevel; reason: string; durationHours?: number; reportId?: string; reasonCode?: Enums["report_reason"] };
export type LiftSanctionInput = { sanctionId: string; reason: string };
export type DecideAppealInput = { appealId: string; decision: "accepted" | "rejected"; note: string };
export type ToggleHiddenInput = { profileId: string; hidden: boolean; reason: string };
export type ForceLogoutInput = { userId: string; reason: string; duration: string };
export type ScheduleDeleteInput = { profileId: string; reason: string; cancel?: boolean };
