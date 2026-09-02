/** 표시 포맷 헬퍼 — 클라이언트/서버 공용, 의존성 없음 */
const KST = "Asia/Seoul";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, month: "2-digit", day: "2-digit" }).format(d);
}

/** 초 → "1h 20m" / "-35m" */
export function fmtDuration(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const body = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return neg ? `-${body}` : body;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("ko-KR").format(n);
}
