"use client";

/**
 * 경량 브라우저 fingerprint (투표 3중 중복방지의 한 축, V1).
 * 완벽한 식별이 아니라 시크릿창·기기 전환 어뷰징의 비용을 올리는 용도.
 * PII 아님 — 화면·언어·타임존 등 비식별 신호의 해시.
 */
export function getFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || ""),
  ].join("|");
  // 간단한 해시 (djb2)
  let h = 5381;
  for (let i = 0; i < parts.length; i++) h = ((h << 5) + h + parts.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
