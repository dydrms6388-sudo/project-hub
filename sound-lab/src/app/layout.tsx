import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_URL, categories } from "@/lib/sounds";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 40가지 소리 현상을 직접 합성하는 인터랙티브 실험실`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "셰퍼드 무한 음계부터 FM 합성까지, 40가지 소리 현상을 Web Audio로 실시간 합성하고 슬라이더로 조작하는 무료 인터랙티브 소리 실험실. 음원 파일 없이 브라우저가 직접 소리를 만든다.",
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
              소리<span>실험실</span>
            </Link>
            <nav className="gnb" aria-label="주요 메뉴">
              {categories.map((c) => (
                <Link key={c.slug} href={`/category/${c.slug}/`}>
                  {c.name.split("·")[0].trim()}
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
              모든 소리는 Web Audio API로 브라우저에서 실시간 합성되며 음원
              파일을 사용하지 않습니다. 출력에는 리미터가 적용되어 있으나 체감
              음량은 재생 장비에 따라 다르니 볼륨을 낮춰 시작하세요. 청력
              테스트류 체험은 의학적 검사를 대신하지 않습니다.
            </p>
            <p>© {new Date().getFullYear()} 소리실험실 (tomatoeggcat.com)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
