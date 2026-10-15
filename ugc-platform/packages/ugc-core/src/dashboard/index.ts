/**
 * Admin dashboard data contracts (관리 대시보드). Phase 0 defines the read
 * port + view-model shapes so the UI (Phase 3) and any store adapter agree on
 * the interface. No rendering here — the package is headless.
 */
import type { ModerationCategory, UgcStatus } from "../types.js";

export interface QueueItem {
  submissionId: string;
  appSlug: string;
  excerpt: string;
  qualityScore: number;
  categories: ModerationCategory[];
  createdAt: string;
}

export interface ReportQueueItem {
  contentId: string;
  appSlug: string;
  slug: string;
  reason: string;
  totalReports: number;
  status: UgcStatus;
  createdAt: string;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  submitted: number;
  published: number;
  blocked: number;
  queued: number;
}

export interface SpamPattern {
  pattern: string;
  count: number;
}

/** Read port the admin dashboard consumes. Implemented by the store adapter. */
export interface DashboardPort {
  moderationQueue(appSlug: string, limit: number): Promise<QueueItem[]>;
  reportQueue(appSlug: string, limit: number): Promise<ReportQueueItem[]>;
  dailyStats(appSlug: string, days: number): Promise<DailyStat[]>;
  topSpamPatterns(appSlug: string, limit: number): Promise<SpamPattern[]>;
}

export interface DashboardSnapshot {
  moderationQueue: QueueItem[];
  reportQueue: ReportQueueItem[];
  dailyStats: DailyStat[];
  topSpamPatterns: SpamPattern[];
}

/** Convenience aggregator: one round-trip's worth of dashboard data. */
export async function loadDashboard(
  appSlug: string,
  port: DashboardPort,
  opts: { queueLimit?: number; days?: number; spamLimit?: number } = {},
): Promise<DashboardSnapshot> {
  const [moderationQueue, reportQueue, dailyStats, topSpamPatterns] = await Promise.all([
    port.moderationQueue(appSlug, opts.queueLimit ?? 50),
    port.reportQueue(appSlug, opts.queueLimit ?? 50),
    port.dailyStats(appSlug, opts.days ?? 30),
    port.topSpamPatterns(appSlug, opts.spamLimit ?? 10),
  ]);
  return { moderationQueue, reportQueue, dailyStats, topSpamPatterns };
}
