/**
 * Moderation stage. Combines the deterministic rule pass (1차) with an optional
 * LLM classifier (2차) into a single decision: publish / queue / block.
 *
 * Decision policy:
 *   - Any hard block (PII high-confidence, forbidden word) → block, no LLM call.
 *   - Otherwise combine rule score + LLM qualityScore (LLM weighted higher).
 *   - qualityScore ≥ autoPublishThreshold → publish
 *   - qualityScore ≤ blockThreshold      → block
 *   - between                            → queue (human review)
 *   - forbiddenCategories intersection    → block regardless of score
 */
import type { UgcConfig } from "../config.js";
import type { ClassifierPort } from "../ports.js";
import type { ModerationCategory, ModerationResult } from "../types.js";
import { applyRules } from "./rules.js";

export interface ModerateOptions {
  /** Extra forbidden words beyond config (service-tunable). */
  forbiddenWords?: string[];
  maxUrls?: number;
}

export async function moderate(
  text: string,
  config: UgcConfig,
  classifier: ClassifierPort | null,
  opts: ModerateOptions = {},
): Promise<ModerationResult> {
  const { moderation } = config;
  const forbidden = new Set<ModerationCategory>(
    moderation.forbiddenCategories as ModerationCategory[],
  );

  const rules = applyRules(text, {
    requireMinLength: moderation.requireMinLength,
    maxUrls: opts.maxUrls ?? 3,
    forbiddenWords: opts.forbiddenWords ?? [],
  });

  if (rules.hardBlock) {
    return {
      qualityScore: 0,
      toxicity: rules.categories.includes("hate") ? 1 : 0,
      spam: rules.categories.includes("spam") ? 1 : 0,
      pii: rules.categories.includes("pii"),
      categories: rules.categories,
      reason: `rules:${rules.reasons.join(",")}`,
      source: "rules",
      decision: "block",
    };
  }

  // 2차: LLM classifier is optional in Phase 0 (injected in later phases).
  const llm = classifier
    ? await classifier.classify({ appSlug: config.appSlug, text })
    : null;

  const categories = new Set<ModerationCategory>([
    ...rules.categories,
    ...((llm?.categories ?? []) as ModerationCategory[]),
  ]);

  // Weighted blend: LLM 0.7 / rules 0.3 when LLM present, else rules only.
  const qualityScore = llm
    ? Math.round(0.7 * llm.qualityScore + 0.3 * rules.score)
    : rules.score;

  const pii = rules.categories.includes("pii") || Boolean(llm?.pii);
  if (pii) categories.add("pii");

  const hitsForbidden = [...categories].some((c) => forbidden.has(c));

  let decision: ModerationResult["decision"];
  if (pii || hitsForbidden || qualityScore <= moderation.blockThreshold) {
    decision = "block";
  } else if (qualityScore >= moderation.autoPublishThreshold) {
    decision = "publish";
  } else {
    decision = "queue";
  }

  return {
    qualityScore,
    toxicity: llm?.toxicity ?? (rules.categories.includes("hate") ? 0.8 : 0),
    spam: llm?.spam ?? (rules.categories.includes("spam") ? 0.8 : 0),
    pii,
    categories: [...categories],
    reason: llm
      ? `combined:${llm.reason}|rules:${rules.reasons.join(",")}`
      : `rules:${rules.reasons.join(",")}`,
    source: llm ? "combined" : "rules",
    decision,
  };
}

export { applyRules } from "./rules.js";
export { detectPii, hasBlockingPii } from "./pii.js";
export type { PiiFinding, PiiKind } from "./pii.js";
