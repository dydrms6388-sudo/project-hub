import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "./ugc";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "UGC 데모 — @ggu/ugc-core",
    template: "%s — UGC 데모",
  },
  description: "@ggu/ugc-core 를 Next.js App Router 에 연결한 제출→검수→공개→색인 E2E 데모.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            @ggu/ugc-core <span>데모</span>
          </a>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          제출 → 자동검수(규칙+휴리스틱) → 공개 → 사이트맵 색인 · 인메모리 스토어(기본)
        </footer>
      </body>
    </html>
  );
}
