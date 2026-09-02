import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
          <span>{SITE.name}</span>
          <span className="hidden text-xs font-medium text-muted sm:inline">by {SITE.parent.name}</span>
        </Link>
        <nav aria-label="주요 메뉴" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <details className="relative md:hidden">
            <summary className="btn-ghost h-9 cursor-pointer list-none px-3" aria-label="메뉴 열기">메뉴</summary>
            <nav aria-label="모바일 메뉴" className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface p-2 shadow-lg">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-2">{n.label}</Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
