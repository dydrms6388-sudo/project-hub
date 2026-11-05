import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { getQueueSummary } from "@/lib/admin/queries";
import { fmtDateTime, fmtNum } from "@/lib/admin/format";
import { Stat } from "../_components/charts";

export default async function AdminHome() {
  const ctx = await requireAdminPage("moderator");
  const s = await getQueueSummary(ctx.admin);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1">대시보드</h1>
        <p className="text-body-sm text-muted-foreground">
          {s ? `기준 ${fmtDateTime(s.as_of)} (KST)` : "큐 요약 없음"} · 역할 {ctx.role}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="미종결 신고" value={fmtNum(s?.reports_open)} hint={`대기 ${fmtNum(s?.reports_queued)} · P0 ${fmtNum(s?.reports_p0_open)}`} tone={s && s.reports_p0_open > 0 ? "danger" : undefined} />
        <Stat label="SLA 초과 (P0~P2)" value={fmtNum(s?.reports_overdue_p0_p2)} hint={`전체 초과 ${fmtNum(s?.reports_overdue)}`} tone={s && s.reports_overdue_p0_p2 > 0 ? "danger" : "success"} />
        <Stat label="사진 검수 대기" value={fmtNum(s ? s.photos_pending + s.photos_held : null)} hint={s?.photos_oldest_pending_at ? `가장 오래된 건 ${fmtDateTime(s.photos_oldest_pending_at)}` : "대기 없음"} tone={s?.photos_oldest_pending_at && Date.now() - new Date(s.photos_oldest_pending_at).getTime() > 24 * 3600e3 ? "warning" : undefined} />
        <Stat label="이의신청 대기" value={fmtNum(s?.appeals_pending)} hint={`문의 open ${fmtNum(s?.inquiries_open)}`} />
      </div>
      <nav aria-label="바로가기" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          ["/admin/reports", "신고 큐 (due_at 순)"],
          ["/admin/reports?overdue=1", "SLA 초과 건만"],
          ["/admin/photos", "사진 검수 (A 승인 / R 반려)"],
          ["/admin/users", "유저 검색"],
          ["/admin/metrics", "지표 (7/30일)"],
          ["/admin/audit", "감사로그 (admin)"],
        ].map(([href, label]) => (
          <Link key={href} href={href!} className="rounded-lg border border-border bg-card p-4 text-label hover:bg-muted">
            {label}
          </Link>
        ))}
      </nav>
      <section className="rounded-lg border border-border bg-card p-4 text-body-sm text-muted-foreground">
        <h2 className="text-h3 text-foreground">운영 원칙</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>모든 판정·증거 열람은 audit_logs 에 남아요. 사유는 구체적으로.</li>
          <li>제재 level ≥ 3(정지)은 사람만 발급. moderator 는 level 3 까지, 4~6·이의신청·삭제·강제 로그아웃은 admin.</li>
          <li>SLA: P0 1h / P1 6h / P2 24h / P3 72h. 초과 P0~P2 는 상단 배너.</li>
          <li>사진은 자동 승인·반려 없음. 얼굴 검사 값은 참고용. 승인/반려 시 verify_level 은 트리거가 재계산.</li>
        </ul>
      </section>
    </div>
  );
}
