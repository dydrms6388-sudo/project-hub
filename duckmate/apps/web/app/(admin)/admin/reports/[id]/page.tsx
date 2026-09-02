import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@duckmate/ui";
import { REPORT_REASONS, SANCTION_LEVELS } from "@duckmate/db";
import { requireAdminPage } from "@/lib/admin/auth";
import { getReportDetail, isUuid } from "@/lib/admin/queries";
import { REPORT_STATUS_LABELS } from "@/lib/admin/constants";
import { fmtDateTime, fmtDuration, shortId } from "@/lib/admin/format";
import { remainingSeconds } from "@/lib/admin/metrics";
import { EvidenceViewer } from "../../../_components/EvidenceViewer";
import { ReportActions } from "../../../_components/ReportActions";

function ProfileCard({ title, p }: { title: string; p: { id: string; nickname: string | null; verify_level: number; status: string; mode: string; gender: string | null; birth_year: number | null; region_code: string | null; created_at: string; hidden_at: string | null; active_sanction_level: number } | null }) {
  if (!p) return <div className="rounded-lg border border-border bg-card p-3 text-body-sm text-muted-foreground">{title}: 없음(탈퇴/시스템)</div>;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-body-sm">
      <div className="text-caption text-muted-foreground">{title}</div>
      <Link href={`/admin/users/${p.id}`} className="text-label text-primary underline-offset-4 hover:underline">
        {p.nickname ?? shortId(p.id)}
      </Link>
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="outline" size="sm">L{p.verify_level}</Badge>
        <Badge variant="outline" size="sm">{p.status}</Badge>
        <Badge variant="outline" size="sm">{p.mode}</Badge>
        {p.active_sanction_level > 0 ? <Badge variant="danger" size="sm">제재 L{p.active_sanction_level}</Badge> : null}
        {p.hidden_at ? <Badge variant="warning" size="sm">비노출</Badge> : null}
      </div>
      <div className="tnum mt-1 text-caption text-muted-foreground">
        {p.gender ?? "?"} · {p.birth_year ?? "?"}년생 · {p.region_code ?? "?"} · 가입 {fmtDateTime(p.created_at)}
      </div>
    </div>
  );
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminPage("moderator");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getReportDetail(ctx.admin, id, { id: ctx.user.id, role: ctx.role });
  if (!d) notFound();
  const r = d.report;
  const meta = REPORT_REASONS.find((x) => x.code === r.reason_code);
  const open = r.status === "queued" || r.status === "in_review" || r.status === "need_info";
  const remain = remainingSeconds(r.due_at);
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/admin/reports" className="text-body-sm text-muted-foreground hover:underline">
          ← 신고 큐
        </Link>
        <h1 className="text-h1">{meta?.label ?? r.reason_code}</h1>
        <Badge variant={r.priority === "P0" ? "danger" : r.priority === "P1" ? "warning" : "info"}>{r.priority}</Badge>
        <Badge variant="outline">{REPORT_STATUS_LABELS[r.status]}</Badge>
        {open ? <span className={`tnum text-body-sm ${remain < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>SLA {fmtDuration(remain)}</span> : null}
        {r.legal_hold ? <Badge variant="outline">legal_hold</Badge> : null}
        {!d.audited ? <Badge variant="warning">audit 기록 실패</Badge> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-card p-4 text-body-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 tnum">
              <div>접수 {fmtDateTime(r.created_at)}</div>
              <div>기한 {fmtDateTime(r.due_at)}</div>
              <div>surface {r.surface}</div>
              <div>탐지 hit {r.detector_hit_count}</div>
              <div>담당 {r.handled_by ? shortId(r.handled_by) : "미배정"}</div>
              <div>종결 {fmtDateTime(r.handled_at)}</div>
              <div className="col-span-2">자동 조치: {Array.isArray(r.auto_actions) && r.auto_actions.length > 0 ? (r.auto_actions as string[]).join(", ") : "없음"}</div>
              {d.match ? (
                <div className="col-span-2">
                  매칭 {shortId(d.match.id)} · {d.match.status} · {d.match.mode} · {fmtDateTime(d.match.matched_at)}
                  {d.match.first_message_at ? ` · 첫 메시지 ${fmtDateTime(d.match.first_message_at)}` : ""}
                </div>
              ) : (
                <div className="col-span-2 text-muted-foreground">관련 매칭 없음</div>
              )}
            </div>
            {r.detail ? <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-body-sm">{r.detail}</pre> : null}
            {r.resolution_note ? <div className="mt-2 text-body-sm">판정 메모: {r.resolution_note}</div> : null}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-h3">증거 스냅샷 {d.evidence ? `(schema ${d.evidence.schema}, ${fmtDateTime(d.evidence.captured_at)})` : ""}</h2>
            {d.evidence ? <EvidenceViewer evidence={d.evidence} photoUrls={d.photoUrls} targetId={r.target_id} reporterId={r.reporter_id} /> : <p className="text-body-sm text-destructive">증거 없음 — 스냅샷 없는 신고는 정책 위반(0009). D5 확인 필요.</p>}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-h3">조치</h2>
            <ReportActions
              reportId={r.id}
              role={ctx.role}
              status={r.status}
              priority={r.priority}
              handledBy={r.handled_by}
              myUserId={ctx.user.id}
              suggestedLevel={meta?.defaultSanction ?? null}
              targetActiveLevel={d.target?.active_sanction_level ?? 0}
            />
            {d.sanctionsFromReport.length > 0 ? (
              <ul className="mt-3 text-body-sm">
                {d.sanctionsFromReport.map((s) => (
                  <li key={s.id} className="tnum">
                    이 신고의 제재: L{s.level} {SANCTION_LEVELS[s.level].label} · {s.reason} · {fmtDateTime(s.starts_at)}~{s.ends_at ? fmtDateTime(s.ends_at) : "영구"}
                    {s.revoked_at ? ` · 해제 ${fmtDateTime(s.revoked_at)}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <aside className="flex flex-col gap-3">
          <ProfileCard title="대상" p={d.target} />
          <ProfileCard title="신고자" p={d.reporter} />
          <section className="rounded-lg border border-border bg-card p-3 text-body-sm">
            <h3 className="text-label">대상의 다른 신고 ({d.targetReports.length})</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {d.targetReports.slice(0, 10).map((x) => (
                <li key={x.id} className="tnum">
                  <Link href={`/admin/reports/${x.id}`} className="text-primary hover:underline">
                    {x.priority} {x.reason_code}
                  </Link>{" "}
                  · {REPORT_STATUS_LABELS[x.status]} · {fmtDateTime(x.created_at)}
                </li>
              ))}
              {d.targetReports.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
            </ul>
          </section>
          <section className="rounded-lg border border-border bg-card p-3 text-body-sm">
            <h3 className="text-label">대상 제재 이력 ({d.targetSanctions.length})</h3>
            <ul className="mt-1 flex flex-col gap-1">
              {d.targetSanctions.slice(0, 10).map((s) => (
                <li key={s.id} className="tnum">
                  L{s.level} · {s.reason.slice(0, 40)} · {fmtDateTime(s.starts_at)}
                  {s.revoked_at ? " · 해제" : ""}
                </li>
              ))}
              {d.targetSanctions.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
            </ul>
          </section>
          {d.evidence ? (
            <section className="rounded-lg border border-border bg-card p-3 text-body-sm">
              <h3 className="text-label">스냅샷 시점 누적</h3>
              <div className="tnum">이전 신고 {d.evidence.prior_reports_count}건 · 이전 제재 {d.evidence.prior_sanctions?.length ?? 0}건</div>
              <div className="tnum text-caption text-muted-foreground">
                관계: 매칭 {d.evidence.relation?.matched_at ? fmtDateTime(d.evidence.relation.matched_at) : "없음"} · 차단 {d.evidence.relation?.blocked ? "있음" : "없음"}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
