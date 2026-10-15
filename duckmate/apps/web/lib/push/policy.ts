/**
 * 푸시 정책 TS 미러 — SQL `can_send_push`(0050) 와 같은 순서·같은 상수. 서버 판정의 단일 소스는 SQL 이고,
 * 이 파일은 (a) vitest 로 규칙을 문서화·검증하고 (b) 클라이언트 UX(예: "밤에는 보내지 않아요" 문구, 설정 화면 미리보기)에 쓴다.
 * 의존성: templates.ts 만.
 */
import { PUSH_TEMPLATES, type PushTemplateKey } from "./templates";

export const KST_OFFSET_MIN = 9 * 60;
export const RESET_HOUR_KST = 7;

/** SQL app_settings('push_policy') 기본값 + 법정 마케팅 창(고정) */
export const PUSH_POLICY = {
  quietStart: "23:00",
  quietEnd: "07:00",
  marketingStart: "08:00", // 정보통신망법 §50③ — 설정 불가
  marketingEnd: "21:00",
  dailyBudget: 2,
  bundleMinutes: 60,
  reminderCap30d: 2,
  slotAAt: "07:30",
  slotBStart: "19:30",
  slotBEnd: "21:00",
  slotBLate: "20:30",
  maxAttempts: 3,
} as const;

export type QuietWindow = { start: string; end: string };

const DAY_MS = 86_400_000;

