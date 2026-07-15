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
