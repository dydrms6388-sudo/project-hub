import type { NextConfig } from "next";

/**
 * company — 정적 export (Vercel root=duckmate/apps/company, output=out/).
 * 서버 런타임 없음: 문의 폼만 Edge Function 에 POST 한다(NEXT_PUBLIC_CONTACT_ENDPOINT).
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@duckmate/ui"],
  reactStrictMode: true,
  // 배럴(@duckmate/ui index) import 를 개별 모듈 import 로 변환 — 홈에 DemoGallery·Radix 전부가 딸려오는 것 방지
  experimental: { optimizePackageImports: ["@duckmate/ui"] },
};

export default nextConfig;
