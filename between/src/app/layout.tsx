import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BETWEEN — 우리 사이, 가까운 곳에서", template: "%s · BETWEEN" },
  description: "가입 없이 익명으로 시작하는 성인 남성 소개팅·친구찾기. 탐색, 스와이프 매칭, 오픈채팅 연결.",
  applicationName: "BETWEEN",
  appleWebApp: { capable: true, title: "BETWEEN", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  // 개인 프로필 서비스 — 검색엔진 색인 금지 (랜딩 포함 전체)
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#151419",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP nonce 는 동적 렌더링에서만 주입된다 → headers() 로 모든 페이지를 동적 렌더링
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
