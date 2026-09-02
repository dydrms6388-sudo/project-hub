import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@duckmate/ui";
import { SERVICE_NAME } from "@/config/company";

/**
 * 전역 404 — 미들웨어의 (admin) 권한 없음 rewrite(/404)·존재하지 않는 경로·프로덕션 /dev/* 가 모두 이 화면을 쓴다.
 * 존재 여부를 노출하지 않도록 문구는 한 가지. noindex. E6.
 */
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pt-safe" data-testid="not-found">
      <header className="flex h-14 items-center">
        <Link href="/" className="text-label font-bold text-primary">
          {SERVICE_NAME}
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col justify-center pb-16 text-center outline-none">
        <p className="text-label text-primary">404</p>
        <h1 className="text-h1 mt-2">페이지를 찾을 수 없어요</h1>
        <p className="text-body mt-3 text-muted-foreground">주소가 바뀌었거나 아직 준비 중인 페이지예요.</p>
        <Button asChild className="mt-8">
          <Link href="/">홈으로</Link>
        </Button>
      </main>
    </div>
  );
}
