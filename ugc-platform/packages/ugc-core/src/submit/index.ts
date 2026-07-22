/**
 * Submit stage: the front door. Order matters — cheapest rejections first.
 *   1) Zod validation (config.contentSchema)
 *   2) anti-abuse: honeypot + fill-time (봇 차단)
 *   3) rate limit (IP + user, 이중)
 *   4) dedup via optional similarity port (임베딩 유사도 ≥ 0.9 차단)
 *   5) insert as `pending` for the moderation stage to pick up
 */
import { z } from "zod";
import type { UgcConfig } from "../config.js";
import type { SimilarityPort, UgcStore } from "../ports.js";
import type { AntiAbuseSignals, UgcSubmission } from "../types.js";
import { checkRateLimit } from "./ratelimit.js";

export { checkRateLimit } from "./ratelimit.js";

export type SubmitRejection =
  | { ok: false; code: "invalid"; issues: z.ZodIssue[] }
  | { ok: false; code: "bot" }
  | { ok: false; code: "rate_limited"; scope: "ip" | "user"; retryAfterSec: number }
  | { ok: false; code: "duplicate"; similarity: number };

export type SubmitResult =
  | { ok: true; submission: UgcSubmission }
  | SubmitRejection;

export interface SubmitInput {
  raw: unknown;
  authorId: string | null;
  ipHash: string | null;
  signals?: AntiAbuseSignals;
  /** Text used for duplicate detection (service selects the field). */
  dedupText?: string;
}

export interface SubmitDeps {
  store: UgcStore;
  similarity?: SimilarityPort | null;
  nowMs?: () => number;
  /** Minimum ms on the form; below this is treated as a bot. Default 3000. */
  minFillMs?: number;
  /** Similarity at/above which a submission is a duplicate. Default 0.9. */
  dedupThreshold?: number;
}

export async function submit(
  input: SubmitInput,
  config: UgcConfig,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
  const minFillMs = deps.minFillMs ?? 3000;
  const dedupThreshold = deps.dedupThreshold ?? 0.9;

  // 1) validation
  const parsed = config.contentSchema.safeParse(input.raw);
  if (!parsed.success) {
    return { ok: false, code: "invalid", issues: parsed.error.issues };
  }

  // 2) anti-abuse
  const { honeypot, fillMs } = input.signals ?? {};
  if (honeypot) return { ok: false, code: "bot" };
  if (typeof fillMs === "number" && fillMs < minFillMs) {
    return { ok: false, code: "bot" };
  }

  // 3) rate limit
  const rl = await checkRateLimit(deps.store, {
    appSlug: config.appSlug,
    ipHash: input.ipHash,
    userId: input.authorId,
    perIpPerHour: config.rateLimit.perIpPerHour,
    perUserPerDay: config.rateLimit.perUserPerDay,
    nowMs,
  });
  if (!rl.allowed) {
    return { ok: false, code: "rate_limited", scope: rl.scope, retryAfterSec: rl.retryAfterSec };
  }

  // 4) dedup
  if (deps.similarity && input.dedupText) {
    const sim = await deps.similarity.maxSimilarity(config.appSlug, input.dedupText);
    if (sim >= dedupThreshold) {
      return { ok: false, code: "duplicate", similarity: sim };
    }
  }

  // 5) insert
  const submission = await deps.store.insertSubmission({
    appSlug: config.appSlug,
    content: parsed.data as Record<string, unknown>,
    authorId: input.authorId,
    ipHash: input.ipHash,
    status: "pending",
  });

  return { ok: true, submission };
}
