// 스코어링 + 중복 제거.
// velocity_score: 어댑터가 넘긴 신호(rank/points/score 등)의 정규화.
// novelty_score:  최근 이력 텍스트와의 최대 유사도 역수.
// dedup:          제목 임베딩 코사인 > 0.88 이면 병합.

import { embed, cosine } from './embedding.js';
import type { TrendItem } from './types.js';

export const DEDUP_THRESHOLD = 0.88;

/** 순위 기반 velocity: rank 0 → 1.0, 하위로 갈수록 선형 감소. */
export function velocityFromRank(rank: number, total: number): number {
  if (total <= 1) return 1;
  const v = 1 - rank / total;
  return Math.max(0, Math.min(1, v));
}

/** 원시 수치 신호(예: 조회수/점수)를 로그 정규화로 0~1 매핑. */
export function velocityFromMagnitude(value: number, pivot = 1000): number {
  if (value <= 0) return 0;
  const v = Math.log10(value + 1) / Math.log10(pivot + 1);
  return Math.max(0, Math.min(1, v));
}

/**
 * 배치 내부 + 과거 이력 대비 신선도.
 * historyTexts 가 비어있으면(=이력 없음) novelty=1.
 */
export function noveltyAgainst(title: string, historyTexts: string[]): number {
  if (historyTexts.length === 0) return 1;
  const target = embed(title);
  let maxSim = 0;
  for (const h of historyTexts) {
    maxSim = Math.max(maxSim, cosine(target, embed(h)));
  }
  return Math.max(0, 1 - maxSim);
}

/**
 * 제목 임베딩 코사인 > threshold 인 항목들을 병합(첫 등장만 유지).
 * velocity 가 더 높은 쪽을 대표로 남긴다.
 */
export function dedupeTrends(items: TrendItem[], threshold = DEDUP_THRESHOLD): TrendItem[] {
  const kept: { item: TrendItem; vec: Float64Array }[] = [];
  // velocity 내림차순으로 처리해 강한 항목이 대표가 되도록.
  const sorted = [...items].sort((a, b) => b.velocity_score - a.velocity_score);
  for (const item of sorted) {
    const vec = embed(item.title);
    const dup = kept.find((k) => cosine(k.vec, vec) > threshold);
    if (!dup) kept.push({ item, vec });
  }
  return kept.map((k) => k.item);
}

/** 선별 랭킹 점수: velocity 0.6 + novelty 0.4 가중합. */
export function selectionScore(item: TrendItem): number {
  return item.velocity_score * 0.6 + item.novelty_score * 0.4;
}

export function rankAndSelect(items: TrendItem[], top: number): TrendItem[] {
  return [...items].sort((a, b) => selectionScore(b) - selectionScore(a)).slice(0, top);
}
