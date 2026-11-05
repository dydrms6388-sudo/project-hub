/**
 * 어드민 상수 (D8). 정책 수치는 @duckmate/db 가 단일 소스이며 여기서는 어드민 화면 전용 매핑만 둔다.
 * 런타임 의존성 없음 → 클라이언트 컴포넌트에서도 import 가능(server-only 아님).
 */
import { MODERATOR_MAX_SANCTION_LEVEL, PHOTO_REJECT_CODES, PHOTO_REJECT_MESSAGES, REPORT_SLA_HOURS } from "@duckmate/db";
import type { Enums, SanctionLevel } from "@duckmate/db";

export type AdminRole = Enums["admin_role"];

/** 제재 권한 (05 §4.1 / PRD §0-47): moderator ≤ 3, admin 1~6 */
export const ROLE_MAX_SANCTION_LEVEL: Readonly<Record<AdminRole, SanctionLevel>> = {
  moderator: MODERATOR_MAX_SANCTION_LEVEL,
  admin: 6,
};

/** 어드민 액션 → 최소 역할 (PRD §0-47: 이의신청·데이터 삭제·export·7일↑ 정지는 admin) */
export const ACTION_MIN_ROLE = {
  report_triage: "moderator",
  report_resolve: "moderator",
  photo_review: "moderator",
  sanction_issue: "moderator", // 레벨은 ROLE_MAX_SANCTION_LEVEL 로 추가 제한
  sanction_lift: "moderator", // 레벨 ≤3 만(0043 admin_lift_sanction 과 동일), 4~6 은 admin
  appeal_decide: "admin",
  profile_hide_toggle: "moderator",
  force_logout: "admin",
  account_delete_schedule: "admin",
  audit_read: "admin", // audit_logs RLS 도 admin 만(0010)
  metrics_read: "moderator",
} as const satisfies Record<string, AdminRole>;
export type AdminActionKey = keyof typeof ACTION_MIN_ROLE;

/**
 * D5 어드민 RPC 이름 (apps/web/lib/moderation/admin.ts 가 완성되면 그쪽 래퍼로 교체).
 * 시그니처는 0043_admin_functions.sql 과 대조 완료(21_admin.md "D5 시그니처 대조표"). 최종 통합 검증은 오케스트레이터.
 */
export const ADMIN_RPC = {
  listReports: "admin_list_reports",
  getReport: "admin_get_report",
  triageReport: "admin_triage_report",
  resolveReport: "admin_resolve_report",
  reviewPhoto: "admin_review_photo",
  searchProfiles: "admin_search_profiles",
  profileDetail: "admin_profile_detail",
  liftSanction: "admin_lift_sanction",
  decideAppeal: "admin_decide_appeal",
  setLegalHold: "admin_set_legal_hold",
} as const;

/** D8 지표 RPC (0060) */
export const METRICS_RPC = {
  queueSummary: "admin_queue_summary",
  activeUsers: "admin_metrics_active_users",
  daily: "admin_metrics_daily",
  funnel: "admin_metrics_funnel",
  verifyLevels: "admin_metrics_verify_levels",
  gender: "admin_metrics_gender",
  sla: "admin_metrics_sla",
  sanctions: "admin_metrics_sanctions",
  photos: "admin_metrics_photos",
} as const;

/** audit_logs.action — RPC 밖에서 D8 이 직접 기록하는 것만(§7: RPC 가 기록하면 중복 기록 금지) */
export const AUDIT_ACTIONS = {
  evidenceViewed: "evidence_viewed",
  profileHidden: "profile_hidden",
  profileUnhidden: "profile_unhidden",
  forceLogout: "force_logout",
  accountDeleteScheduled: "account_delete_scheduled",
  accountDeleteCanceled: "account_delete_canceled",
  adminRpcFailed: "admin_rpc_failed",
} as const;

