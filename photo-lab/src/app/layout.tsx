import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { siteUrl } from "@/lib/data";

export const metadata: Metadata = {
  title: {
    default: "PhotoLab — 사진 촬영 계산 레퍼런스",
    template: "%s | PhotoLab",
  },
  description:
    "심도·과초점거리·NPF·골든아워·노출 등가까지, 공식과 출처를 밝힌 사진 촬영 계산기 모음. 촬영 현장에서 폰으로 쓰는 정밀 도구.",
  ...(siteUrl() ? { metadataBase: new URL(siteUrl()!) } : {}),
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
          <div className="container">
            <Link href="/" className="logo">
              Photo<b>Lab</b>
            </Link>
            <nav className="top-nav">
              <Link href="/category/depth/">심도·광학</Link>
              <Link href="/category/exposure/">노출</Link>
              <Link href="/category/astro/">천체·자연광</Link>
              <Link href="/category/framing/">화각</Link>
              <Link href="/category/sharpness/">해상도</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <nav>
              <Link href="/about/">소개</Link>
              <Link href="/contact/">문의</Link>
              <Link href="/privacy/">개인정보처리방침</Link>
            </nav>
            <p>
              모든 계산은 브라우저 안에서 수행되며 입력값을 서버로 전송하지
              않습니다. 계산 결과는 명시된 근사 조건 안에서만 유효한 참고치입니다.
            </p>
            <p>© {new Date().getFullYear()} PhotoLab</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
