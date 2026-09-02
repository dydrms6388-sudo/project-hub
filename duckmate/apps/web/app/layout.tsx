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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
