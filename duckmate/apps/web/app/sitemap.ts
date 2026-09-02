import type { MetadataRoute } from "next";

/**
 * 공식 콘텐츠만 사이트맵에 넣는다 (절대 규칙 5 · E6 게이트 G-6).
 * 회원 프로필·채팅·추천 등 UGC 라우트는 절대 추가하지 말 것.
 */
const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "location",
  "youth",
  "community",
  "refund",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://duckmate.example.com").replace(
    /\/$/,
    ""
  );
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/legal`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    ...LEGAL_SLUGS.map((slug) => ({
      url: `${base}/legal/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
