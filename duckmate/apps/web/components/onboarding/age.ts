/**
 * 연령 헬퍼 (클라이언트 UX 용 — 서버는 lib/onboarding/schemas.ageYearsKst 로 재계산).
 */
import { ADULT_AGE } from "@duckmate/db";
import { ageYearsKst, birthDateSchema } from "@/lib/onboarding/schemas";

export type BirthParts = { year: string; month: string; day: string };

/** "1998" "3" "7" → "1998-03-07" (형식만 맞춤, 실존 검증은 birthDateSchema) */
export function partsToIso(parts: BirthParts): string {
  const y = parts.year.trim();
  const m = parts.month.trim().padStart(2, "0");
  const d = parts.day.trim().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoToParts(iso: string | null | undefined): BirthParts {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { year: "", month: "", day: "" };
  const [y, m, d] = iso.split("-") as [string, string, string];
  return { year: y, month: String(Number(m)), day: String(Number(d)) };
}

/** null = 유효 / string = 오류 문구(C3 S1: "날짜를 다시 확인해 주세요") */
export function validateBirthDate(iso: string): string | null {
  const r = birthDateSchema.safeParse(iso);
  return r.success ? null : (r.error.issues[0]?.message ?? "날짜를 다시 확인해 주세요");
}

export function isAdultKst(iso: string, now: Date = new Date()): boolean {
  return ageYearsKst(iso, now) >= ADULT_AGE;
}

/** 프로필 노출용 연령대: "20대 초반/중반/후반", "30대 초반" … (생년월일 원본 노출 금지) */
export function ageBandOf(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const age = ageYearsKst(iso, now);
  const decade = Math.floor(age / 10) * 10;
  const rem = age - decade;
  const part = rem <= 3 ? "초반" : rem <= 6 ? "중반" : "후반";
  return `${decade}대 ${part}`;
}
