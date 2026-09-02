/**
 * (admin) 레이아웃 — 2차 게이트 + noindex + 사이드바.
 *  1차: middleware.ts (classifyRoute → kind:"admin" → app_role() ∉ {admin,moderator} 이면 /404 rewrite)
 *  2차: requireAdminPage() — auth.getUser() + app_role() RPC 를 매 요청 DB 재조회, 실패 시 notFound()
 * 어드민 화면은 데스크톱 우선(min-width 1024). 모바일 대응은 범위 밖.
 */
import type { Metadata } from "next";
import "./admin.css";
import { requireAdminPage } from "@/lib/admin/auth";
import { getQueueSummary } from "@/lib/admin/queries";
import { AdminSidebar } from "./_components/AdminSidebar";
import { OverdueBanner } from "./_components/OverdueBanner";

export const metadata: Metadata = {
  title: "덕메이트 어드민",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdminPage("moderator");
  const summary = await getQueueSummary(ctx.admin);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar role={ctx.role} userId={ctx.user.id} summary={summary} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OverdueBanner summary={summary} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-6 py-6 outline-none">{children}</main>
      </div>
    </div>
  );
}
