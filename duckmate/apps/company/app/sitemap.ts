import type { MetadataRoute } from "next";
import { companyUrl } from "@/config/company";

export const dynamic = "force-static";

/** Phase 1 라우트만(홈·법적 5·문의). 앱(apps/web) URL 은 넣지 않는다(13_company_site 결정 12). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["/", "weekly", 1],
    ["/contact/", "monthly", 0.6],
    ["/legal/terms/", "monthly", 0.4],
    ["/legal/privacy/", "monthly", 0.5],
    ["/legal/location/", "yearly", 0.3],
    ["/legal/youth/", "yearly", 0.3],
    ["/legal/business/", "yearly", 0.3],
  ];
  return entries.map(([path, changeFrequency, priority]) => ({ url: companyUrl(path), lastModified: now, changeFrequency, priority }));
}
