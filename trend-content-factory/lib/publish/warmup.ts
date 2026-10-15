// 워밍업 스케줄 (HARD CONSTRAINT #5) + 유효 일일 상한 (HARD CONSTRAINT #1).
// 1주차 3, 2주차 6, 3주차 10, 4주차+ 15.

import type { Account } from './types.js';

const WARMUP_TABLE = [3, 6, 10]; // week 0,1,2 → 이후 15

/** 계정 워밍업 일일 상한. warmup_started_at 없으면 무제한(성숙 계정 → 런타임 실측이 상한). */
export function warmupCap(account: Account, now: number): number {
  if (!account.warmup_started_at) return Number.POSITIVE_INFINITY;
  const start = Date.parse(account.warmup_started_at);
  if (Number.isNaN(start)) return 15;
  const weeks = Math.floor((now - start) / (7 * 86_400_000));
  if (weeks < 0) return WARMUP_TABLE[0]!;
  return WARMUP_TABLE[weeks] ?? 15;
}

/**
 * 유효 일일 게시 상한 = min(워밍업 상한, 런타임 실측 절대상한 × 0.6, 수동 override).
 * runtimeAbsoluteLimit: content_publishing_limit 등에서 얻은 24h 절대 상한 건수(모르면 null).
 */
export function effectiveDailyCap(
  account: Account,
  runtimeAbsoluteLimit: number | null,
  now: number,
): number {
  const caps: number[] = [warmupCap(account, now)];
  if (runtimeAbsoluteLimit != null) caps.push(Math.floor(runtimeAbsoluteLimit * 0.6));
  if (account.daily_cap_override != null) caps.push(account.daily_cap_override);
  const finite = caps.filter((c) => Number.isFinite(c));
  return finite.length ? Math.min(...finite) : 15; // 아무 정보 없으면 보수적 15
}
