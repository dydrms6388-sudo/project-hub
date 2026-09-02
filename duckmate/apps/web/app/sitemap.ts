import type { MetadataRoute } from "next";
import { LEGAL_ROUTE_SLUGS } from "@/lib/legal";

/**
 * sitemap.xml — 공식 페이지만(랜딩 · 법적 고지 인덱스+7 · 계정 삭제 안내). E6.
 *  (onboarding)·(app)·(admin)·/login·/dev·/api 등 UGC/게이트 라우트는 절대 넣지 않는다(PRD §0-49, 12_flows §0-6).
 *  `scripts/check-noindex.mjs` 가 이 목록과 실제 응답의 robots 를 대조한다.
 */
export const dynamic = "force-static";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** 인덱스 허용 경로(단일 소스). robots.ts·check-noindex 가 같은 규칙을 쓴다. */
const OFFICIAL_PATHS: readonly string[] = ["/", "/legal", ...LEGAL_ROUTE_SLUGS.map((s) => `/legal/${s}`), "/legal/business", "/account/delete"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return OFFICIAL_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.4 : 0.5,
  }));
}
