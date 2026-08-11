/**
 * 문자에서 읽은 날짜 조각을 KST 시각으로 확정한다.
 *
 * 달력 원시 연산(toKstParts, daysInMonth …)은 @haruchi/schema/time 에 있다.
 * 파서와 예산 엔진이 같은 달력을 써야 하기 때문이다. 여기 남은 것은
 * "연도가 없는 문자를 어떻게 읽을 것인가" 하는 파서 고유의 판단뿐이다.
 */
import {
  KST_OFFSET_MS,
  daysInMonth,
  isRealDate,
  kstStampDay,
  kstStampMinute,
  kstToInstant,
  pad2,
  toKstParts,
  type KstParts,
} from '@haruchi/schema';

/** 미래로 이만큼까지는 "올해"로 인정한다. 발신 시각과 붙여넣기 시각의 오차 흡수용. */
const FUTURE_GRACE_MS = 24 * 60 * 60 * 1000;

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
    plainDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

// 파서의 공개 API 를 유지하기 위한 재수출. 구현은 schema 한 곳에만 있다.
export {
  KST_OFFSET_MS,
  daysInMonth,
  isRealDate,
  kstStampDay,
  kstStampMinute,
  kstToInstant,
  pad2,
  toKstParts,
  type KstParts,
};