export const PHOTO_REJECT_LABELS: Readonly<Record<Enums["photo_reject_code"], string>> = {
  reject_no_face: "얼굴 없음/가림 (대표 사진만 반려)",
  reject_not_self: "타인·연예인·AI 생성 의심",
  reject_nudity: "노출·성적 암시",
  reject_text_contact: "연락처·SNS·QR·링크 텍스트",
  reject_minor: "미성년으로 보임 (MINOR_SUSPECT P0)",
  reject_group: "다수 인물 (대표 사진만 반려)",
  reject_quality: "저화질·과도한 필터·스크린샷",
};

/** 사진 검수 결과 8개 = 반려 코드 7(enum photo_reject_code) + held(임시 비노출). A5 §8 표(approved 제외) 8행과 1:1 */
export type PhotoReviewDecision = Enums["photo_reject_code"] | "held";
export const PHOTO_REVIEW_DECISIONS: ReadonlyArray<{ code: PhotoReviewDecision; label: string; userMessage: string; key: string }> = [
  ...PHOTO_REJECT_CODES.map((code, i) => ({ code, label: PHOTO_REJECT_LABELS[code], userMessage: PHOTO_REJECT_MESSAGES[code], key: String(i + 1) })),
  { code: "held", label: "보류(held) — 판정 대기", userMessage: "확인 중인 사진이에요", key: "8" },
];

/** 사진 검수 키보드 단축키 */
export const PHOTO_KEYS = { approve: "a", reject: "r", next: "j", prev: "k", select: "x" } as const;

export const REPORT_STATUS_LABELS: Readonly<Record<Enums["report_status"], string>> = {
  queued: "대기",
  in_review: "검토 중",
  need_info: "추가 정보",
  confirmed: "확정",
  dismissed: "기각",
};
export const REPORT_OPEN_STATUSES: ReadonlyArray<Enums["report_status"]> = ["queued", "in_review", "need_info"];
export const REPORT_PRIORITIES: ReadonlyArray<Enums["report_priority"]> = ["P0", "P1", "P2", "P3"];
export const REPORT_SLA_LABEL: Readonly<Record<Enums["report_priority"], string>> = {
  P0: `${REPORT_SLA_HOURS.P0}h`,
  P1: `${REPORT_SLA_HOURS.P1}h`,
  P2: `${REPORT_SLA_HOURS.P2}h`,
  P3: `${REPORT_SLA_HOURS.P3}h`,
};

export const APPEAL_STATUS_LABELS: Readonly<Record<Enums["appeal_status"], string>> = {
  pending: "대기",
  accepted: "인용",
  rejected: "기각",
};

export const PROFILE_STATUS_LABELS: Readonly<Record<Enums["profile_status"], string>> = {
  active: "활성",
  paused: "휴면",
  banned: "영구정지",
  age_blocked: "연령 차단",
  deleting: "탈퇴 유예",
};

/** 강제 로그아웃 = Auth ban_duration(세션·리프레시 무효화 + 재로그인 차단). 기본 1시간 */
export const FORCE_LOGOUT_DEFAULT_DURATION = "1h";
export const FORCE_LOGOUT_ALLOWED_DURATIONS = ["5m", "1h", "24h"] as const;

/** 사유 최소 길이(모든 쓰기 액션 공통) */
export const ADMIN_REASON_MIN = 2;
export const ADMIN_REASON_MAX = 500;
export const ADMIN_PAGE_SIZE = 50;
/** 서명 URL 유효 시간(초) — 증거·검수 사진 */
export const SIGNED_URL_TTL_SEC = 600;
/** 지표 기간 선택 */
export const METRICS_PERIODS = [7, 30] as const;
export type MetricsPeriod = (typeof METRICS_PERIODS)[number];
/** KPI 목표 (06_PRD §6) */
export const KPI = {
  datingFemaleRatio: 0.35,
  likeToMatch: 0.08,
  matchToFirstMessage: 0.7,
  reportRatePerMatch: 0.03,
  photoReview24h: 0.95,
  loopCompletion: 0.5,
} as const;
