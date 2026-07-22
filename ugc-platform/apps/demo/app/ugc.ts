/**
 * Single wiring point for @ggu/ugc-core in this demo. Everything the app does
 * (submit, moderate, publish, sitemap, case pages) goes through `ugc`.
 *
 * Storage: an in-memory store by default so the demo runs with **no external
 * services**. Set the SUPABASE_* env vars to swap in the real SupabaseStore —
 * the rest of the app is unchanged (that's the whole point of the port design).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createUgc,
  defineUgcConfig,
  HeuristicClassifier,
  MemoryStore,
  type PublishedContent,
  type SeoSink,
  type Ugc,
  type UgcStore,
} from "@ggu/ugc-core";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const demoConfig = defineUgcConfig({
  appSlug: "demo",
  contentSchema: z.object({
    title: z.string().min(2, "제목은 2자 이상").max(80),
    body: z.string().min(10, "본문은 10자 이상").max(4000),
  }),
  moderation: {
    autoPublishThreshold: 55,
    blockThreshold: 20,
    requireMinLength: 10,
    forbiddenCategories: ["pii", "hate", "adult"],
  },
  seo: {
    urlPattern: "/case/[slug]",
    titleTemplate: "{title}",
    minContentScore: 20,
  },
  rateLimit: { perIpPerHour: 30, perUserPerDay: 100 },
});

/** Revalidates the pages affected by a publish so SEO surfaces update live. */
const seo: SeoSink = {
  async index(url) {
    revalidatePath(url);
    revalidatePath("/");
    revalidatePath("/sitemap.xml");
  },
  async deindex(url) {
    revalidatePath(url);
    revalidatePath("/sitemap.xml");
  },
};

// Singletons must survive Next's dev HMR, so stash them on globalThis.
const g = globalThis as unknown as { __ugcStore?: MemoryStore; __ugc?: Ugc };

const store: MemoryStore = g.__ugcStore ?? (g.__ugcStore = new MemoryStore());

export const ugc: Ugc =
  g.__ugc ??
  (g.__ugc = createUgc(demoConfig, {
    store: store as UgcStore,
    classifier: new HeuristicClassifier(),
    seo,
    dashboard: store, // MemoryStore implements DashboardPort too
  }));

// ── Read helpers (demo reads the MemoryStore directly; a Supabase build would
//    query ugc_content instead) ────────────────────────────────────────────
export function listPublished(): PublishedContent[] {
  return [...store.content.values()]
    .filter((c) => c.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function listIndexed(): PublishedContent[] {
  return listPublished().filter((c) => c.indexed);
}

export function getPublishedBySlug(slug: string): PublishedContent | null {
  const c = [...store.content.values()].find((x) => x.slug === slug);
  return c && c.status === "published" ? c : null;
}

export function getContentById(id: string): PublishedContent | null {
  return store.content.get(id) ?? null;
}

/** The primary text field of a demo post (used for re-scoring on engage). */
export function bodyText(c: PublishedContent): string {
  return String((c.content as { body?: string }).body ?? "");
}

/** Body text of a raw submission (used when approving from the review queue). */
export function submissionBody(submissionId: string): string {
  const s = store.submissions.get(submissionId);
  return String(((s?.content ?? {}) as { body?: string }).body ?? "");
}
