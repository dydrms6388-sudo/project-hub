// D8 · /admin/reports — 신고 큐 (F-ADM-01)
// P0 최상단 + sla_due_at 임박순 (A5 §6-③). 필터: 상태 범위 / 우선순위 / 사유 카테고리.

import Link from "next/link";
import { Badge, Button, Select } from "@duckmate/ui";
import type { ReportPriority } from "@duckmate/db";
import { listReports } from "@/lib/admin/reports";
import { formatRemaining } from "@/lib/admin/service";
import { Flash, flashFrom } from "../_components/flash";

export const dynamic = "force-dynamic";

const REASON_CATEGORIES = [
  { value: "", label: "전체 사유" },
  { value: "HARASS", label: "성희롱·괴롭힘" },
  { value: "SCAM", label: "사기" },
  { value: "FAKE", label: "프로필 위조" },
  { value: "SPAM", label: "상업 행위" },
  { value: "SAFETY", label: "미성년·오프라인 위해" },
  { value: "CONTENT", label: "부적절 콘텐츠" },
  { value: "OTHER", label: "기타" },
] as const;

function priorityBadge(priority: ReportPriority | null) {
  if (priority === "P0") return <Badge variant="danger">P0</Badge>;
  if (priority === "P1") return <Badge variant="warning">P1</Badge>;
  if (priority === "P2") return <Badge variant="neutral">P2</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

export default async function ReportsQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const scope = one(sp.scope) === "all" ? "all" : "open";
  const priority = ["P0", "P1", "P2"].includes(one(sp.priority))
    ? (one(sp.priority) as ReportPriority)
    : undefined;
  const reason = one(sp.reason) || undefined;

  const res = await listReports({ scope, priority, reason });
  if (!res.ok) return <p className="text-body text-danger">{res.message}</p>;
  const rows = res.data;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex items-center justify-between">
        <h1 className="text-h1">신고 큐</h1>
        <p className="text-caption text-ink-muted">
          P0 = 접수 1시간 내 착수 · 전체 24시간 내 조치 (A5 §6)
        </p>
      </header>

      {/* 필터 — GET 폼 (서버 렌더) */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          범위
          <Select name="scope" defaultValue={scope}>
            <option value="open">미종결만</option>
            <option value="all">전체</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          우선순위
          <Select name="priority" defaultValue={priority ?? ""}>
            <option value="">전체</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          사유
          <Select name="reason" defaultValue={reason ?? ""}>
            {REASON_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="ghost" size="md">
          필터 적용
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface-raised p-6 text-body text-ink-muted">
          조건에 맞는 신고가 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface-raised">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-ink-muted">
                <th className="px-3 py-2 font-medium">우선순위</th>
                <th className="px-3 py-2 font-medium">사유 코드</th>
                <th className="px-3 py-2 font-medium">대상</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">SLA</th>
                <th className="px-3 py-2 font-medium">접수</th>
                <th className="px-3 py-2 font-medium" aria-label="상세" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overdue = r.sla_due_at !== null && new Date(r.sla_due_at).getTime() < now;
                return (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2">{priorityBadge(r.priority)}</td>
                    <td className="px-3 py-2 font-mono">{r.reason_code}</td>
                    <td className="px-3 py-2">
                      {r.target_id ? (
                        <Link href={`/admin/users/${r.target_id}`} className="underline">
                          {r.target_nickname ?? "(닉네임 없음)"}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">탈퇴/없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "IN_REVIEW" ? "brand" : "neutral"}>{r.status}</Badge>
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${overdue ? "text-danger" : "text-ink"}`}>
                      {formatRemaining(r.sla_due_at)}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">
                      {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/reports/${r.id}`} className="text-accent-text underline">
                        상세·조치
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
