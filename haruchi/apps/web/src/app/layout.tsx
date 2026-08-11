import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '하루치 — 오늘 쓸 수 있는 돈',
    template: '%s · 하루치',
  },
  description:
    '문자 한 번 붙여넣으면 거래가 자동으로 정리되는 가계부. 남은 예산이 아니라 오늘 쓸 수 있는 돈을 보여줍니다.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1214' },
  ],
};

const NAV = [
  { href: '/', label: '대시보드' },
  { href: '/paste', label: '붙여넣기' },
  { href: '/transactions', label: '거래' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-3xl items-center gap-6 px-5 py-3">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              하루치
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              {NAV.slice(1).map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-ink">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>

        <footer className="mx-auto max-w-3xl px-5 pb-10 text-xs leading-relaxed text-muted">
          <p>
            하루치는 카드사·은행에 접속하지 않습니다. 아이디·비밀번호·인증서를 묻지 않고, 직접
            붙여넣거나 올린 내용만 읽습니다.
          </p>
        </footer>
      </body>
    </html>
  );
}
