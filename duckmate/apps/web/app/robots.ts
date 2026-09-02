import type { MetadataRoute } from "next";

/**
 * robots.txt — 게이트·UGC 라우트 전부 Disallow (12_flows §0-6 목록 + /api·/dev·/profile·Phase 2~5 예약 경로). E6.
 *  X-Robots-Tag 헤더는 next.config.ts headers() 가, <meta name="robots"> 는 각 그룹 layout 이 담당한다(3중).
 */
export const dynamic = "force-static";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const DISALLOW_PREFIXES: readonly string[] = [
  "/onboarding",
  "/verify",
  "/home",
  "/reco",
  "/match",
  "/chat",
  "/profile",
  "/me",
  "/settings",
  "/report",
  "/blocks",
  "/appeal",
  "/suspended",
  "/blocked",
  "/account/restore",
  "/admin",
  "/login",
  "/api",
  "/dev",
  "/shop",
  "/likes-you",
  "/play",
  "/events",
  "/ranking",
  "/update-required",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/legal", "/account/delete"], disallow: [...DISALLOW_PREFIXES] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
