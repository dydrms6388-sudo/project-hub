// 서버는 UTC로 돌고 크론도 UTC 스케줄이므로, 날짜 계산은 전부 KST 기준으로 명시한다.
// 모든 함수는 순수 함수이며 `now`를 주입할 수 있어 테스트 가능하다.

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 오늘 날짜 (KST) → 'YYYY-MM-DD' */
export function todayKST(now: Date = new Date()): string {
  return KST_DATE.format(now);
}

/** 'YYYY-MM-DD'에 일수를 더한 'YYYY-MM-DD' */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 해당 날짜가 KST 기준 오늘보다 이전인가 */
export function isPast(dateStr: string, now: Date = new Date()): boolean {
  return dateStr < todayKST(now);
}

/** 'YYYY-MM-DD' → '8월 31일 (월)' */
export function formatKoreanDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

/** 'HH:MM:SS' | 'HH:MM' → '14:30' */
export function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** ISO timestamp → '8/31 19:04' (KST) */
export function formatKoreanDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
