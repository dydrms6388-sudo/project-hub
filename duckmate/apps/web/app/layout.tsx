import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "덕메이트 — 같은 걸 좋아하는 사람이랑",
  description: "취미·덕질 궁합으로 만나는 데이팅. 만 19세 이상.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
