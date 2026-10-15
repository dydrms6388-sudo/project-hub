/**
 * In-memory implementation of the store ports. Not for production — it exists so
 * the pipeline is runnable in tests and local demos without Supabase, and to
 * prove the port surface is fully implementable. The Supabase adapter (Phase 1)
 * mirrors this against ugc_* tables.
 */
import type { UgcStore } from "../ports.js";
import type {
  DailyStat,
  DashboardPort,
  QueueItem,
  ReportQueueItem,
  SpamPattern,
} from "../dashboard/index.js";
import type {
  Engagement,
  ModerationCategory,
  ModerationResult,
  PublishedContent,
  Report,
  UgcStatus,
  UgcSubmission,
} from "../types.js";

interface QueueEntry {
  appSlug: string;
  submissionId: string;
  qualityScore: number;
  categories: string[];
  enqueuedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

let seq = 0;
const id = (prefix: string) => `${prefix}_${(++seq).toString(36)}`;

export class MemoryStore implements UgcStore, DashboardPort {
  submissions = new Map<string, UgcSubmission>();
  content = new Map<string, PublishedContent>();
  moderations: Array<{ submissionId: string; result: ModerationResult }> = [];
  engagements: Engagement[] = [];
  reports: Report[] = [];
  queue: QueueEntry[] = [];
  counters = new Map<string, { count: number; expiresAt: number }>();

  private now = () => new Date().toISOString();

  async insertSubmission(
    row: Omit<UgcSubmission, "id" | "createdAt" | "status"> & { status?: UgcStatus },
  ): Promise<UgcSubmission> {
    const submission: UgcSubmission = {
      id: id("sub"),
      createdAt: this.now(),
      status: row.status ?? "pending",
      appSlug: row.appSlug,
      content: row.content,
      authorId: row.authorId,
      ipHash: row.ipHash,
    };
    this.submissions.set(submission.id, submission);
    return submission;
  }

  async recordModeration(
    _appSlug: string,
    submissionId: string,
    result: ModerationResult,
  ): Promise<void> {
    this.moderations.push({ submissionId, result });
  }

  async upsertContent(row: Omit<PublishedContent, "reactions">): Promise<PublishedContent> {
    // Preserve the reaction count on re-upsert (engage bumps it separately).
    const prev = this.content.get(row.id);
    const record: PublishedContent = { ...row, reactions: prev?.reactions ?? 0 };
    this.content.set(record.id, record);
    return record;
  }

  async setContentStatus(appSlug: string, contentId: string, status: UgcStatus): Promise<void> {
    const c = this.content.get(contentId);
    if (c && c.appSlug === appSlug) c.status = status;
    const s = this.submissions.get(contentId);
    if (s && s.appSlug === appSlug) s.status = status;
  }

  async getSubmission(appSlug: string, submissionId: string): Promise<UgcSubmission | null> {
    const s = this.submissions.get(submissionId);
    return s && s.appSlug === appSlug ? s : null;
  }

  async getContentBySlug(appSlug: string, slug: string): Promise<PublishedContent | null> {
    for (const c of this.content.values()) {
      if (c.appSlug === appSlug && c.slug === slug) return c;
    }
    return null;
  }

  async slugExists(appSlug: string, slug: string): Promise<boolean> {
    return (await this.getContentBySlug(appSlug, slug)) !== null;
  }

  async insertEngagement(row: Omit<Engagement, "id" | "createdAt">): Promise<Engagement> {
    const e: Engagement = { ...row, id: id("eng"), createdAt: this.now() };
    this.engagements.push(e);
    if (row.kind !== "comment") {
      const c = this.content.get(row.contentId);
      if (c) c.reactions += 1;
    }
    return e;
  }

  async insertReport(row: Omit<Report, "id" | "createdAt">): Promise<Report> {
    const r: Report = { ...row, id: id("rep"), createdAt: this.now() };
    this.reports.push(r);
    return r;
  }

  async countReports(appSlug: string, contentId: string): Promise<number> {
    return this.reports.filter((r) => r.appSlug === appSlug && r.contentId === contentId).length;
  }

  async bumpCounter(appSlug: string, windowKey: string, ttlSec: number): Promise<number> {
    const key = `${appSlug}:${windowKey}`;
    const nowMs = Date.now();
    const existing = this.counters.get(key);
    if (!existing || existing.expiresAt <= nowMs) {
      this.counters.set(key, { count: 1, expiresAt: nowMs + ttlSec * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  async enqueueForReview(row: {
    appSlug: string;
    submissionId: string;
    qualityScore: number;
    categories: string[];
  }): Promise<void> {
    const existing = this.queue.find(
      (q) => q.appSlug === row.appSlug && q.submissionId === row.submissionId,
    );
    if (existing) return; // idempotent
    this.queue.push({
      ...row,
      enqueuedAt: this.now(),
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  async resolveQueueItem(appSlug: string, submissionId: string, resolvedBy: string): Promise<void> {
    const q = this.queue.find(
      (x) => x.appSlug === appSlug && x.submissionId === submissionId && !x.resolvedAt,
    );
    if (q) {
      q.resolvedAt = this.now();
      q.resolvedBy = resolvedBy;
    }
  }

  // ── DashboardPort ──────────────────────────────────────────────────────────
  async moderationQueue(appSlug: string, limit: number): Promise<QueueItem[]> {
    return this.queue
      .filter((q) => q.appSlug === appSlug && !q.resolvedAt)
      .slice(0, limit)
      .map((q) => {
        const sub = this.submissions.get(q.submissionId);
        const text = sub ? JSON.stringify(sub.content) : "";
        return {
          submissionId: q.submissionId,
          appSlug: q.appSlug,
          excerpt: text.slice(0, 140),
          qualityScore: q.qualityScore,
          categories: q.categories as ModerationCategory[],
          createdAt: q.enqueuedAt,
        };
      });
  }

  async reportQueue(appSlug: string, limit: number): Promise<ReportQueueItem[]> {
    const counts = new Map<string, number>();
    for (const r of this.reports) {
      if (r.appSlug !== appSlug) continue;
      counts.set(r.contentId, (counts.get(r.contentId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .slice(0, limit)
      .map(([contentId, total]) => {
        const c = this.content.get(contentId);
        const last = this.reports.filter((r) => r.contentId === contentId).at(-1);
        return {
          contentId,
          appSlug,
          slug: c?.slug ?? "",
          reason: last?.reason ?? "",
          totalReports: total,
          status: c?.status ?? "published",
          createdAt: last?.createdAt ?? this.now(),
        };
      });
  }

  async dailyStats(appSlug: string, days: number): Promise<DailyStat[]> {
    const byDay = new Map<string, DailyStat>();
    for (const s of this.submissions.values()) {
      if (s.appSlug !== appSlug) continue;
      const date = s.createdAt.slice(0, 10);
      const stat =
        byDay.get(date) ?? { date, submitted: 0, published: 0, blocked: 0, queued: 0 };
      stat.submitted += 1;
      if (s.status === "published") stat.published += 1;
      if (s.status === "blocked") stat.blocked += 1;
      if (s.status === "queued") stat.queued += 1;
      byDay.set(date, stat);
    }
    return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
  }

  async topSpamPatterns(appSlug: string, limit: number): Promise<SpamPattern[]> {
    const counts = new Map<string, number>();
    for (const m of this.moderations) {
      const sub = this.submissions.get(m.submissionId);
      if (!sub || sub.appSlug !== appSlug) continue;
      if (m.result.decision !== "block") continue;
      for (const c of m.result.categories) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pattern, count]) => ({ pattern, count }));
  }
}
