import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import { webUrl } from "@/config/site";

/**
 * SiteHeader (C4 D-2) — Phase 1 내비: 홈 · 안전과 신뢰 · 문의 + 시작하기 CTA.
 * 미구현 라우트(서비스/팀/뉴스/채용/위키)는 링크하지 않는다 (C4 D-1).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 text-h3 font-bold text-ink">
          <span
            aria-hidden="true"
            className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-fg text-body-sm font-extrabold"
          >
            D
          </span>
          {BRAND_NAME}
        </Link>

        <nav aria-label="주요 메뉴" className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            href="/safety"
            className="rounded-full px-3 py-2 text-body-sm text-ink-muted hover:bg-primary/10 hover:text-ink"
          >
            안전과 신뢰
          </Link>
          <Link
            href="/contact"
            className="rounded-full px-3 py-2 text-body-sm text-ink-muted hover:bg-primary/10 hover:text-ink"
          >
            문의
          </Link>
          <a
            href={webUrl("/", "header")}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-body-sm font-semibold text-primary-fg hover:bg-primary-strong"
          >
            {BRAND_NAME} 시작하기
          </a>
        </nav>
      </div>
    </header>
  );
}
