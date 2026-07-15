/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // 공유/내부 경로는 색인 금지 (U1). robots.txt와 이중 방어.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/s/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
      { source: "/pending/:path*", headers: noindex },
      { source: "/vote/:path*", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/admin", headers: noindex },
    ];
  },
};
export default nextConfig;
