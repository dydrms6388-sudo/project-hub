import {
  CATEGORIES,
  CATEGORY_KEYS,
  CategoryKey,
  calcsInCategory,
  guidesInCategory,
} from "@/lib/data";
import { ogCard, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PhotoLab 분류";

export function generateStaticParams() {
  return CATEGORY_KEYS.map((cat) => ({ cat }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const key = (cat in CATEGORIES ? cat : "depth") as CategoryKey;
  const nCalc = calcsInCategory(key).length;
  const nGuide = guidesInCategory(key).length;
  return ogCard({
    badge: "분류",
    title: CATEGORIES[key],
    subtitle: `계산기 ${nCalc}종 · 해설 ${nGuide}편 — 출처를 밝힌 촬영 계산 도구`,
  });
}
