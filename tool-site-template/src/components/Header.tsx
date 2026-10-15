import Link from "next/link";
import { site } from "@/site.config";

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          {site.shortName}
        </Link>
        <nav className="text-sm text-muted">
          <Link href="/#tools" className="hover:text-ink">전체 도구</Link>
        </nav>
      </div>
    </header>
  );
}
