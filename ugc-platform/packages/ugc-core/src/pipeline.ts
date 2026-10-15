/**
 * createUgc — the ergonomic surface. A consumer service wires this once:
 *
 *   const ugc = createUgc(myConfig, { store, classifier, seo });
 *   await ugc.submit({ raw, authorId, ipHash, signals });
 *
 * Everything downstream (moderation policy, slugging, scoring, indexing) is
 * driven by the config + injected ports. That's the "설정 객체 + 3줄" goal.
 */
import type { UgcConfig } from "./config.js";
import type {
  ClassifierPort,
  SeoSink,
  SimilarityPort,
  UgcStore,
} from "./ports.js";
import type { ModerationResult, PublishedContent, UgcSubmission } from "./types.js";
import { submit, type SubmitInput, type SubmitResult } from "./submit/index.js";
import { moderate, type ModerateOptions } from "./moderate/index.js";
import { publish, type PublishInput } from "./publish/index.js";
import { engage, type EngageInput } from "./engage/index.js";
import { report, takedown, type ReportInput } from "./report/index.js";
import {
  approveQueued,
  rejectQueued,
  type ApproveResult,
  type RejectResult,
} from "./review/index.js";
import { loadDashboard, type DashboardPort, type DashboardSnapshot } from "./dashboard/index.js";

export interface UgcDeps {
  store: UgcStore;
  classifier?: ClassifierPort | null;
  similarity?: SimilarityPort | null;
  seo?: SeoSink | null;
  dashboard?: DashboardPort | null;
  /** Injected clock for deterministic tests. */
  nowMs?: () => number;
  nowIso?: () => string;
}

export interface Ugc {
  config: UgcConfig;
  submit(input: SubmitInput): Promise<SubmitResult>;
  moderate(text: string, opts?: ModerateOptions): Promise<ModerationResult>;
  publish(input: PublishInput): Promise<PublishedContent>;
  engage(
    input: EngageInput,
    content: PublishedContent,
    text: string,
  ): ReturnType<typeof engage>;
  report(input: ReportInput): ReturnType<typeof report>;
  takedown(input: { contentId: string; url: string }): Promise<void>;
  /** Admin: publish a queued submission and resolve its queue item. */
  reviewApprove(input: {
    submissionId: string;
    text: string;
    resolvedBy: string;
  }): Promise<ApproveResult>;
  /** Admin: block a queued submission and resolve its queue item. */
  reviewReject(input: { submissionId: string; resolvedBy: string }): Promise<RejectResult>;
  loadDashboard(): Promise<DashboardSnapshot>;
  /** Convenience: submit → moderate → (publish | queue | block) in one call. */
  intake(input: SubmitInput & { text: string }): Promise<IntakeResult>;
}

export type IntakeResult =
  | { stage: "rejected"; result: SubmitResult }
  | { stage: "blocked"; submission: UgcSubmission; moderation: ModerationResult }
  | { stage: "queued"; submission: UgcSubmission; moderation: ModerationResult }
  | {
      stage: "published";
      submission: UgcSubmission;
      moderation: ModerationResult;
      content: PublishedContent;
    };

export function createUgc(config: UgcConfig, deps: UgcDeps): Ugc {
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  const api: Ugc = {
    config,

    submit: (input) =>
      submit(input, config, {
        store: deps.store,
        similarity: deps.similarity ?? null,
        nowMs: deps.nowMs,
      }),

    moderate: (text, opts) => moderate(text, config, deps.classifier ?? null, opts),

    publish: (input) => publish(input, config, deps.store, deps.seo ?? null, nowIso),

    engage: (input, content, text) =>
      engage(input, content, config, { store: deps.store, seo: deps.seo, nowIso }, text),

    report: (input) => report(input, config, { store: deps.store, seo: deps.seo }),

    takedown: (input) => takedown(input, config, { store: deps.store, seo: deps.seo }),

    reviewApprove: (input) =>
      approveQueued(input, config, { store: deps.store, seo: deps.seo, nowIso }),

    reviewReject: (input) => rejectQueued(input, config, { store: deps.store }),

    loadDashboard: () => {
      if (!deps.dashboard) throw new Error("[ugc-core] no dashboard port configured");
      return loadDashboard(config.appSlug, deps.dashboard);
    },

    async intake(input) {
      const submitted = await api.submit(input);
      if (!submitted.ok) return { stage: "rejected", result: submitted };

      const moderation = await api.moderate(input.text);
      const { submission } = submitted;

      if (moderation.decision === "block") {
        await deps.store.recordModeration(config.appSlug, submission.id, moderation);
        await deps.store.setContentStatus(config.appSlug, submission.id, "blocked");
        return { stage: "blocked", submission, moderation };
      }
      if (moderation.decision === "queue") {
        await deps.store.recordModeration(config.appSlug, submission.id, moderation);
        await deps.store.setContentStatus(config.appSlug, submission.id, "queued");
        await deps.store.enqueueForReview({
          appSlug: config.appSlug,
          submissionId: submission.id,
          qualityScore: moderation.qualityScore,
          categories: moderation.categories,
        });
        return { stage: "queued", submission, moderation };
      }

      await deps.store.recordModeration(config.appSlug, submission.id, moderation);
      const content = await api.publish({ submission, text: input.text });
      await deps.store.setContentStatus(config.appSlug, submission.id, "published");
      return { stage: "published", submission, moderation, content };
    },
  };

  return api;
}
