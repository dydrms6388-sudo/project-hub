/**
 * @ggu/ugc-core — headless UGC pipeline.
 *
 * Public surface. Consumers typically only need `defineUgcConfig` + `createUgc`;
 * the individual stage functions and ports are exported for advanced wiring and
 * testing.
 */

// Config
export { defineUgcConfig, ugcConfigSchema, type UgcConfig } from "./config.js";

// Factory
export {
  createUgc,
  type Ugc,
  type UgcDeps,
  type IntakeResult,
} from "./pipeline.js";

// Stages
export {
  submit,
  checkRateLimit,
  type SubmitInput,
  type SubmitResult,
  type SubmitRejection,
  type SubmitDeps,
} from "./submit/index.js";
export {
  moderate,
  applyRules,
  detectPii,
  hasBlockingPii,
  type ModerateOptions,
  type PiiFinding,
  type PiiKind,
} from "./moderate/index.js";
export {
  HeuristicClassifier,
  LlmClassifier,
  llmClassificationSchema,
  extractJsonArray,
  type LlmClassifierDeps,
} from "./moderate/classifier.js";
export {
  publish,
  resolveUrl,
  renderTemplate,
  contentScore,
  makeSlug,
  romanize,
  kebab,
  shortHash,
  type PublishInput,
} from "./publish/index.js";
export { engage, type EngageInput, type EngageDeps } from "./engage/index.js";
export {
  report,
  takedown,
  type ReportInput,
  type ReportDeps,
  type ReportOutcome,
} from "./report/index.js";
export {
  loadDashboard,
  type DashboardPort,
  type DashboardSnapshot,
  type QueueItem,
  type ReportQueueItem,
  type DailyStat,
  type SpamPattern,
} from "./dashboard/index.js";

// Ports & domain types
export type {
  UgcStore,
  ClassifierPort,
  SimilarityPort,
  SeoSink,
} from "./ports.js";
export { UGC_TABLES, type UgcTableName } from "./db/tables.js";

// Adapters
export { MemoryStore } from "./adapters/memory.js";
export { SupabaseStore } from "./adapters/supabase.js";
export {
  InMemorySimilarityIndex,
  cosineSimilarity,
  type Embedder,
} from "./adapters/similarity.js";
export type {
  UgcStatus,
  UgcSubmission,
  AntiAbuseSignals,
  ModerationCategory,
  ModerationResult,
  LlmClassification,
  PublishedContent,
  Engagement,
  Report,
  RateLimitVerdict,
} from "./types.js";
