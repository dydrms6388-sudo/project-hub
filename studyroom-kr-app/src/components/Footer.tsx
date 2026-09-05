import Link from "next/link";
import { site } from "@/site.config";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted">
        <p>© {new Date().getFullYear()} {site.name}</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-ink">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-ink">이용약관</Link>
          <a href={`mailto:${site.contactEmail}`} className="hover:text-ink">문의</a>
          <a href="/sitemap.xml" className="hover:text-ink">사이트맵</a>
        </nav>
      </div>
    </footer>
  );
}
