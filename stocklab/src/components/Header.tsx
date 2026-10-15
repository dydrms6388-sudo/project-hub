import Link from "next/link";
import { NAV, SITE, TOOL_GROUPS } from "@/lib/site";
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
          <details className="relative">
            <summary className="btn-ghost h-9 cursor-pointer list-none px-3" aria-label="전체 도구 메뉴 열기">메뉴</summary>
            <nav aria-label="전체 도구" className="absolute right-0 mt-2 w-[min(92vw,40rem)] rounded-xl border border-border bg-surface p-3 shadow-lg">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TOOL_GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</p>
                    {g.items.map((t) => (
                      <Link key={t.href} href={t.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                        <span>{t.label}</span>
                        {t.isNew && <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">NEW</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-2 pt-2 text-xs text-muted">
                <Link href="/tools" className="hover:text-fg">전체 도구</Link>
                <Link href="/about" className="hover:text-fg">소개</Link>
                <Link href="/disclaimer" className="hover:text-fg">면책 고지</Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
