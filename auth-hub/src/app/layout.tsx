import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "tomatoeggcat 허브 — 로그인 & 멤버십",
  description: "한 계정으로 모든 서비스. 통합 로그인과 중앙 과금.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', sans-serif",
          background: "#0b0b0f",
          color: "#f5f5f7",
        }}
      >
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
