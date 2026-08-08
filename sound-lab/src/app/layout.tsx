import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_URL, categories } from "@/lib/sounds";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — 40가지 소리 현상을 직접 조작하는 인터랙티브 실험실`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "셰퍼드 무한 음계부터 FM 합성까지, 소리 지각과 합성의 원리 40가지를 슬라이더로 조작하며 귀로 확인하는 무료 웹 실험실. 모든 소리는 브라우저에서 실시간 합성됩니다.",
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
                  {c.label}
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
              모든 소리는 Web Audio API로 브라우저에서 실시간 합성되며, 음원
              파일을 사용하지 않습니다. 모든 출력에는 리미터가 적용되어 있지만
              재생 볼륨은 기기 설정을 따르므로 낮은 볼륨에서 시작하세요.
            </p>
            <p>
              본 사이트의 설명은 교육·재미 목적이며 청력 검사나 의학적 진단이
              아닙니다. 지각 결과에는 개인차와 재생 장비에 따른 차이가 있습니다.
            </p>
            <p>© {new Date().getFullYear()} 소리실험실 (tomatoeggcat.com)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
