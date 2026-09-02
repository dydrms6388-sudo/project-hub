// =============================================================================
// D8 · (admin) 레이아웃 — 3층 가드의 2층: requireAdmin (profiles.role='admin')
// 라우트 트리(12_flows §0): /admin, /admin/reports(+[reportId]), /admin/photos,
// /admin/users(+[userId]), /admin/appeals. (/admin/refunds 는 Phase 3 예약 — 미생성)
// noindex: 루트 layout + next.config X-Robots-Tag 에 더해 명시 재선언.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@duckmate/ui";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "어드민",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 큐" },
  { href: "/admin/photos", label: "사진 검수" },
  { href: "/admin/users", label: "유저 관리" },
  { href: "/admin/appeals", label: "이의제기" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface-raised p-4">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-h3">덕메이트</span>
          <Badge variant="brand">admin</Badge>
        </div>
        <nav aria-label="어드민 메뉴" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-body-sm text-ink hover:bg-primary-tint hover:text-primary-tint-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          <p className="text-caption text-ink-muted">{profile.nickname}</p>
          <p className="text-caption text-ink-muted">
            모든 조치는 감사로그에 기록됩니다
          </p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
