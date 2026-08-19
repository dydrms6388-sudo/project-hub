import type { NextConfig } from "next";

// COOP/COEP: SharedArrayBuffer(ffmpeg.wasm multi-thread 등)를 위해 필요.
// 'credentialless'는 애드센스 같은 외부 스크립트를 덜 막는다. 외부 리소스는 crossorigin="anonymous"로 로드할 것.
const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  webpack(config, { isServer }) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (!isServer) config.output.environment = { ...config.output.environment, asyncFunction: true };
    return config;
  },
};

export default nextConfig;
