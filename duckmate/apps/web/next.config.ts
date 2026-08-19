import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@duckmate/ui", "@duckmate/db", "@duckmate/game-engine"],
  async headers() {
    return [
      {
        // UGC 인덱싱 게이트(절대 규칙 5): 회원 영역은 전부 noindex.
        // 공식 페이지(랜딩·법적 고지)는 각 라우트 metadata 에서 개별적으로 index 허용.
        source: "/((?!$|legal(?=/|$)).*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
