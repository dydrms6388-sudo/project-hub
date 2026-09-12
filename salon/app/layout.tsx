import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "정화 머리방",
  description: "정화 머리방 고객 관리",
  // 고객 개인정보를 다루는 내부용 앱 — 검색엔진 색인 금지
  robots: { index: false, follow: false, nocache: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "정화 머리방", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b4637a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            정화 머리방
          </Link>
          <Link href="/customers/new" className="topbar-action">
            + 신규 고객
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
