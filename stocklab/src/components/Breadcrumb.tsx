import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { absUrl } from "@/lib/site";

export interface Crumb { href: string; label: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ href: "/", label: "홈" }, ...items];
  return (
    <>
      <nav aria-label="현재 위치" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {i === all.length - 1 ? <span aria-current="page" className="text-fg">{c.label}</span> : <Link href={c.href} className="hover:text-fg">{c.label}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absUrl(c.href) })) }} />
    </>
  );
}
