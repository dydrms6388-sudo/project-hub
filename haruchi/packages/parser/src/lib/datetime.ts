/**
 * KST(UTC+9) 고정 날짜 계산. 순수 함수, I/O 없음.
 *
 * 한국 카드 승인 문자는 전부 KST 로 찍히고 연도가 없다.
 * "지금"을 인자로 받아 연도를 추정하며, 절대 시스템 타임존에 의존하지 않는다.
 * (서버가 UTC 여도 사용자의 8/11 거래가 8/10 으로 밀리면 안 된다 — 스펙 10장 감사관 2)
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 미래로 이만큼까지는 "올해"로 인정한다. 발신 시각과 붙여넣기 시각의 오차 흡수용. */
const FUTURE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface KstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
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

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1] ?? 0;
}

/** 달력상 실재하는 날짜인지. 2/29 를 평년에 쓰면 false. */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** KST 달력 필드 → UTC Date */
export function kstToInstant(parts: KstParts): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - KST_OFFSET_MS,
  );
}

export interface ResolveDateInput {
  month: number;
  day: number;
  /** 원문에 연도가 있으면 그대로 쓴다. 2자리면 2000년대로 해석. */
  year?: number | undefined;
  hour?: number | undefined;
  minute?: number | undefined;
  /** 기준 시각(UTC). 연도 추정에 쓴다. */
  now: Date;
}

export interface ResolvedDate {
  /** UTC ISO 문자열 */
  occurredAt: string;
  /** 원문에 시:분이 있었는지 */
  hasTime: boolean;
  /** KST 기준 yyyy-MM-dd */
  plainDate: string;
}

/**
 * 연도 없는 "08/11" 을 KST 기준으로 해석한다.
 *
 * - 원문 연도가 있으면 그대로 사용
 * - 없으면 "지금"의 KST 연도로 두고, 결과가 24시간 넘게 미래면 작년으로 보정
 * - 보정 후에도 실재하지 않는 날짜(평년 2/29 등)면 null → 호출부가 unparsed 처리
 *
 * 틀린 날짜를 자신 있게 등록하느니 못 읽었다고 말하는 편이 낫다 (스펙 패널 C).
 */
export function resolveKstDate(input: ResolveDateInput): ResolvedDate | null {
  const { month, day, hour, minute, now } = input;
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (hour !== undefined && (hour < 0 || hour > 23)) return null;
  if (minute !== undefined && (minute < 0 || minute > 59)) return null;

  const hasTime = hour !== undefined && minute !== undefined;
  const h = hour ?? 0;
  const m = minute ?? 0;

  let year: number;
  if (input.year !== undefined) {
    year = input.year < 100 ? 2000 + input.year : input.year;
    if (!isRealDate(year, month, day)) return null;
  } else {
    const nowKst = toKstParts(now);
    year = nowKst.year;
    if (!isRealDate(year, month, day)) {
      // 평년 2/29 처럼 추정 연도에 존재하지 않는 날짜. 조용히 다른 연도로 밀지 않는다.
      return null;
    }
    const candidate = kstToInstant({ year, month, day, hour: h, minute: m });
    if (candidate.getTime() - now.getTime() > FUTURE_GRACE_MS) {
      year -= 1;
      if (!isRealDate(year, month, day)) return null;
    }
  }

  const instant = kstToInstant({ year, month, day, hour: h, minute: m });
  return {
    occurredAt: instant.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
    hasTime,
    plainDate: `${year}-${pad2(month)}-${pad2(day)}`,
  };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
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
