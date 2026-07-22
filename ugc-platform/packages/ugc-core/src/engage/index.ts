/**
 * Engage stage: 투표/반응/댓글. Two responsibilities:
 *   - Comments re-enter the same moderation pipeline (handled by the caller
 *     wiring moderate() before insert; see createUgc in pipeline.ts).
 *   - A reaction bump recomputes contentScore and can promote a previously
 *     noindex record into the sitemap once it crosses minContentScore.
 */
import type { UgcConfig } from "../config.js";
import type { SeoSink, UgcStore } from "../ports.js";
import type { Engagement, PublishedContent } from "../types.js";
import { contentScore } from "../publish/score.js";

export interface EngageInput {
  contentId: string;
  kind: Engagement["kind"];
  authorId: string | null;
  body?: string | null;
}

export interface EngageDeps {
  store: UgcStore;
  seo?: SeoSink | null;
  nowIso?: () => string;
}

/**
 * Record an engagement and, if it changes the indexing eligibility of the
 * content, promote it. Returns the engagement plus whether an index promotion
 * happened so callers can log it.
 */
export async function engage(
  input: EngageInput,
  content: PublishedContent,
  config: UgcConfig,
  deps: EngageDeps,
  /** Primary text of the content, for re-scoring. */
  text: string,
): Promise<{ engagement: Engagement; promoted: boolean }> {
  const engagement = await deps.store.insertEngagement({
    appSlug: config.appSlug,
    contentId: input.contentId,
    kind: input.kind,
    authorId: input.authorId,
    body: input.body ?? null,
  });

  let promoted = false;
  if (input.kind !== "comment") {
    const nextReactions = content.reactions + 1;
    const nextScore = contentScore({ text, reactions: nextReactions });
    const shouldIndex = nextScore >= config.seo.minContentScore;
    promoted = shouldIndex && !content.indexed;

    // Persist the recomputed score (and the index promotion, if any).
    const nowIso = deps.nowIso ?? (() => new Date().toISOString());
    await deps.store.upsertContent({
      id: content.id,
      appSlug: content.appSlug,
      slug: content.slug,
      content: content.content,
      contentScore: nextScore,
      indexed: content.indexed || shouldIndex,
      url: content.url,
      status: content.status,
      publishedAt: content.publishedAt,
      updatedAt: nowIso(),
    });

    if (promoted && deps.seo) await deps.seo.index(content.url);
  }

  return { engagement, promoted };
}
