import Link from "next/link";
import { SERVICE_NAME, appUrl, company, isPlaceholder } from "@/config/company";
import { LEGAL_LINKS } from "@/lib/legal";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { LegalBlockCompact } from "./LegalBlock";

const linkCls = "text-body-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 rounded-sm";

/**
 * 푸터 — 4열(브랜드 / 서비스 / 회사 / 법적 고지) → 모바일 1열, 최하단 사업자 정보 블록(플레이스홀더 = [TODO_사업자정보] 그대로).
 * 광고·뉴스레터 폼 없음. Phase 1 은 서비스=앱 시작하기, 회사=문의 만.
 */
export function Footer() {
  const start = appUrl("/onboarding/age");
  const sns = [
    { label: "X", href: company.SNS_X },
    { label: "Instagram", href: company.SNS_INSTAGRAM },
  ].filter((s) => !isPlaceholder(s.href));

  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="text-body-sm mt-3 text-muted-foreground">같은 걸 좋아하는 사람이랑 만나는 앱</p>
            {sns.length ? (
              <ul className="mt-3 flex gap-3" aria-label="소셜 미디어">
                {sns.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} rel="noopener noreferrer" target="_blank" className={linkCls}>
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <nav aria-label="서비스">
            <h2 className="text-label text-foreground">서비스</h2>
            <ul className="mt-3 space-y-2">
              <li>
                {start ? (
                  <a href={start} rel="noopener" className={linkCls}>
                    앱 시작하기
                  </a>
                ) : (
                  <span className="text-body-sm text-muted-foreground">앱 시작하기 (준비 중)</span>
                )}
              </li>
            </ul>
          </nav>
          <nav aria-label="회사">
            <h2 className="text-label text-foreground">회사</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/contact/" className={linkCls}>
                  문의
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="법적 고지">
            <h2 className="text-label text-foreground">법적 고지</h2>
            <ul className="mt-3 space-y-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={l.href === "/legal/privacy/" ? `${linkCls} font-bold text-foreground` : linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 border-t border-border pt-6">
          <LegalBlockCompact />
          <p className="sr-only">{SERVICE_NAME} 회사 소개 사이트</p>
        </div>
      </Container>
    </footer>
  );
}
