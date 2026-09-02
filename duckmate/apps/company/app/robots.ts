import type { MetadataRoute } from "next";
import { companyUrl } from "@/config/company";

export const dynamic = "force-static";

/** 전부 allow. preview 인덱싱 차단은 layout 의 메타 noindex 가 담당(정적 export 라 헤더 불가). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: companyUrl("/sitemap.xml") };
}
