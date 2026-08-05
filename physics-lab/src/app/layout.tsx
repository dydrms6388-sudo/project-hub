import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_URL, categories } from "@/lib/experiments";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 40가지 물리 시뮬레이션을 직접 조작`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "이중 진자부터 양자 터널링까지, 물리 현상 40가지를 슬라이더로 조작하고 재생·정지하는 무료 인터랙티브 실험실. 카오스는 쌍둥이 비교로, 보존계는 에너지 드리프트로 확인합니다.",
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="logo">물리<span>실험실</span></Link>
            <nav className="gnb" aria-label="주요 메뉴">
              {categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}/`}>{c.label.split("·")[0].trim()}</Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap">
            <nav aria-label="정책 메뉴">
              <Link href="/about/">소개</Link>
              <Link href="/contact/">문의</Link>
              <Link href="/privacy/">개인정보처리방침</Link>
            </nav>
            <p>모든 시뮬레이션은 RK4·심플렉틱·벨레 적분기로 브라우저에서 실시간 계산됩니다(오일러법 미사용). 물리량은 근사이며 각 페이지에 가정을 명시합니다.</p>
            <p>© {new Date().getFullYear()} 물리실험실 (tomatoeggcat.com)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
