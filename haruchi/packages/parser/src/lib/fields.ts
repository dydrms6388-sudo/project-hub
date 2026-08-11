/**
 * 어댑터가 공유하는 필드 추출기.
 *
 * 여기 있는 함수는 전부 "확신이 없으면 null" 을 반환한다.
 * 어댑터는 null 을 받으면 그 블록을 통째로 unparsed 로 넘긴다.
 */
import type { ForeignOrigin } from '@haruchi/schema';
import { resolveKstDate, type ResolvedDate } from './datetime.js';

/** 카드 승인 문자에서 흔한 날짜/시각 표기 조각들 */
export const RE_MMDD_HHMM = /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/;
export const RE_YMD_HHMM = /(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}):(\d{2})/;

export interface DateTokens {
  year?: string | undefined;
  month: string;
  day: string;
  hour?: string | undefined;
  minute?: string | undefined;
}

/** 캡처한 문자열 토큰을 KST 기준 시각으로 확정한다. */
export function resolveTokens(tokens: DateTokens, now: Date): ResolvedDate | null {
  const month = Number(tokens.month);
  const day = Number(tokens.day);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  return resolveKstDate({
    month,
    day,
    year: tokens.year === undefined ? undefined : Number(tokens.year),
    hour: tokens.hour === undefined ? undefined : Number(tokens.hour),
    minute: tokens.minute === undefined ? undefined : Number(tokens.minute),
    now,
  });
}

/** 승인/취소 상태 토큰 → 취소 여부. 어댑터가 포맷상 확실한 위치에서만 넘긴다. */
export function isCancelStatus(statusToken: string | undefined): boolean {
  if (!statusToken) return false;
  return /취소/.test(statusToken);
}

export type InstallmentResult =
  | { ok: true; months: number | null }
  | { ok: false };

/**
 * 할부 개월 추출.
 * - "일시불" 또는 표기 없음 → months null
 * - "3개월", "할부 3개월", "3개월 할부" → 3
 * - 1개월이나 61개월 이상처럼 존재하지 않는 값 → ok:false (블록 전체를 실패로)
 */
export function extractInstallment(body: string): InstallmentResult {
  const match = /(?:할부\s*)?(\d{1,3})\s*개월(?:\s*할부)?/.exec(body);
  if (!match) return { ok: true, months: null };
  const months = Number(match[1]);
  if (months === 1) return { ok: true, months: null }; // 1개월 할부는 일시불과 같다
  if (months < 2 || months > 60) return { ok: false };
  return { ok: true, months };
}

/**
 * 해외 승인 원문 추출. 원화 환산액만 금액으로 쓰고 외화 정보는 raw_payload 로 넘긴다.
 * 예: "USD 10.50", "해외 USD10.50"
 */
export function extractForeign(body: string): ForeignOrigin | undefined {
  const match = /\b(USD|JPY|EUR|CNY|GBP|HKD|SGD|AUD|CAD|THB|VND|TWD)\s*([\d,]+(?:\.\d{1,2})?)/.exec(
    body,
  );
  if (!match) return undefined;
  return { currency: match[1] as string, amountText: match[2] as string };
}

/** "신한카드(1234)", "국민카드 1234" 등에서 뒤 4자리만 뽑는다. */
export function extractLast4(body: string, issuerPattern: RegExp): string | null {
  const source = issuerPattern.source;
  const re = new RegExp(`${source}[^\\d\\n]{0,6}(\\d{4})(?!\\d)`);
  const match = re.exec(body);
  return match ? (match[1] as string) : null;
}
