// 폼 입력 검증. 서버액션에서만 쓰지만 순수 함수로 유지해 테스트 가능하게 한다.

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 한국 휴대폰 번호 (01X + 7~8자리) */
export function isValidPhone(digits: string): boolean {
  return /^01[016789]\d{7,8}$/.test(digits);
}

export function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= 50;
}

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

export function isValidTime(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(timeStr);
}

export const SERVICE_TYPES = ["extension", "wig", "other"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(v: string): v is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(v);
}

/** 가격: 빈 값 → null, 숫자(0~1억) → number, 그 외 → undefined(오류) */
export function parsePrice(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[,\s원]/g, "");
  if (!/^\d+$/.test(digits)) return undefined;
  const n = Number(digits);
  return n <= 100_000_000 ? n : undefined;
}

export function clampMemo(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

/** supabase .or() 필터 문법(구분자·와일드카드)에 끼어들 수 있는 문자를 제거한 검색어 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%*:\\'"]/g, "").trim().slice(0, 40);
}
