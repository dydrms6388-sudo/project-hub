import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, UGC_DISCLAIMER } from "@/site.config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "우리집만 이래? 익명 투표로 1탭에 확인하는 통계 커뮤니티. 로그인 없이 한 표 던지면 내가 다수인지 소수파인지 바로 나옵니다.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "익명 투표로 1탭에 확인하는 '우리집만 이래?' 통계 커뮤니티",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION }
      : {},
  },
};

const LEGAL = [
  ["소개", "/about"],
  ["내 설문 만들기", "/submit"],
  ["문의", "/contact"],
  ["개인정보", "/privacy"],
  ["이용약관", "/terms"],
  ["면책", "/disclaimer"],
  ["커뮤니티 가이드", "/community-guidelines"],
  ["신고", "/report"],
  ["삭제 요청", "/takedown"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-black/5 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-readable items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-ink">
              정상<span className="text-brand">인가요</span>
            </Link>
            <Link href="/#categories" className="text-sm text-ink/60 hover:text-ink">
              카테고리
            </Link>
          </div>
        </header>

        <main className="mx-auto min-h-[70vh] max-w-readable px-4 py-6">{children}</main>

        <footer className="mt-10 border-t border-black/5 bg-white">
          <div className="mx-auto max-w-readable px-4 py-8 text-sm">
            <p className="font-semibold text-ink">{SITE_NAME}</p>
            <p className="mt-1 text-ink/50">{SITE_TAGLINE}</p>
            <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-ink/60">
              {LEGAL.map(([label, href]) => (
                <Link key={href} href={href} className="hover:text-ink">
                  {label}
                </Link>
              ))}
            </nav>
            <p className="mt-6 text-xs leading-relaxed text-ink/40">{UGC_DISCLAIMER}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
