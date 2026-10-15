import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTool, tools } from "@/tools/registry";
import { toolJsonLd, toolMetadata } from "@/lib/seo";
import { ToolShell } from "@/components/ToolShell";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const t = getTool(slug);
  return t ? toolMetadata(t) : {};
}

export default async function ToolPage({ params }: Params) {
  const { slug } = await params;
  const t = getTool(slug);
  if (!t) notFound();
  const { default: Tool } = await t.component();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(t)) }}
      />
      <ToolShell tool={t}>
        <Tool />
      </ToolShell>
    </>
  );
}
