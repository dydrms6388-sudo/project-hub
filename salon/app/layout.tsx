import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "정화 머리방",
  description: "정화 머리방 고객 관리",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "정화 머리방", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
