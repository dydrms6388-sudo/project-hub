import Link from "next/link";
import { Badge } from "@duckmate/ui";
import { REPORT_REASONS } from "@duckmate/db";
import { requireAdminPage } from "@/lib/admin/auth";
import { listReports, parseReportFilters } from "@/lib/admin/queries";
import { REPORT_PRIORITIES, REPORT_SLA_LABEL, REPORT_STATUS_LABELS } from "@/lib/admin/constants";
import { fmtDateTime, fmtDuration, shortId } from "@/lib/admin/format";
import { remainingSeconds } from "@/lib/admin/metrics";
import { Pagination, queryString } from "../../_components/Pagination";

const PRIO_VARIANT = { P0: "danger", P1: "warning", P2: "info", P3: "muted" } as const;
const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.code, r.label]));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage("moderator");
  const f = parseReportFilters(await searchParams);
  const page = await listReports(ctx.admin, f);
  const now = new Date();
  const hrefFor = (p: number) => `/admin/reports${queryString({ status: f.status, priority: f.priority, reason: f.reason, overdue: f.overdue, sort: f.sort, page: p })}`;
  const sel = "h-10 rounded-md border border-input bg-card px-3 text-body-sm text-foreground";
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-h1">신고 큐</h1>
          <p className="text-body-sm text-muted-foreground">기본 정렬 due_at 오름차순. 행 클릭 → 증거·조치. 우선순위는 상향만 가능.</p>
        </div>
      </header>
      <form method="get" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <select name="status" defaultValue={f.status} className={sel} aria-label="상태">
          <option value="open">미종결 전체</option>
          <option value="all">전체</option>
          {(["queued", "in_review", "need_info", "confirmed", "dismissed"] as const).map((s) => (
            <option key={s} value={s}>
              {REPORT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={f.priority} className={sel} aria-label="우선순위">
          <option value="all">P0~P3</option>
          {REPORT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p} ({REPORT_SLA_LABEL[p]})
            </option>
          ))}
        </select>
        <select name="reason" defaultValue={f.reason} className={sel} aria-label="사유">
          <option value="all">모든 사유</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={f.sort} className={sel} aria-label="정렬">
          <option value="due_at">due_at ↑</option>
          <option value="created_at">접수 최신순</option>
        </select>
        <label className="flex items-center gap-1 text-body-sm">
          <input type="checkbox" name="overdue" value="1" defaultChecked={f.overdue} /> SLA 초과만
        </label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-button-sm text-primary-foreground">
          적용
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-body-sm">
          <thead className="bg-muted text-left text-caption text-muted-foreground">
            <tr>
              <th className="px-3 py-2">우선순위</th>
              <th className="px-3 py-2">SLA 남음</th>
              <th className="px-3 py-2">사유</th>
              <th className="px-3 py-2">신고자 → 대상</th>
              <th className="px-3 py-2">대상 누적</th>
              <th className="px-3 py-2">탐지 hit</th>
              <th className="px-3 py-2">상태 / 담당</th>
              <th className="px-3 py-2">접수</th>
            </tr>
          </thead>
          <tbody>
            {page.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  조건에 맞는 신고가 없어요
                </td>
              </tr>
            ) : (
              page.items.map((r) => {
                const open = r.status === "queued" || r.status === "in_review" || r.status === "need_info";
                const remain = remainingSeconds(r.due_at, now);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <Badge variant={PRIO_VARIANT[r.priority]}>{r.priority}</Badge>
                      {r.legal_hold ? (
                        <Badge variant="outline" size="sm" className="ml-1">
                          legal_hold
                        </Badge>
                      ) : null}
                    </td>
                    <td className={`tnum px-3 py-2 ${open && remain < 0 ? "font-semibold text-destructive" : ""}`}>{open ? fmtDuration(remain) : "종결"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/reports/${r.id}`} className="text-primary underline-offset-4 hover:underline">
                        {REASON_LABEL[r.reason_code] ?? r.reason_code}
                      </Link>
                      <div className="text-caption text-muted-foreground">
                        {r.surface} · {shortId(r.id)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {r.reporter_nickname ?? (r.reporter_id ? shortId(r.reporter_id) : "시스템")} →{" "}
                      {r.target_id ? (
                        <Link href={`/admin/users/${r.target_id}`} className="text-primary underline-offset-4 hover:underline">
                          {r.target_nickname ?? shortId(r.target_id)}
                        </Link>
                      ) : (
                        "(탈퇴)"
                      )}
                    </td>
                    <td className="tnum px-3 py-2">
                      미종결 {r.target_open_reports} / 전체 {r.target_total_reports}
                    </td>
                    <td className="tnum px-3 py-2">
                      {r.detector_hit_count}
                      {r.auto_actions.length > 0 ? <div className="text-caption text-muted-foreground">{r.auto_actions.join(", ")}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      {REPORT_STATUS_LABELS[r.status]}
                      <div className="text-caption text-muted-foreground">{r.handled_by ? shortId(r.handled_by) : "미배정"}</div>
                    </td>
                    <td className="tnum px-3 py-2 text-muted-foreground">{fmtDateTime(r.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page.page} pageSize={page.pageSize} total={page.total} hrefFor={hrefFor} />
    </div>
  );
}
