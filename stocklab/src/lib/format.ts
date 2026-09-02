export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return `${n.toFixed(digits)}%`;
}

export function fmtWon(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 억원 단위 → "1조 2,345억" */
export function fmtEok(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  const v = Math.round(n);
  if (v >= 10000) {
    const jo = Math.floor(v / 10000);
    const eok = v % 10000;
    return eok ? `${jo.toLocaleString("ko-KR")}조 ${eok.toLocaleString("ko-KR")}억` : `${jo.toLocaleString("ko-KR")}조`;
  }
  return `${v.toLocaleString("ko-KR")}억`;
}

export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
