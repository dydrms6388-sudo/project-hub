import type { NextConfig } from "next";

/**
 * 두 가지 빌드 모드
 *  - 기본(Vercel 개별 프로젝트): 일반 Next.js. SSG + 헤더 적용.
 *  - STATIC_EXPORT=1 (허브 리포 preview/ 선배포용): output:export + basePath.
 *    이 모드에서는 next 가 헤더를 낼 수 없으므로 SharedArrayBuffer 가 비활성이고
 *    ffmpeg 는 싱글스레드 코어로 폴백한다. (런타임 detectWasmThreads() 로 판정)
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.STATIC_BASE_PATH ?? "";

/**
 * clipforge 는 ffmpeg.wasm 멀티스레드 코어(SharedArrayBuffer)를 쓰므로
 * cross-origin isolation 이 기본값으로 켜져 있다.
 * (CROSS_ORIGIN_ISOLATION=0 으로 명시하면 끌 수 있다.)
 * credentialless 로 두어야 애드센스 등 외부 스크립트가 COEP 에 막히지 않는다.
 */
const crossOriginIsolation = process.env.CROSS_ORIGIN_ISOLATION !== "0";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isExport
    ? { output: "export" as const, basePath, images: { unoptimized: true } }
    : {}),
  async headers() {
    if (!crossOriginIsolation) return [];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
