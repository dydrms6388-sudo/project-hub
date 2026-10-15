import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "./ugc";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "판결소 — 당신의 사연, 대중의 판결",
    template: "%s — 판결소",
  },
  description:
    "억울한 일, 애매한 갈등 — 사연을 올리면 대중이 A/B로 판결해 드립니다. 결과는 재미용이며 법률 자문이 아닙니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <a href="/" className="brand">⚖️ 판결소</a>
          <nav className="site-nav">
            <a href="/#submit">사연 올리기</a>
            <a href="/admin">관리</a>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          판결소의 모든 판결은 <strong>재미용</strong>입니다. 법률·의료·금융 자문이 아니며,
          실제 분쟁은 전문가와 상담하세요. · 개인 식별 정보(실명·연락처 등)는 자동 차단됩니다.
        </footer>
      </body>
    </html>
  );
}
