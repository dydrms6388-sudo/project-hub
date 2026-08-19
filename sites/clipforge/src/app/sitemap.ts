import type { MetadataRoute } from "next";
import { site } from "@/site.config";
import { tools } from "@/tools/registry";
import { extraRoutes } from "@/lib/routes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${site.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/tools/`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...tools.map((t) => ({
      url: `${site.url}/tools/${t.slug}/`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...extraRoutes.map((p) => ({
      url: `${site.url}${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${site.url}/privacy/`, lastModified: now, priority: 0.3 },
    { url: `${site.url}/terms/`, lastModified: now, priority: 0.3 },
  ];
}
