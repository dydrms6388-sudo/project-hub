import type { MetadataRoute } from "next";
import { site } from "@/site.config";
import { tools } from "@/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...tools.map((t) => ({
      url: `${site.url}/tools/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
