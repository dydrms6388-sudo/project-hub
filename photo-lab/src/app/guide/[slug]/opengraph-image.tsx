import { CATEGORIES, GUIDES, getGuide } from "@/lib/data";
import { ogCard, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PhotoLab 해설";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  const topic = guide?.topic ?? "";
  return ogCard({
    badge: `${CATEGORIES[guide?.category ?? "depth"]} 해설`,
    title: guide?.name ?? "해설",
    subtitle: topic.length > 64 ? `${topic.slice(0, 64)}…` : topic,
  });
}
