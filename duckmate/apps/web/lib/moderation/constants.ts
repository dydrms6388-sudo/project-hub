/**
 * D5 모더레이션 상수 — A5 §3·§4·§5·§6·§7·§8, C3 §7 의 수치·문구를 그대로 옮김.
 * SQL 원본: supabase/migrations/20260902000040_moderation_core.sql 의 moderation_settings (값이 바뀌면 여기와 08_legal_docs §0-15 문서도 함께).
 * 런타임 의존성 없음(클라이언트·서버 공용). 사유 14 메타는 @duckmate/db 의 REPORT_REASONS 가 단일 소스.
 */
import { REPORT_REASONS, REPORT_SLA_HOURS, SANCTION_LEVELS, type Enums, type SanctionLevel } from "@duckmate/db";

export type ReportReasonCode = Enums["report_reason"];
export type ReportCategoryKey = "safety" | "sexual_hate" | "profile" | "lure_commercial" | "other";

/** 신고 1단 카테고리 5 → 2단 세부 14 (C3 §7.2 표가 유일한 소스, 순서 그대로) */
export const REPORT_CATEGORIES: ReadonlyArray<{ key: ReportCategoryKey; label: string; codes: ReadonlyArray<ReportReasonCode> }> = [
  { key: "safety", label: "안전이 위협돼요", codes: ["ROMANCE_SCAM", "THREAT_VIOLENCE", "STALKING", "MINOR_SUSPECT"] },
  { key: "sexual_hate", label: "성적·혐오 표현", codes: ["SEXUAL_HARASSMENT", "HATE_SPEECH", "INAPPROPRIATE_PHOTO"] },
  { key: "profile", label: "프로필이 이상해요", codes: ["IMPERSONATION", "FAKE_PROFILE"] },
  { key: "lure_commercial", label: "외부 유도·영업", codes: ["OFF_PLATFORM_LURE", "COMMERCIAL_SPAM", "PII_REQUEST"] },
  { key: "other", label: "기타", codes: ["NO_SHOW", "OTHER"] },
];

export function categoryOf(code: ReportReasonCode): ReportCategoryKey {
  const found = REPORT_CATEGORIES.find((c) => c.codes.includes(code));
  return found?.key ?? "other";
}
export function categoryLabelOf(code: ReportReasonCode): string {
  return REPORT_CATEGORIES.find((c) => c.codes.includes(code))?.label ?? "기타";
}
/** 2단 화면용: 라벨·보조문구 (A5 §3 라벨 그대로) */
export function reasonMeta(code: ReportReasonCode): { code: ReportReasonCode; label: string; description: string; requiresDetail: boolean } {
  const meta = REPORT_REASONS.find((r) => r.code === code);
  return { code, label: meta?.label ?? code, description: meta?.description ?? "", requiresDetail: code === "OTHER" };
}

/** 신고 화면 문구 (C3 §7.3 확정본) */
export const REPORT_COPY = {
  title: "신고하기",
  step1Question: "어떤 문제인가요?",
  snapshotNotice: "신고하면 최근 50개 메시지·프로필이 자동으로 운영팀에 전달돼요. 신고자는 상대에게 알려지지 않아요.",
  evidenceNotice: "증거는 자동으로 첨부돼요. 따로 캡처하지 않아도 돼요.",
  detailLabel: "자세히 (선택, 500자)",
  detailRequiredForOther: "기타는 내용을 적어 주세요",
  submit: "신고 접수하기",
  failed: "접수하지 못했어요. 다시 시도해 주세요",
  deduped: "이미 접수된 신고에 내용을 추가했어요",
  done: {
    title: "접수됐어요.",
    sla: "24시간 안에 확인해요.",
    notify: "처리 결과는 알림으로 알려드려요.",
    blockCheckbox: "이 사람 차단도 할까요?",
    blockHint: "차단은 상대에게 알려지지 않고, 대화가 종료돼요",
    cta: "완료",
  },
  scamBannerPreselect: "ROMANCE_SCAM" as const,
} as const;

/** 우선순위별 완료 화면 SLA 문구 — 공개 약속은 "24시간 내 1차 조치"(A5 §6). P0/P1 은 더 빠른 목표를 내부 값으로만 쓴다 */
export function slaCopyFor(priority: Enums["report_priority"]): string {
  const hours = REPORT_SLA_HOURS[priority];
  if (hours <= 24) return "24시간 안에 확인해요.";
  return "접수 확인 안내를 24시간 안에 보내드리고, 3일 안에 확인해요.";
}

/** 차단 모달 (C3 §7.4) */
export const BLOCK_COPY = {
  title: (nickname: string) => `${nickname} 님을 차단할까요?`,
  bullets: [
    "서로의 프로필·추천·채팅에 더 이상 보이지 않아요",
    "진행 중인 매칭이 종료돼요",
    "상대에게 알림이 가지 않아요",
    "설정 > 차단 관리에서 해제할 수 있지만 대화는 복구되지 않아요",
  ],
  cancel: "취소",
  confirm: "차단하기",
  unblockConfirm: "해제해도 종료된 대화는 돌아오지 않아요. 30일 뒤부터 다시 추천될 수 있어요",
  empty: "차단한 사람이 없어요",
} as const;

