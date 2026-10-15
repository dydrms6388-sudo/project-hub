import Link from "next/link";
import { site } from "@/site.config";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="min-w-0 truncate text-base font-bold tracking-tight text-slate-900">
          {site.name}
        </Link>
        <nav className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
          <Link href="/tools/" className="hover:text-slate-900">
            전체 도구
          </Link>
          <Link href="/guide/markdown-basics/" className="hover:text-slate-900">
            가이드
          </Link>
        </nav>
      </div>
    </header>
  );
}
