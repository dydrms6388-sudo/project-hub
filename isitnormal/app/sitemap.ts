import type { MetadataRoute } from "next";
import { SITE_URL } from "@/site.config";
import { CATEGORIES } from "@/content/categories";

/**
 * sitemap = 색인 대상만 (F3: URL 수 == 색인 대상 수).
 * v1 색인 대상 = 홈 + 카테고리 허브 12 + 고정 정보 페이지.
 * 시드/UGC 설문 페이지는 승격 전까지 noindex → sitemap 제외.
 * (승격 잡이 n>=30·7일 통과분을 별도로 추가한다.)
 */
const STATIC_PAGES = [
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/community-guidelines",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const home = { url: `${SITE_URL}/`, changeFrequency: "daily" as const, priority: 1 };
  const hubs = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const statics = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));
  return [home, ...hubs, ...statics];
}
