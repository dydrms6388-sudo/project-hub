/**
 * Rolling-window rate limiting on top of the store's atomic counter. Two
 * independent gates: per-IP-per-hour and per-user-per-day (이중). Either can
 * reject. Counters are bucketed by a time-window key with a matching TTL.
 */
import type { UgcStore } from "../ports.js";
import type { RateLimitVerdict } from "../types.js";

function hourBucket(ms: number): string {
  return new Date(ms).toISOString().slice(0, 13); // YYYY-MM-DDTHH
}
function dayBucket(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface RateLimitArgs {
  appSlug: string;
  ipHash: string | null;
  userId: string | null;
  perIpPerHour: number;
  perUserPerDay: number;
  nowMs: number;
}

/** Check (and increment) both gates. Returns the first failing verdict, or an allow. */
export async function checkRateLimit(
  store: UgcStore,
  args: RateLimitArgs,
): Promise<RateLimitVerdict> {
  if (args.ipHash) {
    const key = `ip:${args.ipHash}:${hourBucket(args.nowMs)}`;
    const count = await store.bumpCounter(args.appSlug, key, 3600);
    if (count > args.perIpPerHour) {
      return { allowed: false, scope: "ip", remaining: 0, retryAfterSec: 3600 };
    }
  }

  if (args.userId) {
    const key = `user:${args.userId}:${dayBucket(args.nowMs)}`;
    const count = await store.bumpCounter(args.appSlug, key, 86400);
    if (count > args.perUserPerDay) {
      return { allowed: false, scope: "user", remaining: 0, retryAfterSec: 86400 };
    }
  }

  return { allowed: true, scope: "ip", remaining: Number.POSITIVE_INFINITY, retryAfterSec: 0 };
}
