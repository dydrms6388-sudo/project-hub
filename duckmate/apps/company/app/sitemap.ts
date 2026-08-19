import type { MetadataRoute } from "next";
import { COMPANY_URL } from "@/config/site";

/**
 * sitemap.xml — 회사 사이트는 전 페이지 인덱싱 허용 (C4 D-5 / §5.1).
 * **존재하는 라우트만** 넣는다. Phase 5 라우트(service/team/news/careers/wiki)는
 * 라우트 자체가 없으므로 여기에도 없어야 한다(E6 검증: sitemap 집합 = 산출물 라우트 집합).
 * 정적 export 에서도 빌드 타임에 파일로 생성된다.
 */
export const dynamic = "force-static";

const ROUTES: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/safety", priority: 0.8 },
  { path: "/legal", priority: 0.5 },
  { path: "/contact", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${COMPANY_URL}${r.path === "/" ? "" : r.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: r.priority,
  }));
}
