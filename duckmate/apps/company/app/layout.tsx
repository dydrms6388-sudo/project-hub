import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "덕메이트 회사 소개",
  description: "같은 걸 좋아하는 사람이랑 만나는 앱, 덕메이트를 만드는 회사.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
