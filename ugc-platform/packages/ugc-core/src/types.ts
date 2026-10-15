/**
 * Core domain types shared across the UGC pipeline.
 *
 * These are transport/storage shapes — deliberately independent of any DB
 * driver so the package stays headless. The Supabase adapter maps rows in
 * `ugc_*` tables onto these.
 */

/** Lifecycle of a single piece of user-generated content. */
export type UgcStatus =
  | "pending" // awaiting moderation
  | "queued" // moderation inconclusive → human review queue
  | "published" // publicly visible
  | "blocked" // rejected by moderation
  | "hidden" // taken down (reports threshold or admin action)
  | "deleted"; // removed by author/admin → 410

/** Categories a moderator (rule or LLM) can flag. Mirrors forbiddenCategories. */
export type ModerationCategory =
  | "pii" // 개인정보: 실명+소속 / 전화 / 주소 / 계좌 / 주민번호
  | "hate" // 혐오·차별
  | "spam" // 광고·도배
  | "adult" // 성인
  | "violence"
  | "self_harm"
  | "illegal"
  | "off_topic";

/** A raw submission as it enters the pipeline, before moderation. */
export interface UgcSubmission<TContent = Record<string, unknown>> {
  id: string;
  appSlug: string;
  /** Service-specific validated fields (shape defined by config.contentSchema). */
  content: TContent;
  authorId: string | null;
  /** Best-effort client fingerprint for rate limiting / abuse tracing. */
  ipHash: string | null;
  status: UgcStatus;
  createdAt: string; // ISO-8601
}

/** Signals captured at submit time to catch bots before moderation runs. */
export interface AntiAbuseSignals {
  /** Value of the hidden honeypot field — non-empty means bot. */
  honeypot?: string | null;
  /** Milliseconds the user spent on the form. <3000ms ≈ bot. */
  fillMs?: number | null;
}

/** Structured result the moderation stage produces for one submission. */
export interface ModerationResult {
  /** 0–100. Higher = safer/higher quality. */
  qualityScore: number;
  toxicity: number; // 0–1
  spam: number; // 0–1
  pii: boolean; // hard signal — any true forces a block
  categories: ModerationCategory[];
  reason: string;
  /** Which layer produced the verdict — useful for auditing/tuning. */
  source: "rules" | "llm" | "combined";
  decision: "publish" | "queue" | "block";
}

/** What the LLM classifier is contracted to return (2차 검수). */
export interface LlmClassification {
  toxicity: number; // 0–1
  spam: number; // 0–1
  pii: boolean;
  qualityScore: number; // 0–100
  categories: ModerationCategory[];
  reason: string;
}

/** A published, SEO-eligible record. */
export interface PublishedContent<TContent = Record<string, unknown>> {
  id: string;
  appSlug: string;
  slug: string;
  content: TContent;
  contentScore: number; // drives noindex vs. sitemap inclusion
  indexed: boolean; // true once contentScore >= minContentScore
  url: string; // resolved from config.seo.urlPattern
  reactions: number;
  status: UgcStatus;
  publishedAt: string;
  updatedAt: string;
}

/** A user reaction/vote/comment reference (engage stage). */
export interface Engagement {
  id: string;
  appSlug: string;
  contentId: string;
  kind: "vote" | "reaction" | "comment";
  authorId: string | null;
  /** Present for comments (which re-enter moderation). */
  body?: string | null;
  createdAt: string;
}

/** An abuse/takedown report against published content. */
export interface Report {
  id: string;
  appSlug: string;
  contentId: string;
  reason: string;
  reporterId: string | null;
  createdAt: string;
}

/** Outcome of the rate-limit gate. */
export interface RateLimitVerdict {
  allowed: boolean;
  scope: "ip" | "user";
  remaining: number;
  retryAfterSec: number;
}
