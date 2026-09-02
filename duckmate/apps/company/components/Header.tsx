import Link from "next/link";
import { DisabledButton, LinkButton } from "./LinkButton";
import { SERVICE_NAME, appUrl } from "@/config/company";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { Container } from "./Container";

/**
 * 헤더 — Phase 1 내비 = `문의` 1개 + 앱 시작 CTA (13_company_site §4).
 * sticky + 배경 블러(CSS). WEB_APP_URL 플레이스홀더면 CTA "준비 중" 비활성(서버 렌더 `DisabledButton` — ui Button 은 클라이언트 청크, H2).
 */
export function Header() {
  const start = appUrl("/onboarding/age");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-14 items-center justify-between gap-4 md:h-16">
        <Link href="/" aria-label={`${SERVICE_NAME} 홈`} className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="주 메뉴" className="flex items-center gap-2 md:gap-4">
          <NavLink href="/contact/" className="text-label rounded-md px-3 py-2 text-foreground hover:bg-muted aria-[current=page]:text-primary">
            문의
          </NavLink>
          {start ? (
            <LinkButton href={start} rel="noopener" size="sm">
              앱 시작하기
            </LinkButton>
          ) : (
            <DisabledButton size="sm" title="앱 주소가 아직 설정되지 않았어요">
              준비 중
            </DisabledButton>
          )}
        </nav>
      </Container>
    </header>
  );
}