/** 제재 화면 4종 (C3 §8) — 신고자 정보 미노출 */
export const SANCTION_COPY: Readonly<Record<SanctionLevel, { kind: "modal" | "banner" | "suspended" | "permanent"; title: (ctx: { categoryLabel: string; endsAt?: string | null; days?: number }) => string; body: string; cta: string }>> = {
  1: { kind: "modal", title: () => "경고를 받았어요", body: "사유: {category}. 같은 일이 반복되면 이용이 제한될 수 있어요. 이의신청은 정지 시에만 가능해요.", cta: "확인했어요" },
  2: { kind: "banner", title: ({ endsAt }) => `채팅이 24시간 제한됐어요 · 해제 ${endsAt ?? ""}`, body: "사유: {category}. 메시지를 읽을 수는 있지만 보낼 수 없고, 새 좋아요도 보낼 수 없어요.", cta: "" },
  3: { kind: "suspended", title: ({ days }) => `계정이 ${days ?? 3}일 정지됐어요`, body: "사유: {category}. 해제 일시까지 다른 화면을 이용할 수 없어요.", cta: "이의신청" },
  4: { kind: "suspended", title: ({ days }) => `계정이 ${days ?? 7}일 정지됐어요`, body: "사유: {category}. 해제 일시까지 다른 화면을 이용할 수 없어요.", cta: "이의신청" },
  5: { kind: "suspended", title: ({ days }) => `계정이 ${days ?? 30}일 정지됐어요`, body: "사유: {category}. 진행 중이던 매칭은 일시정지돼요.", cta: "이의신청" },
  6: { kind: "permanent", title: () => "더 이상 이용할 수 없어요", body: "사유: {category}. 데이터 처리 안내는 개인정보처리방침을 확인해 주세요.", cta: "이의신청" },
};
export function sanctionDurationDays(level: SanctionLevel): number | null {
  const h = SANCTION_LEVELS[level].durationHours;
  return h === null ? null : Math.round(h / 24);
}

/** 이의신청 (A5 §4.5, B1 §0-15) */
export const APPEAL_COPY = {
  title: "이의신청",
  bodyLabel: "사유 (1,000자)",
  windowNotice: "제재 통보 후 7일 이내, 제재 1건당 1회만 신청할 수 있어요.",
  slaNotice: "72시간 안에 답변드려요. 검토 중에도 제재는 유지돼요.",
  submitted: "이의신청이 접수됐어요. 72시간 안에 답변드려요.",
  minorNotAllowed: "본인인증 결과에 따른 조치는 이의신청할 수 없어요",
  windowClosed: "이의신청 기간(7일)이 지났어요",
  alreadyFiled: "이미 이의신청을 했어요",
  notSuspension: "이의신청은 정지 시에만 가능해요",
  accepted: "이의신청이 받아들여졌어요. 제재가 해제됐어요.",
  rejected: (note: string) => `이의신청이 받아들여지지 않았어요. ${note}`.trim(),
} as const;

/** 운영 수치 (moderation_settings 미러) */
export const MODERATION_RULES = {
  cumulativeReporters30d: 3,
  cumulativeReporters90d: 5,
  warningsToRestrict: 3,
  scamWindowDays: 7,
  scamScoreBanner: 5,
  scamScoreRestrict: 8,
  massLike24h: 30,
  offappCtHits24h: 2,
  contactHitsAutoReport: 3,
  autoReportDedupeHours: 24,
  appealWindowDays: 7,
  appealDecisionHours: 72,
  maxAutoSanctionLevel: 2 as SanctionLevel,
  moderatorMaxSanctionLevel: 3 as SanctionLevel,
  slaRenotifyMinutes: { P0: 30, P1: 360, P2: 1440, P3: 10080 } as Readonly<Record<Enums["report_priority"], number>>,
  evidenceRetentionDays: { dismissed: 90, confirmed: 180, permanentBan: 1825, legalHoldRelease: 90 },
  deleteGraceDays: 7,
  evidenceCopyMaxAttempts: 5,
} as const;

/** 스캠 시그널 가중치 (A5 §7.3, moderation_settings.scam_signal_weights 미러) */
export const SCAM_SIGNAL_WEIGHTS = {
  SC_MONEY: 3,
  SC_INVEST: 3,
  SC_URGENT: 2,
  SC_OFFAPP: 2,
  SC_MASS_LIKE: 2,
  SC_FAST_LOVE: 1,
  SC_TEMPLATE: 3,
} as const;
export type ScamRuleId = keyof typeof SCAM_SIGNAL_WEIGHTS;

/** 사진 반려 코드별 부수효과 (A5 §8) — admin_review_photo 와 동일 */
export const PHOTO_REJECT_SIDE_EFFECTS: Readonly<Record<Enums["photo_reject_code"], string | null>> = {
  reject_no_face: null,
  reject_not_self: "2회 누적 시 IMPERSONATION 자동 신고",
  reject_nudity: "경고(level 1)",
  reject_text_contact: "OFF_PLATFORM_LURE 카운트",
  reject_minor: "MINOR_SUSPECT P0 자동 신고 + 비노출",
  reject_group: null,
  reject_quality: null,
};

/** 어드민 권한표 (A5 결정사항 · 0043) */
export const ADMIN_PERMISSIONS = {
  moderator: ["list_reports", "get_report", "triage", "resolve(level<=3)", "review_photo", "search_profiles", "profile_detail", "lift_sanction(level<=3)", "stats"],
  admin: ["모든 moderator 권한", "resolve(level 4~6)", "lift_sanction(level>=4)", "decide_appeal", "set_legal_hold"],
} as const;
