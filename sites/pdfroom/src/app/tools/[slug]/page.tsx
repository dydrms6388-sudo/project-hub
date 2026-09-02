import { notFound } from "next/navigation";
import ToolShell from "@/components/ToolShell";
import { JsonLd, toolJsonLd, toolMetadata } from "@/lib/seo";
import { toolBySlug, tools } from "@/tools/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) return {};
  return toolMetadata(tool);
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  return (
    <>
      <JsonLd data={toolJsonLd(tool)} />
      <ToolShell tool={tool} />
    </>
  );
}
