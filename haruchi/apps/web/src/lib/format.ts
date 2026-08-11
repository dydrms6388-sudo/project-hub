/**
 * 금액·날짜 표시 규칙 (스펙 6장).
 *
 * 만원 단위 축약은 대시보드 히어로에서만 쓴다. 목록은 언제나 전체 자릿수다.
 * 계산은 전부 정수로 하고, 여기서는 포맷만 한다.
 */

const KST = 'Asia/Seoul';

/** 12000 → "12,000원". 목록·상세에서 쓰는 기본 표기. */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * 히어로 전용 축약. 23400 → "2만 3,400". 정수 연산만 쓴다.
 * 1만 미만이면 축약하지 않는다 — 축약이 오히려 읽기 어려워진다.
 */
export function formatWonShort(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs < 10000) return `${sign}${abs.toLocaleString('ko-KR')}`;
  const man = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (rest === 0) return `${sign}${man.toLocaleString('ko-KR')}만`;
  return `${sign}${man.toLocaleString('ko-KR')}만 ${rest.toLocaleString('ko-KR')}`;
}

/** UTC ISO → KST "8월 11일 (화) 12:30" */
export function formatKstDateTime(iso: string, withTime: boolean): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
  if (!withTime) return datePart;
  const timePart = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart} ${timePart}`;
}

const KIND_LABEL: Record<string, string> = {
  expense: '지출',
  income: '수입',
  transfer: '이체',
};

export function formatKind(kind: string, isCancellation: boolean): string {
  const base = KIND_LABEL[kind] ?? kind;
  return isCancellation ? `${base} 취소` : base;
}
