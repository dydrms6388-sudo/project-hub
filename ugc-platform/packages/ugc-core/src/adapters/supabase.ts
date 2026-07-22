/**
 * Supabase implementation of UgcStore + DashboardPort over the ugc_* tables.
 *
 * The SDK is a type-only import + optional peer dependency, so @ggu/ugc-core
 * carries no runtime dependency on it — the consumer passes a client created
 * with the **service role** key (writes bypass RLS; anon can only read
 * published content). Table names come from db/tables.ts.
 *
 * Note: this adapter is defined and type-checked here but is exercised against a
 * live database by the consumer service's integration tests (Phase 2), not by
 * this package's unit tests. The dashboard read methods group in application
 * code for now; Phase 3 should push aggregation into SQL views/RPCs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { UGC_TABLES } from "../db/tables.js";

type Row = Record<string, unknown>;

function fail(op: string, error: { message: string } | null): never {
  throw new Error(`[ugc-core:supabase] ${op} failed: ${error?.message ?? "unknown error"}`);
}

function submissionFromRow(r: Row): UgcSubmission {
  return {
    id: String(r.id),
    appSlug: String(r.app_slug),
    content: (r.content ?? {}) as Record<string, unknown>,
    authorId: (r.author_id as string | null) ?? null,
    ipHash: (r.ip_hash as string | null) ?? null,
    status: r.status as UgcStatus,
    createdAt: String(r.created_at),
  };
}

function contentFromRow(r: Row): PublishedContent {
  return {
    id: String(r.id),
    appSlug: String(r.app_slug),
    slug: String(r.slug),
    content: (r.content ?? {}) as Record<string, unknown>,
    contentScore: Number(r.content_score),
    indexed: Boolean(r.indexed),
    url: String(r.url),
    reactions: Number(r.reactions ?? 0),
    status: r.status as UgcStatus,
    publishedAt: String(r.published_at),
    updatedAt: String(r.updated_at),
  };
}

export class SupabaseStore implements UgcStore, DashboardPort {
  constructor(private db: SupabaseClient) {}

  async insertSubmission(
    row: Omit<UgcSubmission, "id" | "createdAt" | "status"> & { status?: UgcStatus },
  ): Promise<UgcSubmission> {
    const { data, error } = await this.db
      .from(UGC_TABLES.submissions)
      .insert({
        app_slug: row.appSlug,
        content: row.content,
        author_id: row.authorId,
        ip_hash: row.ipHash,
        status: row.status ?? "pending",
      })
      .select()
      .single();
    if (error || !data) fail("insertSubmission", error);
    return submissionFromRow(data as Row);
  }

  async recordModeration(
    appSlug: string,
    submissionId: string,
    result: ModerationResult,
  ): Promise<void> {
    const { error } = await this.db.from(UGC_TABLES.moderations).insert({
      app_slug: appSlug,
      submission_id: submissionId,
      quality_score: result.qualityScore,
      toxicity: result.toxicity,
      spam: result.spam,
      pii: result.pii,
      categories: result.categories,
      reason: result.reason,
      source: result.source,
      decision: result.decision,
    });
    if (error) fail("recordModeration", error);
  }

  async upsertContent(row: Omit<PublishedContent, "reactions">): Promise<PublishedContent> {
    const { data, error } = await this.db
      .from(UGC_TABLES.content)
      .upsert(
        {
          id: row.id,
          app_slug: row.appSlug,
          slug: row.slug,
          content: row.content,
          content_score: row.contentScore,
          indexed: row.indexed,
          url: row.url,
          status: row.status,
          published_at: row.publishedAt,
          updated_at: row.updatedAt,
        },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error || !data) fail("upsertContent", error);
    return contentFromRow(data as Row);
  }

  async setContentStatus(appSlug: string, contentId: string, status: UgcStatus): Promise<void> {
    const { error } = await this.db
      .from(UGC_TABLES.content)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("app_slug", appSlug)
      .eq("id", contentId);
    if (error) fail("setContentStatus", error);
    // Mirror onto the submission row (published content may not exist yet).
    await this.db
      .from(UGC_TABLES.submissions)
      .update({ status })
      .eq("app_slug", appSlug)
      .eq("id", contentId);
  }

  async getContentBySlug(appSlug: string, slug: string): Promise<PublishedContent | null> {
    const { data, error } = await this.db
      .from(UGC_TABLES.content)
      .select()
      .eq("app_slug", appSlug)
      .eq("slug", slug)
      .maybeSingle();
    if (error) fail("getContentBySlug", error);
    return data ? contentFromRow(data as Row) : null;
  }

  async slugExists(appSlug: string, slug: string): Promise<boolean> {
    const { count, error } = await this.db
      .from(UGC_TABLES.content)
      .select("id", { count: "exact", head: true })
      .eq("app_slug", appSlug)
      .eq("slug", slug);
    if (error) fail("slugExists", error);
    return (count ?? 0) > 0;
  }

  async insertEngagement(row: Omit<Engagement, "id" | "createdAt">): Promise<Engagement> {
    const { data, error } = await this.db
      .from(UGC_TABLES.engagements)
      .insert({
        app_slug: row.appSlug,
        content_id: row.contentId,
        kind: row.kind,
        author_id: row.authorId,
        body: row.body ?? null,
      })
      .select()
      .single();
    if (error || !data) fail("insertEngagement", error);
    const r = data as Row;
    return {
      id: String(r.id),
      appSlug: String(r.app_slug),
      contentId: String(r.content_id),
      kind: r.kind as Engagement["kind"],
      authorId: (r.author_id as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  }

  async insertReport(row: Omit<Report, "id" | "createdAt">): Promise<Report> {
    const { data, error } = await this.db
      .from(UGC_TABLES.reports)
      .insert({
        app_slug: row.appSlug,
        content_id: row.contentId,
        reason: row.reason,
        reporter_id: row.reporterId,
      })
      .select()
      .single();
    if (error || !data) fail("insertReport", error);
    const r = data as Row;
    return {
      id: String(r.id),
      appSlug: String(r.app_slug),
      contentId: String(r.content_id),
      reason: String(r.reason),
      reporterId: (r.reporter_id as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  }

  async countReports(appSlug: string, contentId: string): Promise<number> {
    const { count, error } = await this.db
      .from(UGC_TABLES.reports)
      .select("id", { count: "exact", head: true })
      .eq("app_slug", appSlug)
      .eq("content_id", contentId);
    if (error) fail("countReports", error);
    return count ?? 0;
  }

  async bumpCounter(appSlug: string, windowKey: string, ttlSec: number): Promise<number> {
    const { data, error } = await this.db.rpc("ugc_bump_counter", {
      p_app_slug: appSlug,
      p_window_key: windowKey,
      p_ttl_sec: ttlSec,
    });
    if (error) fail("bumpCounter", error);
    return Number(data);
  }

  async enqueueForReview(row: {
    appSlug: string;
    submissionId: string;
    qualityScore: number;
    categories: string[];
  }): Promise<void> {
    const { error } = await this.db.from(UGC_TABLES.queue).upsert(
      {
        submission_id: row.submissionId,
        app_slug: row.appSlug,
        quality_score: row.qualityScore,
        categories: row.categories,
      },
      { onConflict: "submission_id", ignoreDuplicates: true },
    );
    if (error) fail("enqueueForReview", error);
  }

  async resolveQueueItem(appSlug: string, submissionId: string, resolvedBy: string): Promise<void> {
    const { error } = await this.db
      .from(UGC_TABLES.queue)
      .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq("app_slug", appSlug)
      .eq("submission_id", submissionId)
      .is("resolved_at", null);
    if (error) fail("resolveQueueItem", error);
  }

  // ── DashboardPort ──────────────────────────────────────────────────────────

  async moderationQueue(appSlug: string, limit: number): Promise<QueueItem[]> {
    const { data, error } = await this.db
      .from(UGC_TABLES.queue)
      .select("submission_id, quality_score, categories, enqueued_at")
      .eq("app_slug", appSlug)
      .is("resolved_at", null)
      .order("enqueued_at", { ascending: true })
      .limit(limit);
    if (error) fail("moderationQueue", error);
    const rows = (data ?? []) as Row[];

    const ids = rows.map((r) => String(r.submission_id));
    const excerpts = new Map<string, string>();
    if (ids.length) {
      const { data: subs } = await this.db
        .from(UGC_TABLES.submissions)
        .select("id, content")
        .in("id", ids);
      for (const s of (subs ?? []) as Row[]) {
        excerpts.set(String(s.id), JSON.stringify(s.content ?? {}).slice(0, 140));
      }
    }

    return rows.map((r) => ({
      submissionId: String(r.submission_id),
      appSlug,
      excerpt: excerpts.get(String(r.submission_id)) ?? "",
      qualityScore: Number(r.quality_score),
      categories: (r.categories as ModerationCategory[]) ?? [],
      createdAt: String(r.enqueued_at),
    }));
  }

  async reportQueue(appSlug: string, limit: number): Promise<ReportQueueItem[]> {
    // Content flagged hidden or carrying reports. Grouped in app code for now.
    const { data, error } = await this.db
      .from(UGC_TABLES.reports)
      .select("content_id, reason, created_at")
      .eq("app_slug", appSlug)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) fail("reportQueue", error);
    const rows = (data ?? []) as Row[];

    const agg = new Map<string, { total: number; reason: string; createdAt: string }>();
    for (const r of rows) {
      const id = String(r.content_id);
      const cur = agg.get(id);
      if (cur) cur.total += 1;
      else agg.set(id, { total: 1, reason: String(r.reason), createdAt: String(r.created_at) });
    }

    const ids = [...agg.keys()].slice(0, limit);
    const meta = new Map<string, { slug: string; status: UgcStatus }>();
    if (ids.length) {
      const { data: contents } = await this.db
        .from(UGC_TABLES.content)
        .select("id, slug, status")
        .in("id", ids);
      for (const c of (contents ?? []) as Row[]) {
        meta.set(String(c.id), { slug: String(c.slug), status: c.status as UgcStatus });
      }
    }

    return ids.map((id) => {
      const a = agg.get(id)!;
      const m = meta.get(id);
      return {
        contentId: id,
        appSlug,
        slug: m?.slug ?? "",
        reason: a.reason,
        totalReports: a.total,
        status: m?.status ?? "published",
        createdAt: a.createdAt,
      };
    });
  }

  async dailyStats(appSlug: string, days: number): Promise<DailyStat[]> {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    const { data, error } = await this.db
      .from(UGC_TABLES.submissions)
      .select("status, created_at")
      .eq("app_slug", appSlug)
      .gte("created_at", cutoff);
    if (error) fail("dailyStats", error);

    const byDay = new Map<string, DailyStat>();
    for (const r of (data ?? []) as Row[]) {
      const date = String(r.created_at).slice(0, 10);
      const stat = byDay.get(date) ?? { date, submitted: 0, published: 0, blocked: 0, queued: 0 };
      stat.submitted += 1;
      const status = r.status as UgcStatus;
      if (status === "published") stat.published += 1;
      if (status === "blocked") stat.blocked += 1;
      if (status === "queued") stat.queued += 1;
      byDay.set(date, stat);
    }
    return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  async topSpamPatterns(appSlug: string, limit: number): Promise<SpamPattern[]> {
    const { data, error } = await this.db
      .from(UGC_TABLES.moderations)
      .select("categories, decision")
      .eq("app_slug", appSlug)
      .eq("decision", "block")
      .limit(1000);
    if (error) fail("topSpamPatterns", error);

    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Row[]) {
      for (const c of (r.categories as string[] | null) ?? []) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pattern, count]) => ({ pattern, count }));
  }
}
