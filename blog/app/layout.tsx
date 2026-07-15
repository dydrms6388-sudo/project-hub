import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tomatoeggcat.com"),
  title: { default: "블로그 | TomatoEggCat", template: "%s | TomatoEggCat" },
  description: "생활·금융·건강 계산과 관련해 자주 찾는 주제를 정리한 글 모음.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
