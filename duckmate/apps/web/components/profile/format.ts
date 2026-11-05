/**
 * 표시용 순수 헬퍼 (서버·클라이언트 공용, 의존성 0).
 */
import { NICKNAME_CHANGE_INTERVAL_DAYS, PHOTO_REJECT_MESSAGES, type AgeBand, type Enums } from "@duckmate/db";
import { PHOTO_COPY } from "@/components/settings/copy";

export const AGE_BAND_LABELS: Readonly<Record<AgeBand, string>> = {
  "20_early": "20대 초반",
  "20_mid": "20대 중반",
  "20_late": "20대 후반",
  "30_early": "30대 초반",
  "30_mid": "30대 중반",
  "30_late": "30대 후반",
  "40_plus": "40대 이상",
};

/** 만 나이 → 연령대 (v_profile_public.age_band 와 같은 구간) */
export function ageBandOf(age: number): AgeBand {
  if (age >= 40) return "40_plus";
  if (age >= 37) return "30_late";
  if (age >= 34) return "30_mid";
  if (age >= 30) return "30_early";
  if (age >= 27) return "20_late";
  if (age >= 24) return "20_mid";
  return "20_early";
}

export function ageBandLabel(age: number): string {
  return AGE_BAND_LABELS[ageBandOf(age)];
}

export const WEEKDAY_LABELS: ReadonlyArray<string> = ["월", "화", "수", "목", "금", "토", "일"]; // ISO 1~7
export const SLOT_LABELS: Readonly<Record<Enums["availability_slot"], string>> = {
  morning: "아침",
  afternoon: "낮",
  evening: "저녁",
  night: "밤",
};
export const GENDER_LABELS: Readonly<Record<Enums["gender"], string>> = { female: "여성", male: "남성", unspecified: "밝히지 않음" };
export const SEEKING_LABELS: Readonly<Record<Enums["seeking_gender"], string>> = { female: "여성", male: "남성", any: "모두" };

/** 사진 검수 배지 문구 (C3 §6.1: 대기 중/승인/반려: 코드별 사유/보류) */
export function photoStatusLabel(status: Enums["review_status"], rejectCode: Enums["photo_reject_code"] | null): string {
  switch (status) {
    case "approved":
      return PHOTO_COPY.approved;
    case "held":
      return PHOTO_COPY.held;
    case "rejected":
      return `${PHOTO_COPY.rejectedPrefix}: ${rejectCode ? PHOTO_REJECT_MESSAGES[rejectCode] : "다시 올려 주세요"}`;
    default:
      return PHOTO_COPY.pending;
  }
}

export function photoBadgeVariant(status: Enums["review_status"]): "success" | "warning" | "danger" | "muted" {
  if (status === "approved") return "success";
  if (status === "held") return "warning";
  if (status === "rejected") return "danger";
  return "muted";
}

/** KST 날짜 표기 "2026년 9월 9일" */
export function formatDateKo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(d);
}

/** KST 일시 표기 "9월 9일 10:20" */
export function formatDateTimeKo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** 닉네임 다음 변경 가능일 (30일 규칙). 지금 바꿀 수 있으면 null */
export function nextNicknameChangeAt(changedAt: string | null, now = new Date()): Date | null {
  if (!changedAt) return null;
  const next = new Date(new Date(changedAt).getTime() + NICKNAME_CHANGE_INTERVAL_DAYS * 86_400_000);
  return next > now ? next : null;
}

/** D-day 표기: 삭제 예정일까지 남은 일수 */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}
