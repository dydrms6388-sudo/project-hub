/** 010-0000-0000 표시 포맷 (순수). 서버 정규화는 lib/auth/otp.normalizeKrPhone */
export function formatKrPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
