/**
 * 판결소 wiring — @ggu/ugc-core 의 첫 실제 소비자 앱.
 * INTEGRATION.md 의 판결소 프리셋을 그대로 사용한다.
 *
 * 저장소 선택: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 SupabaseStore,
 * 없으면 MemoryStore (로컬/데모 실행). 파이프라인 코드는 어느 쪽이든 동일하다.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createUgc,
  defineUgcConfig,
  HeuristicClassifier,
  MemoryStore,
  SupabaseStore,
  type PublishedContent,
  type SeoSink,
  type Ugc,
  type UgcStore,
} from "@ggu/ugc-core";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const pangyeolsoConfig = defineUgcConfig({
  appSlug: "pangyeolso",
  contentSchema: z.object({
    title: z.string().min(5, "제목은 5자 이상").max(80),
    situation: z.string().min(100, "사연은 100자 이상 자세히 적어주세요").max(5000),
    sideA: z.string().min(10, "A 입장은 10자 이상").max(500),
    sideB: z.string().min(10, "B 입장은 10자 이상").max(500),
  }),
  moderation: {
    autoPublishThreshold: 75, // 사람 이야기 → 보수적으로, 대부분 검수 큐를 거친다
    blockThreshold: 30,
    requireMinLength: 100,
    forbiddenCategories: ["pii", "hate", "adult", "violence", "illegal"],
  },
  seo: {
    urlPattern: "/case/[slug]",
    titleTemplate: "{title} — 판결소",
    minContentScore: 40,
  },
  rateLimit: { perIpPerHour: 3, perUserPerDay: 5 },
});

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

const g = globalThis as unknown as {
  __pgsStore?: MemoryStore;
  __pgsUgc?: Ugc;
};

/** Supabase creds present → real DB; otherwise in-memory (local/demo). */
function makeStore(): { store: UgcStore; memory: MemoryStore | null } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return { store: new SupabaseStore(createClient(url, key)), memory: null };
  }
  const memory = g.__pgsStore ?? (g.__pgsStore = new MemoryStore());
  return { store: memory, memory };
}

const { store, memory } = makeStore();

export const ugc: Ugc =
  g.__pgsUgc ??
  (g.__pgsUgc = createUgc(pangyeolsoConfig, {
    store,
    classifier: new HeuristicClassifier(),
    seo,
    dashboard: memory ?? (store as unknown as SupabaseStore),
  }));

export { store };

// ── 판결소 도메인 헬퍼 ────────────────────────────────────────────────────────

export interface CaseFields {
  title: string;
  situation: string;
  sideA: string;
  sideB: string;
}

export function caseFields(c: PublishedContent): CaseFields {
  const x = c.content as Partial<CaseFields>;
  return {
    title: x.title ?? "제목 없음",
    situation: x.situation ?? "",
    sideA: x.sideA ?? "",
    sideB: x.sideB ?? "",
  };
}

/** 검수/재점수에 쓰는 대표 텍스트 = 사연 본문. */
export function caseText(raw: { situation?: unknown }): string {
  return String(raw.situation ?? "");
}

export function listPublished(): PublishedContent[] {
  if (!memory) return []; // Supabase 모드의 목록 쿼리는 실DB 연결 시 구현
  return [...memory.content.values()]
    .filter((c) => c.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function listIndexed(): PublishedContent[] {
  return listPublished().filter((c) => c.indexed);
}

export function getPublishedBySlug(slug: string): PublishedContent | null {
  if (!memory) return null;
  const c = [...memory.content.values()].find((x) => x.slug === slug);
  return c && c.status === "published" ? c : null;
}

export function getContentById(id: string): PublishedContent | null {
  return memory?.content.get(id) ?? null;
}

export function submissionText(submissionId: string): string {
  const s = memory?.submissions.get(submissionId);
  return caseText((s?.content ?? {}) as { situation?: unknown });
}

/** A/B 판결 집계. vote 엔게이지먼트의 body('A'|'B')를 센다. */
export function voteCounts(contentId: string): { a: number; b: number } {
  if (!memory) return { a: 0, b: 0 };
  let a = 0;
  let b = 0;
  for (const e of memory.engagements) {
    if (e.contentId !== contentId || e.kind !== "vote") continue;
    if (e.body === "A") a++;
    else if (e.body === "B") b++;
  }
  return { a, b };
}
