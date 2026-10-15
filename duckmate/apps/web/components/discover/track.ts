/**
 * E2 분석 보조 — 이벤트 발화는 `@/lib/analytics/track` 의 `track()` 을 화면이 직접 호출한다(H2: trackEvent/trackLoose 캐스팅 제거).
 * 여기는 props 가공 헬퍼만. 원문·닉네임·사진 경로 금지.
 */
import { scoreBucket } from "@/lib/matching/score";

/** target_id 를 그대로 보내지 않는다 — 짧은 해시(FNV-1a 32bit hex) */
export function idHash(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const bucketOf = scoreBucket;
