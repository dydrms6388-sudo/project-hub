import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_URL, categories } from "@/lib/patterns";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 수식으로 그리는 40가지 인터랙티브 패턴`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "만델브로 집합부터 펜로즈 타일링까지, 수학 패턴 40가지를 슬라이더로 조작하고 PNG·SVG로 내려받는 무료 생성기. 파라미터는 URL로 공유되어 그대로 재현됩니다.",
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
              패턴<span>연구소</span>
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
              모든 패턴은 수식으로 브라우저에서 실시간 계산됩니다. 이미지 파일을
              쓰지 않으며, 생성된 그림은 자유롭게 내려받아 사용할 수 있습니다.
            </p>
            <p>© {new Date().getFullYear()} 패턴연구소</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
