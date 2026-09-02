import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_NAME } from "@/config/company";
import { LegalFooterBlock } from "@/components/legal/LegalFooterBlock";
import "@/components/legal/legal.css";

/** /legal/* 공통 프레임 — 비로그인 접근 O · 인덱싱 O (12_flows §1). 상단 홈 링크 + 하단 사업자 블록. */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-safe">
      <header className="flex h-14 items-center justify-between">
        <Link href="/" className="text-label font-bold text-primary">
          {SERVICE_NAME}
        </Link>
        <Link href="/legal" className="text-body-sm text-muted-foreground underline-offset-4 hover:underline">
          법적 고지
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-10 outline-none">
        {children}
      </main>
      <LegalFooterBlock />
    </div>
  );
}
