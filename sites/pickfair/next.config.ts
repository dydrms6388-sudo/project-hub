import type { NextConfig } from "next";

/**
 * 두 가지 빌드 모드
 *  - 기본(Vercel 개별 프로젝트): 일반 Next.js. OG 이미지 라우트/SSG 전부 사용.
 *  - STATIC_EXPORT=1 (허브 리포 preview/ 선배포용): output:export + basePath.
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.STATIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  ...(isExport
    ? { output: "export" as const, basePath, images: { unoptimized: true } }
    : {}),
  // ffmpeg.wasm / SharedArrayBuffer 를 쓰는 사이트만 CROSS_ORIGIN_ISOLATION=1 로 켠다.
  // credentialless 로 두어야 애드센스 등 외부 스크립트가 COEP 에 막히지 않는다.
  async headers() {
    if (process.env.CROSS_ORIGIN_ISOLATION !== "1") return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
