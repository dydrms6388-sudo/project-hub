import Link from "next/link";
import { categories, site, type CategoryKey } from "@/site.config";
import { tools } from "@/tools/registry";

export default function Home() {
  const grouped = Object.entries(categories) as [CategoryKey, (typeof categories)[CategoryKey]][];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{site.name}</h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">{site.description}</p>
      </section>
      <section id="tools" className="space-y-8">
        {grouped.map(([key, cat]) => {
          const list = tools.filter((t) => t.category === key);
          if (!list.length) return null;
          return (
            <div key={key}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: cat.color }}>
                <span className="h-3 w-3 rounded-sm" style={{ background: cat.color }} />
                {cat.label}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/tools/${t.slug}`} className="block rounded-lg border border-line p-4 hover:bg-paper">
                      <p className="font-medium text-ink">{t.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
