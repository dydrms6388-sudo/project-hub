import type { MetadataRoute } from "next";
import { SITE_URL } from "@/site.config";
import { CATEGORIES } from "@/content/categories";
import { getIndexedSlugs } from "@/lib/promotion-data";

export const revalidate = 3600; // 승격분 반영 (시간당)

/**
 * sitemap = 밀도 있는 색인 대상만 (F3/F6/A4).
 * v1 색인 대상 = 홈(고유 본문 1,200자+) + 카테고리 허브 12(각 1,200자+).
 * 정보/약관 페이지는 필수라 footer로 노출·접근되지만 1,200자 미만이라 sitemap에서 제외한다
 * (sitemap에 1,200자 미만이 1개라도 있으면 실패). 시드/UGC 설문은 승격 전까지 noindex → 제외.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = { url: `${SITE_URL}/`, changeFrequency: "daily" as const, priority: 1 };
  const hubs = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  // 승격 통과분(is_indexed)만 추가 — 미승격 설문은 절대 넣지 않는다(F3).
  const promoted = (await getIndexedSlugs()).map((slug) => ({
    url: `${SITE_URL}/q/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [home, ...hubs, ...promoted];
}
