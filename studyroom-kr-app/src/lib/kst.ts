/**
 * 날짜 계산은 기기 시간대와 무관하게 한국 시간(KST, UTC+9) 기준으로 한다.
 * 해외에서 접속하거나 밤 늦게 새로고침해도 국내와 같은 '오늘'이 나오게 하기 위한 것.
 */
export const KST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 86_400_000;

/** UTC 밀리초 → 한국 시간 기준 일련일(day index). 두 값의 차이가 곧 날짜 차이다. */
export const kstDay = (ms: number) => Math.floor((ms + KST_OFFSET) / DAY);

/** YYYY-MM-DD 를 한국 시간 자정으로 읽어 일련일로. 형식이 틀리면 null. */
export function kstDayOf(date: string): number | null {
  const ms = Date.parse(`${date}T00:00:00+09:00`);
  return Number.isNaN(ms) ? null : kstDay(ms);
}

/** 한국 시간 기준 오늘을 YYYY-MM-DD 로. */
export function kstToday(nowMs: number = Date.now()): string {
  const d = new Date(nowMs + KST_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD → "2026. 3. 2. (월)" */
export function prettyDate(date: string): string {
  const ms = Date.parse(`${date}T00:00:00+09:00`);
  if (Number.isNaN(ms)) return date;
  const d = new Date(ms + KST_OFFSET);
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}. (${WEEKDAY[d.getUTCDay()]})`;
}
