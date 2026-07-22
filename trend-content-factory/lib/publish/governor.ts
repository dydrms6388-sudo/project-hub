// 레이트리밋 거버너 (HARD CONSTRAINT #3).
// 응답 헤더 사용률 80% 초과 → 60분 쿨다운, 95% 초과 → 24시간 중단.

import type { UsageSample } from './types.js';

export const COOLDOWN_THRESHOLD = 80;
export const HALT_THRESHOLD = 95;
export const COOLDOWN_MS = 60 * 60 * 1000; // 60분
export const HALT_MS = 24 * 60 * 60 * 1000; // 24시간

export type GovernorAction = 'ok' | 'cooldown' | 'halt';

export type GovernorDecision = {
  action: GovernorAction;
  worst: number; // 사용률 최댓값(app vs buc)
  cooldownMs: number;
  reason: string;
};

export function worstUsage(usage: UsageSample): number {
  return Math.max(usage.appUsage ?? 0, usage.bucUsage ?? 0);
}

export function evaluateUsage(usage: UsageSample): GovernorDecision {
  const worst = worstUsage(usage);
  if (worst >= HALT_THRESHOLD) {
    return { action: 'halt', worst, cooldownMs: HALT_MS, reason: `사용률 ${worst}% ≥ ${HALT_THRESHOLD}% → 24h 중단` };
  }
  if (worst >= COOLDOWN_THRESHOLD) {
    return { action: 'cooldown', worst, cooldownMs: COOLDOWN_MS, reason: `사용률 ${worst}% ≥ ${COOLDOWN_THRESHOLD}% → 60m 쿨다운` };
  }
  return { action: 'ok', worst, cooldownMs: 0, reason: `사용률 ${worst}% 정상` };
}
