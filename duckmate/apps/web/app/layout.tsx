import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "덕메이트 — 같은 걸 좋아하는 사람이랑 만나자",
    template: "%s | 덕메이트",
  },
  description:
    "외모 스와이프가 아니라 취미·덕질 궁합으로 만나는 데이팅. 덕질 카드로 나를 보여주고, 같이 할 수 있는 것부터 시작하세요.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
