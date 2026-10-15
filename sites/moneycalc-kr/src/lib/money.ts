/** 통화·숫자 포맷 유틸 (모두 순수 함수) */

export const won = (n: number): string =>
  `${Math.round(n).toLocaleString("ko-KR")}원`;

export const wonSigned = (n: number): string =>
  `${n < 0 ? "-" : ""}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}원`;

export const num = (n: number, digits = 0): string =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (n: number, digits = 2): string =>
  `${(n * 100).toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;

/** 만/억 단위 한글 요약 (예: 123,456,789 → "1억 2,345만원") */
export function korMoney(n: number): string {
  const v = Math.round(Math.abs(n));
  if (v === 0) return "0원";
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const rest = v % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (!eok && !man && rest) parts.push(`${rest.toLocaleString("ko-KR")}`);
  return `${n < 0 ? "-" : ""}${parts.join(" ")}원`;
}

/** 4대보험료는 원 단위 절사(10원 미만 버림)가 관행이다. */
export const floorTo = (n: number, unit: number): number => Math.floor(n / unit) * unit;
export const roundTo = (n: number, unit: number): number => Math.round(n / unit) * unit;

/** 안전한 숫자 파싱 — 빈 문자열/NaN 은 0 */
export const toNum = (v: string | number | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = Number(String(v).replace(/[,\s원%]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
