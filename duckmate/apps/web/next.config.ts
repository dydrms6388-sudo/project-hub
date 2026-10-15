import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Supabase 오리진 — REST·Realtime·Storage 서명 URL 이 전부 여기서 나온다.
// 빌드 시 환경변수가 없으면(프리뷰·E2E) 프로젝트 와일드카드로 폴백한다.
function supabaseOrigins(): { https: string; wss: string } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const { origin, host } = new URL(raw);
      return { https: origin, wss: `wss://${host}` };
    } catch {
      // 잘못된 URL 이면 폴백 (빌드를 막지 않는다)
    }
  }
  return { https: "https://*.supabase.co", wss: "wss://*.supabase.co" };
}

const supabase = supabaseOrigins();

// CSP (G2-15 / G2-32).
//
// script-src 에 'unsafe-inline' 이 남아 있는 이유: Next.js App Router 는 스트리밍
// 페이로드(`self.__next_f.push`)를 인라인 <script> 로 주입한다. 이를 제거하려면
// 요청마다 nonce 를 발급해 미들웨어에서 CSP 를 재작성해야 하며, nonce 가 붙는 순간
// 모든 응답이 동적 렌더링으로 바뀐다(정적 최적화 상실). Phase 1 은 정적 경로 비중이
// 커서 비용이 크므로, 지금은 아래 조합으로 XSS 영향을 좁힌다:
//   - 외부 스크립트 호스트 전면 차단(script-src 'self')
//   - object-src 'none' · base-uri 'self' · form-action 'self'
//   - frame-ancestors 'none' (어드민 콘솔 클릭재킹 차단, G2-15 의 실제 위협)
// nonce 도입은 Phase 2 과제로 docs/agents/29_security_review.md 에 남긴다.
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'"
  : // 개발 서버(React Refresh)는 eval 을 쓴다. 프로덕션 헤더에는 절대 포함되지 않는다.
    "'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // Tailwind v4 와 Next 가 인라인 <style> 을 주입한다.
  "style-src 'self' 'unsafe-inline'",
  // 프로필·채팅 이미지는 비공개 버킷의 서명 URL, 미리보기는 blob:
  `img-src 'self' data: blob: ${supabase.https}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.https} ${supabase.wss}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // CSP frame-ancestors 를 모르는 구형 브라우저용 이중화
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 어드민이 발급받는 Storage 서명 URL 이 Referer 로 새어나가지 않게 한다 (G2-21 동반).
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

// HSTS 는 프로덕션에서만. 로컬 http 개발을 영구적으로 https 로 고정시키면 안 된다.
if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  transpilePackages: ["@duckmate/ui", "@duckmate/db", "@duckmate/game-engine"],
  // 서버 헤더로 스택을 광고하지 않는다.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // UGC 인덱싱 게이트(절대 규칙 5): 회원 영역은 전부 noindex.
        // 공식 페이지(랜딩·법적 고지)는 각 라우트 metadata 에서 개별적으로 index 허용.
        source: "/((?!$|legal(?=/|$)).*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // 보안 헤더는 예외 없이 전 경로 (G2-15 / G2-32)
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
