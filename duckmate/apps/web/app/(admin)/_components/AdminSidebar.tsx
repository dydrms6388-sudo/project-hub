import Link from "next/link";
import { Badge } from "@duckmate/ui";
import type { AdminRole } from "@/lib/admin/constants";
import type { QueueSummary } from "@/lib/admin/types";
import { adminSignOut } from "@/lib/admin/actions";
import { shortId } from "@/lib/admin/format";

const NAV: ReadonlyArray<{ href: string; label: string; badge?: (s: QueueSummary) => number; adminOnly?: boolean }> = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 큐", badge: (s) => s.reports_open },
  { href: "/admin/photos", label: "사진 검수", badge: (s) => s.photos_pending + s.photos_held },
  { href: "/admin/users", label: "유저 검색" },
  { href: "/admin/users?tab=sanctions", label: "제재 · 이의신청", badge: (s) => s.appeals_pending },
  { href: "/admin/metrics", label: "지표" },
  { href: "/admin/audit", label: "감사로그", adminOnly: true },
];

export function AdminSidebar({ role, userId, summary }: { role: AdminRole; userId: string; summary: QueueSummary | null }) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-h3">어드민</span>
        <Badge variant={role === "admin" ? "primary" : "secondary"} size="sm">
          {role}
        </Badge>
      </div>
      <nav aria-label="어드민 메뉴" className="flex flex-1 flex-col gap-1 px-3">
        {NAV.filter((n) => !n.adminOnly || role === "admin").map((n) => {
          const count = summary && n.badge ? n.badge(summary) : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex h-11 items-center justify-between rounded-md px-3 text-label text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span>{n.label}</span>
              {count > 0 ? (
                <Badge variant={n.href.includes("reports") ? "danger" : "warning"} size="sm" className="tnum">
                  {count}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-5 py-4 text-caption text-muted-foreground">
        <div>
          로그인: <span className="tnum">{shortId(userId)}</span>…
        </div>
        <form action={adminSignOut} className="mt-2">
          <button type="submit" className="text-label text-primary underline-offset-4 hover:underline">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
