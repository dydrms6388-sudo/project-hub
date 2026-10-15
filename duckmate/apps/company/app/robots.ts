import type { MetadataRoute } from "next";
import { COMPANY_URL } from "@/config/site";

/**
 * robots.txt — 회사 사이트는 UGC 가 없어 전체 Allow (C4 §5.1).
 * apps/web 의 UGC noindex 규칙과 정반대이므로 서로 복사해 쓰지 말 것.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${COMPANY_URL}/sitemap.xml`,
    host: COMPANY_URL,
  };
}
