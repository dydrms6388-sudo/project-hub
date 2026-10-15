// 게시 간격 + 캡션 중복 검사 (게시 전 체크리스트 3,4).

import { textSimilarity } from '../embedding.js';

export const MIN_GAP_MS = 40 * 60 * 1000; // 40분
export const JITTER_MS = 12 * 60 * 1000; // ±12분
export const CAPTION_SIM_THRESHOLD = 0.85; // 동일 계정 30일 내 유사도 < 0.85

/** 지터 적용된 최소 간격. rng ∈ [0,1). */
export function jitteredGap(rng: number): number {
  const jitter = Math.round((rng * 2 - 1) * JITTER_MS);
  return MIN_GAP_MS + jitter;
}

/** 지금 게시 가능한가 (마지막 게시 후 최소 간격 경과). */
export function canPublishNow(lastPublishedAt: number | null, now: number, rng: number): boolean {
  if (lastPublishedAt == null) return true;
  return now - lastPublishedAt >= jitteredGap(rng);
}

/** 다음 게시 허용 시각. */
export function nextAllowedTime(lastPublishedAt: number | null, now: number, rng: number): number {
  if (lastPublishedAt == null) return now;
  return Math.max(now, lastPublishedAt + jitteredGap(rng));
}

/** 최근 캡션들과 과도하게 유사한가 (중복 게시 방지). */
export function captionTooSimilar(
  caption: string,
  recentCaptions: string[],
  threshold = CAPTION_SIM_THRESHOLD,
): { dup: boolean; maxSim: number } {
  let maxSim = 0;
  for (const c of recentCaptions) maxSim = Math.max(maxSim, textSimilarity(caption, c));
  return { dup: maxSim >= threshold, maxSim: Number(maxSim.toFixed(4)) };
}
