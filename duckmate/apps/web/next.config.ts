import type { NextConfig } from "next";

/**
 * 보안 헤더(G2): 클릭재킹·MIME 스니핑·리퍼러 누출·불필요 브라우저 기능 차단.
 * 엄격 CSP(script-src nonce)는 Next inline 스크립트·Supabase Realtime(wss)·서명 URL 도메인을 정리한 뒤 G3/Phase 2 에서 도입
 * (G2_security.md 잔여 리스크). frame-ancestors 만 CSP 로 선언해 X-Frame-Options 를 보강한다.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/**
 * X-Robots-Tag 노출 범위(E6) — app/robots.ts Disallow 목록과 동일. next.config headers 는 미들웨어 307 리다이렉트 응답에도 붙는다
 * (scripts/check-noindex.mjs 로 실측). 미들웨어는 헤더를 붙이지 않는다(중복 금지). <meta name="robots"> 는 각 그룹 layout 소유.
 */
const NOINDEX_PREFIXES = [
  "onboarding", "verify", "home", "reco", "match", "chat", "profile", "me", "settings", "report", "blocks", "appeal", "suspended", "blocked",
  "admin", "login", "api", "dev", "shop", "likes-you", "play", "events", "ranking", "update-required", "404",
];
const NOINDEX_HEADERS = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // G1 E2E(.next-e2e)·E6 검사(.next-e6)·측정(.next-dev) 가 동시에 build/dev 해도 `.next` 를 서로 지우지 않도록 산출물 폴더 분리. 미설정 시 `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@duckmate/ui", "@duckmate/db"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  // 배럴(@duckmate/ui index) import → 개별 모듈 import (company 와 동일 설정, E6 번들 진단)
  experimental: { optimizePackageImports: ["@duckmate/ui"] },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: `/:prefix(${NOINDEX_PREFIXES.join("|")})/:path*`, headers: NOINDEX_HEADERS },
      { source: "/account/restore", headers: NOINDEX_HEADERS },
      // Vercel preview 배포 전체 noindex (PRD §5.4)
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" ? [{ source: "/:path*", headers: NOINDEX_HEADERS }] : []),
    ];
  },
};

export default nextConfig;
