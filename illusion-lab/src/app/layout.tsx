import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_URL, categories } from "@/lib/illusions";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 40가지 착시를 직접 조작하는 인터랙티브 실험실`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "뮐러-라이어부터 펜로즈 삼각형까지, 고전 착시 40가지를 슬라이더로 조작하고 속임수 벗기기로 확인하는 무료 인터랙티브 착시 실험실.",
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="logo">
              착시<span>실험실</span>
            </Link>
            <nav className="gnb" aria-label="주요 메뉴">
              {categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}/`}>
                  {c.label.split("·")[0].trim()}
                </Link>
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
            <p>
              모든 도형은 학술 문헌의 표준 착시를 캔버스로 재구현한 것입니다.
              본 사이트의 설명은 교육·재미 목적이며 의학적 진단이 아닙니다.
            </p>
            <p>© {new Date().getFullYear()} 착시실험실 (tomatoeggcat.com)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
