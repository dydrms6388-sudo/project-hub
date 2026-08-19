import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "덕메이트 — 회사 소개",
    template: "%s | 덕메이트",
  },
  description:
    "취미·덕질 궁합 기반 데이팅 서비스 덕메이트를 만드는 팀. 안전과 신뢰를 최우선으로 합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
