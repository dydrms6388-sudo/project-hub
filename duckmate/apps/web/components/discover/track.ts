/**
 * E2 분석 이벤트 얇은 래퍼 — 이름·속성은 12_flows §10 / PRD §6.1 표 그대로. 원문·닉네임·사진 경로 금지.
 * `match_created{initiator:'me'}` 는 E1 의 AnalyticsEvent 유니온에 아직 없어 캐스팅한다(→ E1 병합 요청, 23_fe_discover §0).
 */
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/track";
import { scoreBucket } from "@/lib/matching/score";

export function trackEvent(event: AnalyticsEvent, props?: AnalyticsProps): void {
  track(event, props);
}

/** 유니온 밖 이벤트(match_created) — E1 이 유니온에 추가하면 이 함수는 trackEvent 로 교체 */
export function trackLoose(event: string, props?: AnalyticsProps): void {
  track(event as AnalyticsEvent, props);
}

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
