import type { NextConfig } from "next";

/**
 * X-Robots-Tag 노출 범위 — app/robots.ts DISALLOW_PREFIXES 와 동일 목록(헤더는 리다이렉트/리라이트 응답에도 붙는다).
 * 미들웨어는 헤더를 붙이지 않는다(중복 금지, E6). <meta name="robots"> 는 각 그룹 layout 소유.
 */
const NOINDEX_PREFIXES = [
  "onboarding",
  "verify",
  "home",
  "reco",
  "match",
  "chat",
  "profile",
  "me",
  "settings",
  "report",
  "blocks",
  "appeal",
  "suspended",
  "blocked",
  "admin",
  "login",
  "api",
  "dev",
  "shop",
  "likes-you",
  "play",
  "events",
  "ranking",
  "update-required",
  "404",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // G1 E2E: `NEXT_DIST_DIR=.next-e2e` 로 빌드 산출물 폴더를 분리해 동시 `next build`/`next dev` 가 `.next` 를 서로 지우는 충돌을 피한다. 미설정 시 기본 `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@duckmate/ui", "@duckmate/db"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  // 배럴(@duckmate/ui index) import → 개별 모듈 import (company 와 동일 설정, E6 번들 진단)
  experimental: { optimizePackageImports: ["@duckmate/ui"] },
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: `/:prefix(${NOINDEX_PREFIXES.join("|")})/:path*`, headers: noindex },
      { source: "/account/restore", headers: noindex },
      // Vercel preview 배포 전체 noindex (PRD §5.4)
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" ? [{ source: "/:path*", headers: noindex }] : []),
    ];
  },
};

export default nextConfig;
