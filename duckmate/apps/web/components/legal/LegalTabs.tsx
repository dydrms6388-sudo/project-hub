import Link from "next/link";
import { cn } from "@duckmate/ui";
import { LEGAL_LINKS } from "@/lib/legal";

/** 법적 문서 7종 상단 탭. 현재 페이지 aria-current. 가로 스크롤(페이지 가로 스크롤 금지). */
export function LegalTabs({ current }: { current: string }) {
  return (
    <nav aria-label="법적 고지 문서" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-border">
        {LEGAL_LINKS.map((l) => {
          const active = l.href === current;
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-label -mb-px inline-block whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
