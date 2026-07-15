import { createHash, randomUUID } from "node:crypto";

const SALT = process.env.VOTER_SALT || "isitnormal-dev-salt";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** 원시 IP는 저장하지 않는다 — 솔트 해시만 보관. (개인정보 최소화) */
export function hashIp(ip: string): string {
  return sha256(`ip:${ip}:${SALT}`);
}

/**
 * 3중 결합 투표자 해시 (V1). 세션+IP+fingerprint.
 * 같은 기기·세션이면 동일 해시 → survey당 unique 제약으로 재투표 차단.
 */
export function voterHash(sessionId: string, ip: string, fingerprint: string): string {
  return sha256(`${sessionId}|${ip}|${fingerprint}|${SALT}`);
}

/** x-forwarded-for 등에서 클라이언트 IP 추출 (프록시 뒤). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") || "0.0.0.0";
}

export function newSessionId(): string {
  return randomUUID();
}

export const SESSION_COOKIE = "isn_sid";
