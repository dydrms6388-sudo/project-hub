import type { MetadataRoute } from "next";
import { CALCULATORS, CATEGORY_KEYS, GUIDES } from "@/lib/data";
import { requiredSiteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = requiredSiteUrl();
  const lastModified = new Date("2026-08-08");
  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...CALCULATORS.map((c) => ({
      url: `${base}/calc/${c.slug}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...GUIDES.map((g) => ({
      url: `${base}/guide/${g.slug}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...CATEGORY_KEYS.map((cat) => ({
      url: `${base}/category/${cat}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...["about", "contact", "privacy"].map((p) => ({
      url: `${base}/${p}/`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
