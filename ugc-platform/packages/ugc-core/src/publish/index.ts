/**
 * Publish stage: turn an approved submission into a public, SEO-eligible record.
 * Resolves slug + URL + title, computes contentScore, and only lists the URL in
 * the sitemap once the score clears minContentScore (below → noindex).
 */
import type { UgcConfig } from "../config.js";
import type { SeoSink, UgcStore } from "../ports.js";
import type { PublishedContent, UgcSubmission } from "../types.js";
import { contentScore } from "./score.js";
import { makeSlug } from "./slug.js";

export { contentScore } from "./score.js";
export { kebab, makeSlug, romanize, shortHash } from "./slug.js";

/** Substitute `[slug]` in a urlPattern. */
export function resolveUrl(urlPattern: string, slug: string): string {
  return urlPattern.replace(/\[slug\]/g, slug);
}

/** Substitute `{field}` tokens in a template from the content object. */
export function renderTemplate(
  template: string,
  content: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = content[key];
    return v == null ? "" : String(v);
  });
}

export interface PublishInput {
  submission: UgcSubmission;
  /** The primary text used for scoring (service picks the field). */
  text: string;
  /** Optional stable seed for slug hashing (defaults to submission id). */
  slugSeed?: string;
}

/**
 * Persist a submission as published content and index it if it clears the bar.
 * Handles slug collisions by bumping a numeric suffix (bounded retries).
 */
export async function publish(
  input: PublishInput,
  config: UgcConfig,
  store: UgcStore,
  seo: SeoSink | null,
  now: () => string,
): Promise<PublishedContent> {
  const { submission, text } = input;
  const content = submission.content as Record<string, unknown>;
  const titleSource = renderTemplate(config.seo.titleTemplate, content);

  // Slug + collision handling.
  let slug = makeSlug(titleSource || submission.id, input.slugSeed ?? submission.id);
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (!(await store.slugExists(config.appSlug, slug))) break;
    slug = `${makeSlug(titleSource || submission.id, input.slugSeed ?? submission.id)}-${attempt}`;
  }

  const score = contentScore({ text, reactions: 0 });
  const indexed = score >= config.seo.minContentScore;
  const url = resolveUrl(config.seo.urlPattern, slug);
  const ts = now();

  const record = await store.upsertContent({
    id: submission.id,
    appSlug: config.appSlug,
    slug,
    content: submission.content,
    contentScore: score,
    indexed,
    url,
    status: "published",
    publishedAt: ts,
    updatedAt: ts,
  });

  if (indexed && seo) await seo.index(url);
  return record;
}
