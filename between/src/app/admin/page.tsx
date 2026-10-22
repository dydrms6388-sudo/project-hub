import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModerationButtons } from "@/components/admin/moderation-buttons";
import { getSession } from "@/lib/auth/session";
import { REPORT_REASONS, labelOf } from "@/lib/domain/options";
import { withUser } from "@/lib/server/db";
import { isAdmin, reportQueue } from "@/lib/server/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "운영 — 신고 검토", robots: { index: false, follow: false } };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session) notFound();
  const { status } = await searchParams;
  const filter = status === "all" ? "all" : "open";
  const data = await withUser(session.claims, async (db) => {
    // 운영자 여부는 DB(admin_roles + 비익명 JWT)로 판단 — 아니면 페이지 존재 자체를 숨김
    if (!(await isAdmin(db))) return null;
    return reportQueue(db, filter);
  });
  if (!data) notFound();

  return (
    <main className="pt-safe mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="text-2xl font-bold">신고 검토</h1>
          <p className="text-muted-foreground text-sm">
            미성년자 의심 신고가 가장 먼저 표시돼요. 모든 조치는 감사 기록에 남아요.
          </p>
        </div>
        <nav className="bg-secondary flex gap-1 rounded-xl p-1 text-sm">
          {(["open", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin?status=${s}`}
              className={cn("rounded-lg px-3 py-1.5", filter === s ? "bg-background" : "text-muted-foreground")}
            >
              {s === "open" ? "미처리" : "전체"}
            </Link>
          ))}
        </nav>
      </header>

      {data.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-2xl p-8 text-center">처리할 신고가 없어요.</p>
      ) : (
        <ul className="grid gap-3" data-testid="report-queue">
          {data.map((r) => (
            <li key={r.id} className="bg-card rounded-2xl p-4 ring-1 ring-white/5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold",
                    r.reason === "minor" ? "bg-destructive text-white" : "bg-secondary",
                  )}
                >
                  {labelOf(REPORT_REASONS, r.reason as never)}
                </span>
                <span className="font-semibold">{r.reported_nickname ?? "(삭제된 사용자)"}</span>
                <code className="text-muted-foreground text-xs">{r.reported_id.slice(0, 8)}</code>
                <span className="text-muted-foreground text-xs">
                  계정 상태: {r.reported_status ?? "-"} · 미처리 신고 {r.open_count}건
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </span>
              </div>
              {r.detail && (
                <p className="bg-secondary/60 mt-2 rounded-xl p-3 text-sm whitespace-pre-line">{r.detail}</p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">처리 상태: {r.status}</p>
              {r.status === "open" && <ModerationButtons target={r.reported_id} reportId={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
