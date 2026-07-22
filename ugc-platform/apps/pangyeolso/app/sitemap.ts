import type { MetadataRoute } from "next";
import { listIndexed, SITE_URL } from "./ugc";

export default function sitemap(): MetadataRoute.Sitemap {
  const home = { url: `${SITE_URL}/`, changeFrequency: "daily" as const, priority: 1 };
  const cases = listIndexed().map((c) => ({
    url: `${SITE_URL}${c.url}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [home, ...cases];
}
