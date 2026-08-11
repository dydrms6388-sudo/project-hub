/**
 * KST(UTC+9) 고정 달력 연산.
 *
 * 파서도 예산 엔진도 같은 달력 위에서 움직여야 한다. 한쪽만 하루 밀리면
 * "오늘 쓸 수 있는 돈"이 틀리고, 그 순간 사용자는 앱을 지운다.
 *
 * 원칙:
 *   - 시스템 타임존을 절대 읽지 않는다. Date 의 지역 시간 메서드를 쓰지 않는다.
 *   - "지금"은 언제나 인자로 주입받는다. 여기서 시계를 읽는 함수는 없다.
 *   - 날짜 산술은 yyyy-MM-dd 평문 문자열 위에서 한다. 시각이 끼어들 여지를 없앤다.
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC Date 를 KST 달력 필드로 분해한다. */
export function toKstParts(instant: Date): KstParts {
  const shifted = new Date(instant.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** KST 달력 필드 → UTC Date */
export function kstToInstant(parts: KstParts): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - KST_OFFSET_MS,
  );
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1] ?? 0;
}

/** 달력상 실재하는 날짜인지. 평년 2/29 는 false. */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

/* ── 평문 날짜(yyyy-MM-dd) 산술 ────────────────────────────────────────────
 * 예산·회계월 계산은 전부 이 위에서 한다. 시각과 타임존이 개입할 수 없으므로
 * 월말·윤년·서머타임 같은 것들이 조용히 하루를 먹는 일이 없다.
 * ────────────────────────────────────────────────────────────────────────── */

export type PlainDate = string;

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PlainDateParts {
  year: number;
  month: number;
  day: number;
}

export function parsePlainDate(date: PlainDate): PlainDateParts {
  const match = PLAIN_DATE.exec(date);
  if (!match) throw new RangeError(`yyyy-MM-dd 형식이 아닙니다: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDate(year, month, day)) {
    throw new RangeError(`존재하지 않는 날짜입니다: ${date}`);
  }
  return { year, month, day };
}

export function formatPlainDate(parts: PlainDateParts): PlainDate {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** UTC 시각 → 그 시각이 속한 KST 날짜 */
export function toPlainDate(instant: Date): PlainDate {
  const parts = toKstParts(instant);
  return formatPlainDate(parts);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: PlainDate, days: number): PlainDate {
  const { year, month, day } = parsePlainDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/**
 * 개월 산술. 대상 월에 그 날짜가 없으면 말일로 맞춘다.
 * (1/31 에서 한 달 뒤는 2/28 — 3/3 이 아니다)
 */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const { year, month, day } = parsePlainDate(date);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatPlainDate({ year: targetYear, month: targetMonth, day: clampedDay });
}

/** b - a 를 일수로. 같은 날이면 0, b 가 과거면 음수. */
export function differenceInDays(a: PlainDate, b: PlainDate): number {
  const from = parsePlainDate(a);
  const to = parsePlainDate(b);
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / DAY_MS);
}

/**
 * a 에서 b 까지의 "온전히 지난 개월 수".
 * 8/11 → 2/1 은 5개월이다 (6개월째 되는 날이 아직 안 왔으므로).
 */
export function differenceInMonths(a: PlainDate, b: PlainDate): number {
  const from = parsePlainDate(a);
  const to = parsePlainDate(b);
  const months = (to.year - from.year) * 12 + (to.month - from.month);
  return to.day < from.day ? months - 1 : months;
}

/** dedupe_key 용 yyyyMMddHHmm (KST) */
export function kstStampMinute(occurredAtIso: string): string {
  const p = toKstParts(new Date(occurredAtIso));
  return `${p.year}${pad2(p.month)}${pad2(p.day)}${pad2(p.hour)}${pad2(p.minute)}`;
}

/** dedupe_key 용 yyyyMMdd (KST) */
export function kstStampDay(occurredAtIso: string): string {
  const p = toKstParts(new Date(occurredAtIso));
  return `${p.year}${pad2(p.month)}${pad2(p.day)}`;
}
