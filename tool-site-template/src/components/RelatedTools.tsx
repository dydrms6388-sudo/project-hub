import Link from "next/link";
import { categories } from "@/site.config";
import { getTool } from "@/tools/registry";

export function RelatedTools({ slugs }: { slugs: string[] }) {
  const items = slugs.map(getTool).filter(Boolean);
  if (!items.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((t) => (
        <li key={t!.slug}>
          <Link
            href={`/tools/${t!.slug}`}
            className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 hover:bg-paper"
          >
            <span className="h-8 w-1 rounded" style={{ background: categories[t!.category].color }} />
            <span className="text-[15px] font-medium text-ink">{t!.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
