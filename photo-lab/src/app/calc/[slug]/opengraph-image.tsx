import { CALCULATORS, CATEGORIES, getCalc } from "@/lib/data";
import { ogCard, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PhotoLab 계산기";

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const calc = getCalc(slug);
  const formula = calc?.formula.split(";")[0].trim() ?? "";
  return ogCard({
    badge: `${CATEGORIES[calc?.category ?? "depth"]} 계산기`,
    title: calc?.name ?? "계산기",
    subtitle: formula.length > 60 ? `${formula.slice(0, 60)}…` : formula,
  });
}
