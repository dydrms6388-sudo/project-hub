import type { MetadataRoute } from "next";
import { SITE_URL, categories, sounds } from "@/lib/sounds";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-08");
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/category/${c.slug}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...sounds.map((s) => ({
      url: `${SITE_URL}/sound/${s.slug}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...["about", "contact", "privacy"].map((p) => ({
      url: `${SITE_URL}/${p}/`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
