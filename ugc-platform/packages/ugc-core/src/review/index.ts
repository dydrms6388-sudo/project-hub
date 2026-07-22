/**
 * Human review resolution (관리자 검수 처리). Closes the loop the moderation
 * stage opens when it queues a submission:
 *
 *   approve → publish the submission (same path as auto-publish) + resolve queue
 *   reject  → mark blocked + resolve queue
 *
 * Both are idempotent from the queue's perspective — resolveQueueItem only
 * touches unresolved rows.
 */
import type { UgcConfig } from "../config.js";
import type { SeoSink, UgcStore } from "../ports.js";
import type { PublishedContent } from "../types.js";
import { publish } from "../publish/index.js";

export interface ReviewDeps {
  store: UgcStore;
  seo?: SeoSink | null;
  nowIso?: () => string;
}

export type ApproveResult =
  | { ok: true; content: PublishedContent }
  | { ok: false; reason: "not_found" | "not_queued" };

/**
 * Approve a queued submission: publish it and resolve the queue item.
 * `text` is the primary text used for scoring (service picks the field, same
 * as intake). Refuses to approve submissions that aren't in `queued` state so
 * a stale dashboard tab can't double-publish or resurrect blocked content.
 */
export async function approveQueued(
  input: { submissionId: string; text: string; resolvedBy: string },
  config: UgcConfig,
  deps: ReviewDeps,
): Promise<ApproveResult> {
  const submission = await deps.store.getSubmission(config.appSlug, input.submissionId);
  if (!submission) return { ok: false, reason: "not_found" };
  if (submission.status !== "queued") return { ok: false, reason: "not_queued" };

  const content = await publish(
    { submission, text: input.text },
    config,
    deps.store,
    deps.seo ?? null,
    deps.nowIso ?? (() => new Date().toISOString()),
  );
  // Move the submission out of `queued` so a second approve is refused.
  await deps.store.setContentStatus(config.appSlug, input.submissionId, "published");
  await deps.store.resolveQueueItem(config.appSlug, input.submissionId, input.resolvedBy);
  return { ok: true, content };
}

export type RejectResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_queued" };

/** Reject a queued submission: block it and resolve the queue item. */
export async function rejectQueued(
  input: { submissionId: string; resolvedBy: string },
  config: UgcConfig,
  deps: Pick<ReviewDeps, "store">,
): Promise<RejectResult> {
  const submission = await deps.store.getSubmission(config.appSlug, input.submissionId);
  if (!submission) return { ok: false, reason: "not_found" };
  if (submission.status !== "queued") return { ok: false, reason: "not_queued" };

  await deps.store.setContentStatus(config.appSlug, input.submissionId, "blocked");
  await deps.store.resolveQueueItem(config.appSlug, input.submissionId, input.resolvedBy);
  return { ok: true };
}
