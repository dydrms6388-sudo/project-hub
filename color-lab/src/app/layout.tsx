import type { Metadata } from "next";
import Link from "next/link";
import { siteUrl } from "@/lib/data";
import "./globals.css";

const base = siteUrl();

export const metadata: Metadata = {
  ...(base ? { metadataBase: new URL(base) } : {}),
  title: {
    default: "색채 실험실 — 만지면서 배우는 색",
    template: "%s | 색채 실험실",
  },
  description:
    "색상 정보와 배색 도구를 한곳에. WCAG 대비 계산, 색공간 변환, 색각 이상 시뮬레이션까지 슬라이더로 만지면서 확인하는 색채 실험실.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="logo">
              🎨 색채 실험실
            </Link>
            <nav aria-label="주 메뉴">
              <Link href="/#colors">색상</Link>
              <Link href="/#tools">도구</Link>
              <Link href="/#theory">이론</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="inner">
            <nav aria-label="정책">
              <Link href="/about/">소개</Link>
              <Link href="/contact/">문의</Link>
              <Link href="/privacy/">개인정보처리방침</Link>
            </nav>
            <div>
              색채 실험실 — 모든 계산은 브라우저 안에서 이루어지며, 입력한
              색상값과 이미지는 서버로 전송되지 않습니다.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
