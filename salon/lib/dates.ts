// 서버는 UTC로 돌므로 날짜 계산은 전부 KST 기준으로 명시한다.

const KST_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 오늘 날짜 (KST) → 'YYYY-MM-DD' */
export function todayKST(): string {
  return KST_FORMAT.format(new Date());
}

/** 'YYYY-MM-DD'에 일수를 더한 'YYYY-MM-DD' */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → '8월 31일 (일)' 같은 표기 */
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
