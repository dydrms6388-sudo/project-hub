import Link from "next/link";
import { SITE } from "@/lib/site";
import { Disclaimer } from "./Disclaimer";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <Disclaimer />
        <div className="flex flex-col gap-4 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-fg">{SITE.name} <span className="font-normal text-muted">· {SITE.nameEn}</span></p>
            <p className="mt-1">{SITE.tagline}</p>
            <p className="mt-1">데이터 출처: DART 전자공시 · KRX 정보데이터시스템 · 한국투자증권 KIS Developers</p>
          </div>
          <nav aria-label="법적 고지" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/about" className="hover:text-fg">소개</Link>
            <Link href="/terms" className="hover:text-fg">이용약관</Link>
            <Link href="/privacy" className="hover:text-fg">개인정보처리방침</Link>
            <Link href="/disclaimer" className="hover:text-fg">면책 고지</Link>
            <a href={SITE.parent.url} className="hover:text-fg" rel="noopener">{SITE.parent.name}</a>
          </nav>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} {SITE.parent.name}. 본 서비스는 유사투자자문업 신고 대상이 아닌 데이터 도구로 운영되며, 특정 종목의 매매를 권유하지 않습니다.</p>
      </div>
    </footer>
  );
}
