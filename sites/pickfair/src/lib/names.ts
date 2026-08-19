/** 줄바꿈/쉼표로 구분된 이름 목록 파싱 */
export function parseNames(text: string, max = 200): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 24))
    .slice(0, max);
}

/** 문자열 배열인지 검사하고 길이/글자수를 잘라낸다 (URL 로 들어온 값 검증용) */
export function sanitizeStrings(raw: unknown, max: number, maxLen = 40): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") return null;
    const s = v.trim().slice(0, maxLen);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** 정수 범위 검증 */
export function sanitizeInt(raw: unknown, min: number, max: number, fallback?: number): number | null {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback ?? null;
  if (n < min || n > max) return fallback ?? null;
  return n;
}
