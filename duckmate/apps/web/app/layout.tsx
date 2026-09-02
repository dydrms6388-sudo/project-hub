import type { Metadata, Viewport } from "next";
import { PRETENDARD_CDN_HREF } from "@duckmate/ui";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "덕메이트 — 같은 걸 좋아하는 사람이랑", template: "%s · 덕메이트" },
  description: "취미·덕질 궁합으로 만나는 데이팅. 만 19세 이상.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#5B3BCF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CDN_HREF} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* 스킵 링크 — 각 프레임(AppShell·OnboardingFrame·legal·landing·admin)의 <main id="main"> 으로 (WCAG 2.4.1, E6) */}
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
