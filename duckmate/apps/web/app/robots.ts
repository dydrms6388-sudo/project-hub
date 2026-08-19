import type { MetadataRoute } from "next";

/**
 * UGC 인덱싱 게이트(절대 규칙 5). X-Robots-Tag 헤더(next.config)와 이중 방어.
 * company 사이트의 robots 는 전체 Allow 이므로 이 파일을 복사해 쓰지 말 것.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://duckmate.example.com").replace(
    /\/$/,
    ""
  );

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/legal"],
        disallow: [
          "/home",
          "/discover",
          "/likes",
          "/chat",
          "/me",
          "/settings",
          "/onboarding",
          "/verify",
          "/appeal",
          "/sanctioned",
          "/admin",
          "/api",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