export function hmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`invalid HH:MM: ${hhmm}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new Error(`invalid HH:MM: ${hhmm}`);
  return h * 60 + mi;
}

/** KST 자정 기준 분(0~1439) */
export function kstMinutes(at: Date): number {
  const m = Math.floor(at.getTime() / 60_000) + KST_OFFSET_MIN;
  return ((m % 1440) + 1440) % 1440;
}

/** KST 날짜 (YYYY-MM-DD) */
export function kstDate(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** SQL loop_date: KST 07:00 경계 */
export function loopDateKst(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MIN * 60_000 - RESET_HOUR_KST * 3_600_000).toISOString().slice(0, 10);
}

/** ISO 요일 1(월)~7(일), KST */
export function kstIsoWeekday(at: Date): number {
  const d = new Date(at.getTime() + KST_OFFSET_MIN * 60_000).getUTCDay(); // 0=일
  return d === 0 ? 7 : d;
}

/** [start, end) — start > end 면 자정을 넘는 창 (SQL time_in_window 동일) */
export function inWindow(minutes: number, start: string, end: string): boolean {
  const s = hmToMinutes(start);
  const e = hmToMinutes(end);
  return s <= e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export function isQuietHoursKst(at: Date, quiet: QuietWindow = { start: PUSH_POLICY.quietStart, end: PUSH_POLICY.quietEnd }): boolean {
  return inWindow(kstMinutes(at), quiet.start, quiet.end);
}

export function isMarketingWindowKst(at: Date): boolean {
  return inWindow(kstMinutes(at), PUSH_POLICY.marketingStart, PUSH_POLICY.marketingEnd);
}

export function isSlotBWindowKst(at: Date): boolean {
  return inWindow(kstMinutes(at), PUSH_POLICY.slotBStart, PUSH_POLICY.slotBEnd);
}

/** at 이후 처음 오는 KST hh:mm (정확히 같은 시각이면 다음날) — SQL next_kst_time 동일 */
export function nextKstTime(at: Date, hhmm: string): Date {
  const kstMs = at.getTime() + KST_OFFSET_MIN * 60_000;
  const dayStartKst = Math.floor(kstMs / DAY_MS) * DAY_MS;
  let utc = dayStartKst + hmToMinutes(hhmm) * 60_000 - KST_OFFSET_MIN * 60_000;
  if (utc <= at.getTime()) utc += DAY_MS;
  return new Date(utc);
}

/** 특정 KST 날짜의 hh:mm → UTC Date (SQL kst_at) */
export function kstAt(dateYmd: string, hhmm: string): Date {
  return new Date(Date.parse(`${dateYmd}T00:00:00Z`) + hmToMinutes(hhmm) * 60_000 - KST_OFFSET_MIN * 60_000);
}

// ---------------------------------------------------------------------------
// 판정
// ---------------------------------------------------------------------------
export type ProfileStatus = "active" | "paused" | "banned" | "age_blocked" | "deleting";

export type PushDecisionInput = {
  template: PushTemplateKey;
  at: Date;
  profileStatus: ProfileStatus;
  hasSubscription: boolean;
  /** 템플릿 슬롯의 토글이 켜진 구독이 하나라도 있는지 */
  slotEnabled: boolean;
  /** push_prefs.service_enabled (없으면 true) */
  serviceEnabled?: boolean;
  marketingConsent?: boolean;
  /** notification_log 기준 오늘(loop_date) 예산 소비 건수 */
  budgetUsed: number;
  /** 같은 템플릿의 마지막 전송 시각(뭉침 판정) */
  lastSameTemplateSentAt?: Date | null;
  /** 개인 방해금지(KST) */
  userQuiet?: QuietWindow | null;
  budgetLimit?: number;
};

export type PushDecision = {
  action: "send" | "hold" | "discard";
  reason: string;
  releaseAt?: Date;
  budgetUsed: number;
  budgetLimit: number;
};

const PAUSED_ALLOWED: ReadonlySet<PushTemplateKey> = new Set(["sanction_issued", "sanction_lifted", "report_resolved", "appeal_decided", "reconsent_needed"]);
const BANNED_ALLOWED: ReadonlySet<PushTemplateKey> = new Set(["sanction_issued", "appeal_decided"]);
const SERVICE_OFF_ALLOWED: ReadonlySet<PushTemplateKey> = new Set(["sanction_issued", "reconsent_needed"]);

/** SQL can_send_push 와 같은 순서 */
export function decidePush(input: PushDecisionInput): PushDecision {
  const meta = PUSH_TEMPLATES[input.template];
  const limit = input.budgetLimit ?? PUSH_POLICY.dailyBudget;
  const discard = (reason: string): PushDecision => ({ action: "discard", reason, budgetUsed: input.budgetUsed, budgetLimit: limit });

  if (input.profileStatus === "deleting" || input.profileStatus === "age_blocked") return discard("PROFILE_INACTIVE");
  if (input.profileStatus === "paused" && !PAUSED_ALLOWED.has(meta.key)) return discard("PROFILE_PAUSED");
  if (input.profileStatus === "banned" && !BANNED_ALLOWED.has(meta.key)) return discard("PROFILE_BANNED");
  if (!input.hasSubscription) return discard("NO_SUBSCRIPTION");
  if (!input.slotEnabled && meta.kind !== "marketing") return discard("SLOT_OFF");
  if (input.serviceEnabled === false && meta.kind !== "marketing" && !SERVICE_OFF_ALLOWED.has(meta.key)) return discard("SERVICE_OFF");

  if (meta.kind === "marketing") {
    if (!input.marketingConsent) return discard("NO_MARKETING_CONSENT");
    if (!isMarketingWindowKst(input.at)) return discard("MARKETING_NIGHT");
  }

  if (meta.consumesBudget && input.budgetUsed >= limit) return discard("BUDGET_EXCEEDED");

  let releaseAt: Date | undefined;
  let reason: string | undefined;
  if (meta.kind !== "marketing" && meta.holdAtNight) {
    if (isQuietHoursKst(input.at)) {
      releaseAt = nextKstTime(input.at, PUSH_POLICY.quietEnd);
      reason = "QUIET_HOURS";
    } else if (input.userQuiet && inWindow(kstMinutes(input.at), input.userQuiet.start, input.userQuiet.end)) {
      releaseAt = nextKstTime(input.at, input.userQuiet.end);
      reason = "USER_QUIET";
    }
  }
  if (meta.bundleMinutes > 0 && input.lastSameTemplateSentAt) {
    const until = input.lastSameTemplateSentAt.getTime() + meta.bundleMinutes * 60_000;
    if (until > input.at.getTime()) {
      releaseAt = new Date(Math.max(releaseAt?.getTime() ?? -Infinity, until));
      reason = reason ?? "BUNDLE";
    }
  }
  if (releaseAt) return { action: "hold", reason: reason ?? "HOLD", releaseAt, budgetUsed: input.budgetUsed, budgetLimit: limit };
  return { action: "send", reason: "OK", budgetUsed: input.budgetUsed, budgetLimit: limit };
}

/** 슬롯 B 후보 중 1개 (priorityRank 최소). 없으면 null = 미발송 */
export function pickSlotB(candidates: ReadonlyArray<PushTemplateKey>): PushTemplateKey | null {
  let best: PushTemplateKey | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const rank = PUSH_TEMPLATES[c].priorityRank;
    if (rank !== null && rank < bestRank) {
      best = c;
      bestRank = rank;
    }
  }
  return best;
}

/** 슬롯 B 유저별 시각: 오늘 요일에 night 만 있고 evening 이 없으면 20:30, 아니면 19:30 */
export function slotBTimeFor(availabilityToday: ReadonlyArray<"morning" | "afternoon" | "evening" | "night">): string {
  const hasNight = availabilityToday.includes("night");
  const hasEvening = availabilityToday.includes("evening");
  return hasNight && !hasEvening ? PUSH_POLICY.slotBLate : PUSH_POLICY.slotBStart;
}

/** 미접속 리마인더: 30일 내 리마인더(전송+대기) 2건 미만일 때만 */
export function reminderAllowed(remindersLast30d: number): boolean {
  return remindersLast30d < PUSH_POLICY.reminderCap30d;
}

/** last_active_at 기준 D3/D7 창 (각 1일 폭) */
export function reminderTemplateFor(lastActiveAt: Date, at: Date): "reminder_d3" | "reminder_d7" | null {
  const days = (at.getTime() - lastActiveAt.getTime()) / DAY_MS;
  if (days >= 3 && days < 4) return "reminder_d3";
  if (days >= 7 && days < 8) return "reminder_d7";
  return null;
}

/** 슬롯 A 대상: 최근 7일 접속 or 월요일 */
export function slotAEligible(lastActiveAt: Date, at: Date): boolean {
  return at.getTime() - lastActiveAt.getTime() <= 7 * DAY_MS || kstIsoWeekday(at) === 1;
}

/** 실패 재시도 백오프(분) — SQL finish_push_queue: 5·10·15 */
export function retryDelayMinutes(attempts: number): number | null {
  return attempts >= PUSH_POLICY.maxAttempts ? null : 5 * attempts;
}
