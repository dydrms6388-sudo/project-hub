// =============================================================================
// E1 · (auth) 레이아웃 — /login · /signup 공통 셸 (비로그인 접근 가능)
// 라우트 그룹명은 URL 에 영향 없음: 12_flows §0 의 /login · /signup 그대로다.
// 모바일 우선(max-w-md), 모든 색은 시맨틱 토큰만 사용한다.
// =============================================================================

import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface text-ink" data-testid="auth-shell">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link href="/" className="text-h3 text-primary">
          {BRAND_NAME}
        </Link>
        <span className="text-caption text-ink-muted">만 19세 이상 이용</span>
      </header>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-6">{children}</main>
    </div>
  );
}
