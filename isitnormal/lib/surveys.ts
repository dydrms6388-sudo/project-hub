/**
 * 설문 데이터 접근 — v1(P3)은 로컬 시드가 콘텐츠의 진실원천.
 * 투표/통계는 Supabase에서 오고, 설문 원문·해설·허브는 content/*.ts 에서 온다.
 * (P5에서 사용자 UGC 설문이 Supabase에 추가되면 여기에 병합한다.)
 */
import { CATEGORIES, CATEGORY_BY_SLUG, type CategorySlug } from "@/content/categories";
import { SEEDS } from "@/content/seeds";
import { HUBS } from "@/content/hubs";
import type { SeedSurvey } from "@/content/schema";
import type { CategoryHub } from "@/content/schema";
import { getAnonSupabase } from "@/lib/supabase/server";

export { CATEGORIES };

export function getCategory(slug: string) {
  return CATEGORY_BY_SLUG[slug as CategorySlug];
}

export function getHub(slug: string): CategoryHub | undefined {
  return HUBS.find((h) => h.categorySlug === slug);
}

export function getSeedsByCategory(slug: string): SeedSurvey[] {
  return SEEDS.filter((s) => s.categorySlug === slug);
}

export function getSurveyBySlug(slug: string): SeedSurvey | undefined {
  return SEEDS.find((s) => s.slug === slug);
}

export function getRelated(slug: string): SeedSurvey[] {
  const s = getSurveyBySlug(slug);
  if (!s?.related) return [];
  return s.related
    .map(getSurveyBySlug)
    .filter((x): x is SeedSurvey => Boolean(x));
}

/** 홈 강제 노출용 — 시드 일부 (첫 2주 신규 노출 정책의 자리, S4). */
export function getFeatured(limit = 8): SeedSurvey[] {
  return SEEDS.slice(0, limit);
}

export const ALL_SURVEYS = SEEDS;

/** 렌더에 필요한 통합 설문 형태 (시드 또는 승인된 UGC). */
export interface ResolvedSurvey {
  slug: string;
  categorySlug: CategorySlug;
  title: string;
  body: string;
  options: { key: string; label: string }[];
  editorCommentary: string;
  related: string[];
  origin: "operator" | "user";
}

/**
 * slug → 설문. 시드는 로컬(동기), 시드가 아니면 승인된 UGC를 Supabase에서 조회.
 * UGC 개방 시 사용자 설문 페이지가 정상 렌더되도록 한다. 미존재/미승인이면 null.
 */
export async function resolveSurvey(slug: string): Promise<ResolvedSurvey | null> {
  const seed = getSurveyBySlug(slug);
  if (seed) {
    return {
      slug: seed.slug,
      categorySlug: seed.categorySlug,
      title: seed.title,
      body: seed.body,
      options: seed.options.map((o) => ({ key: o.key, label: o.label })),
      editorCommentary: seed.editorCommentary,
      related: seed.related ?? [],
      origin: "operator",
    };
  }
  const sb = getAnonSupabase();
  if (!sb) return null;
  const { data: s } = await sb
    .from("surveys")
    .select("id, slug, title, body, editor_commentary, category_id, origin")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (!s) return null;
  const { data: opts } = await sb
    .from("survey_options")
    .select("opt_key, label, sort")
    .eq("survey_id", s.id)
    .order("sort");
  const cat = CATEGORIES[(s.category_id as number) - 1];
  return {
    slug: s.slug,
    categorySlug: (cat?.slug ?? "living") as CategorySlug,
    title: s.title,
    body: s.body,
    options: (opts ?? []).map((o) => ({ key: o.opt_key as string, label: o.label as string })),
    editorCommentary: s.editor_commentary ?? "",
    related: [],
    origin: (s.origin as "operator" | "user") ?? "user",
  };
}
