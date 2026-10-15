/** KST(UTC+9) 날짜 유틸 — 서버 런타임 TZ에 의존하지 않도록 수동 계산 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstNow(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** YYYY-MM-DD (KST) */
export function kstDateString(d: Date = new Date()): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.toISOString().slice(0, 10);
}

/** 다음 KST 자정(00:00)의 ISO 문자열(UTC 기준) */
export function nextKstMidnightIso(d: Date = new Date()): string {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  const next = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1) - KST_OFFSET_MS;
  return new Date(next).toISOString();
}

export function formatKoreanDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}
