// app/sitemap.ts — 동적 사이트맵.
// 기존 도구/페이지 URL(정적 스냅샷) + blog_posts 의 모든 /blog/{slug} 를 포함.
import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase";
import { SITE_PATHS } from "@/lib/site-urls";

export const revalidate = 3600; // 1시간

const SITE = "https://tomatoeggcat.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/blog`, changeFrequency: "daily", priority: 0.8 },
  ];

  // 기존 정적 도구/페이지 URL (root sitemap.xml 스냅샷)
  for (const p of SITE_PATHS) {
    entries.push({ url: `${SITE}${p}`, changeFrequency: "weekly", priority: 0.7 });
  }

  // 블로그 글
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("blog_posts")
      .select("slug,published_at")
      .order("published_at", { ascending: false })
      .limit(5000);
    for (const row of data ?? []) {
      entries.push({
        url: `${SITE}/blog/${row.slug}`,
        lastModified: row.published_at ? new Date(row.published_at) : undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Supabase 미설정/오류 시에도 정적 URL 사이트맵은 유지
  }

  return entries;
}
