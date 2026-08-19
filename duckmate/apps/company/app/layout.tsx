import type { Metadata } from "next";
import { BRAND_NAME } from "@duckmate/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/components/json-ld";
import { missingCompanyFields } from "@/config/company";
import { COMPANY_URL } from "@/config/site";
import "./globals.css";

/**
 * TodoBuildWarning (C4 D-2) — 사업자 정보 미입력 필드를 빌드 로그에 경고로 남긴다.
 * **빌드는 차단하지 않는다** (스펙 §0-4 / PRD 플레이스홀더 방침).
 */
const missing = missingCompanyFields();
if (missing.length > 0) {
  console.warn(
    `⚠️  [company] 사업자 정보 미입력 ${missing.length}건 — 화면에 [TODO_사업자정보] 가 노출됩니다.\n` +
      `    apps/company/config/company.ts: ${missing.join(", ")}`,
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY_URL),
  title: {
    // 홈만 단독 title (C4 §5.2)
    default: `${BRAND_NAME} — 같은 걸 좋아하는 사람이랑 만나는 앱`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "외모 스와이프가 아니라 취향으로 만나는 데이팅·취미친구 앱. 본인인증 필수, 신고 24시간 처리.",
  applicationName: BRAND_NAME,
  // 회사 사이트는 전 페이지 인덱싱 허용 (C4 D-5 / §5.1) — noindex 금지
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "ko_KR",
    url: COMPANY_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
      </body>
    </html>
  );
}
