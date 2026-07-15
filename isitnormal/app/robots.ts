import type { MetadataRoute } from "next";
import { SITE_URL, ROBOTS_DISALLOW } from "@/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
