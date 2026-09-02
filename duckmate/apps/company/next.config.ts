import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 회사 소개 사이트는 완전 정적 (스펙 §7)
  output: "export",
  transpilePackages: ["@duckmate/ui"],
};

export default nextConfig;
