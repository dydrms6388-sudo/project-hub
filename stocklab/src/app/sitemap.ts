import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/calc/compound", priority: 0.9, freq: "monthly" },
    { path: "/screener/value", priority: 0.9, freq: "daily" },
    { path: "/screener/dividend", priority: 0.9, freq: "daily" },
    { path: "/today", priority: 0.8, freq: "daily" },
    { path: "/about", priority: 0.5, freq: "monthly" },
    { path: "/terms", priority: 0.2, freq: "yearly" },
    { path: "/privacy", priority: 0.2, freq: "yearly" },
    { path: "/disclaimer", priority: 0.3, freq: "yearly" },
  ];
  return pages.map((p) => ({ url: absUrl(p.path), lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}
