import type { MetadataRoute } from "next";
import { SITE_URL, categories, experiments } from "@/lib/experiments";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-05");
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...categories.map((c) => ({ url: `${SITE_URL}/category/${c.slug}/`, lastModified, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...experiments.map((e) => ({ url: `${SITE_URL}/experiment/${e.slug}/`, lastModified, changeFrequency: "monthly" as const, priority: 0.9 })),
    ...["about", "contact", "privacy"].map((p) => ({ url: `${SITE_URL}/${p}/`, lastModified, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
