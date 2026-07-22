/**
 * In-memory implementation of the store ports. Not for production — it exists so
 * the pipeline is runnable in tests and local demos without Supabase, and to
 * prove the port surface is fully implementable. The Supabase adapter (Phase 1)
 * mirrors this against ugc_* tables.
 */
import type { UgcStore } from "../ports.js";
import type {
  Engagement,
  ModerationResult,
  PublishedContent,
  Report,
  UgcStatus,
  UgcSubmission,
} from "../types.js";

let seq = 0;
const id = (prefix: string) => `${prefix}_${(++seq).toString(36)}`;

export class MemoryStore implements UgcStore {
  submissions = new Map<string, UgcSubmission>();
  content = new Map<string, PublishedContent>();
  moderations: Array<{ submissionId: string; result: ModerationResult }> = [];
  engagements: Engagement[] = [];
  reports: Report[] = [];
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

  async recordModeration(submissionId: string, result: ModerationResult): Promise<void> {
    this.moderations.push({ submissionId, result });
  }

  async upsertContent(row: Omit<PublishedContent, "reactions">): Promise<PublishedContent> {
    const record: PublishedContent = { ...row, reactions: 0 };
    this.content.set(record.id, record);
    return record;
  }

  async setContentStatus(appSlug: string, contentId: string, status: UgcStatus): Promise<void> {
    const c = this.content.get(contentId);
    if (c && c.appSlug === appSlug) c.status = status;
    const s = this.submissions.get(contentId);
    if (s && s.appSlug === appSlug) s.status = status;
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
}
