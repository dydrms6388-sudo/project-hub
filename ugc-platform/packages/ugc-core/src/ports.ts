/**
 * Ports (hexagonal boundaries) the pipeline depends on. Consumers inject
 * concrete adapters — a Supabase store, a real LLM classifier — so the core
 * logic never imports a DB driver or an AI SDK directly. This is what makes
 * "drop-in with a config object + 3 lines" achievable.
 */
import type {
  Engagement,
  LlmClassification,
  ModerationResult,
  PublishedContent,
  RateLimitVerdict,
  Report,
  UgcStatus,
  UgcSubmission,
} from "./types.js";

/** Persistence port. The Supabase adapter implements this over ugc_* tables. */
export interface UgcStore {
  insertSubmission(
    row: Omit<UgcSubmission, "id" | "createdAt" | "status"> & {
      status?: UgcStatus;
    },
  ): Promise<UgcSubmission>;

  recordModeration(submissionId: string, result: ModerationResult): Promise<void>;

  /** Persist a published record and return it (slug/url resolved by caller). */
  upsertContent(row: Omit<PublishedContent, "reactions">): Promise<PublishedContent>;

  setContentStatus(appSlug: string, contentId: string, status: UgcStatus): Promise<void>;

  getContentBySlug(appSlug: string, slug: string): Promise<PublishedContent | null>;

  /** True if a near-duplicate already exists (dedup gate, Phase 1). */
  slugExists(appSlug: string, slug: string): Promise<boolean>;

  insertEngagement(row: Omit<Engagement, "id" | "createdAt">): Promise<Engagement>;

  insertReport(row: Omit<Report, "id" | "createdAt">): Promise<Report>;

  countReports(appSlug: string, contentId: string): Promise<number>;

  /**
   * Atomically increment and read a rolling counter for rate limiting.
   * `windowKey` encodes the bucket (e.g. `ip:2026-07-22T13`).
   */
  bumpCounter(appSlug: string, windowKey: string, ttlSec: number): Promise<number>;
}

/** Optional similarity port for duplicate detection (임베딩 유사도). */
export interface SimilarityPort {
  /** Returns the highest cosine similarity to existing content, 0–1. */
  maxSimilarity(appSlug: string, text: string): Promise<number>;
}

/** LLM classifier port (2차 검수). Batches are the caller's concern. */
export interface ClassifierPort {
  classify(input: {
    appSlug: string;
    text: string;
  }): Promise<LlmClassification>;
}

/** Hook a service can supply to react to publish/index transitions. */
export interface SeoSink {
  /** Add/refresh a URL in the service's sitemap + trigger revalidate. */
  index(url: string): Promise<void>;
  /** Drop a URL from sitemap + mark noindex/410. */
  deindex(url: string): Promise<void>;
}

export interface RateLimiterResult extends RateLimitVerdict {}
