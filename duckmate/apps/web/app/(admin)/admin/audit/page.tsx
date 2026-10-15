import { requireAdminPage } from "@/lib/admin/auth";
import { listAudit, parseAuditFilters } from "@/lib/admin/queries";
import { fmtDateTime, shortId } from "@/lib/admin/format";
import { Pagination, queryString } from "../../_components/Pagination";

function Json({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  const s = JSON.stringify(v);
  return <code className="block max-w-xs truncate text-caption" title={s}>{s}</code>;
}

/** audit_logs 는 RLS 도 admin 만 읽는다(0010). moderator 는 404. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage("admin");
  const f = parseAuditFilters(await searchParams);
  const page = await listAudit(ctx.admin, f);
  const hrefFor = (p: number) => `/admin/audit${queryString({ actor: f.actor, action: f.action, target: f.target, page: p })}`;
  const inp = "h-10 rounded-md border border-input bg-card px-3 text-body-sm";
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-h1">감사로그</h1>
        <p className="text-body-sm text-muted-foreground">모든 어드민 판정·증거 열람·시스템 자동 조치. 2년 보관(D7 purge).</p>
      </header>
      <form method="get" className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
        <input name="actor" defaultValue={f.actor} placeholder="actor_id(uuid) 또는 role" className={inp} />
        <input name="action" defaultValue={f.action} placeholder="action (부분)" className={inp} />
        <input name="target" defaultValue={f.target} placeholder="target_id" className={`${inp} w-80`} />
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-button-sm text-primary-foreground">
          필터
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-body-sm">
          <thead className="bg-muted text-left text-caption text-muted-foreground">
            <tr>
              <th className="px-3 py-2">시각</th><th className="px-3 py-2">actor</th><th className="px-3 py-2">action</th><th className="px-3 py-2">target</th><th className="px-3 py-2">before</th><th className="px-3 py-2">after</th><th className="px-3 py-2">meta</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="tnum whitespace-nowrap px-3 py-2">{fmtDateTime(a.created_at)}</td>
                <td className="px-3 py-2">
                  {a.actor_role ?? "?"}
                  <div className="tnum text-caption text-muted-foreground">{a.actor_id ? shortId(a.actor_id) : "system"}</div>
                </td>
                <td className="px-3 py-2">{a.action}</td>
                <td className="px-3 py-2">
                  {a.target_type}
                  <div className="tnum text-caption text-muted-foreground">{a.target_id ?? ""}</div>
                </td>
                <td className="px-3 py-2"><Json v={a.before} /></td>
                <td className="px-3 py-2"><Json v={a.after} /></td>
                <td className="px-3 py-2"><Json v={a.meta} /></td>
              </tr>
            ))}
            {page.items.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">기록 없음</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination page={page.page} pageSize={page.pageSize} total={page.total} hrefFor={hrefFor} />
    </div>
  );
}
