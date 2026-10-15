import Link from "next/link";
import type { QueueSummary } from "@/lib/admin/types";

/** A5 §6: SLA 초과 P0~P2 미처리 건은 상단 배너(이메일/Slack 알림은 D7 배치, Phase 1 이메일만) */
export function OverdueBanner({ summary }: { summary: QueueSummary | null }) {
  if (!summary) {
    return (
      <div role="status" className="border-b border-border bg-warning-soft px-6 py-2 text-body-sm text-warning">
        큐 요약을 불러오지 못했어요 (0060 지표 함수 미적용 또는 권한 오류). 화면은 계속 사용할 수 있어요.
      </div>
    );
  }
  if (summary.reports_overdue_p0_p2 <= 0) return null;
  return (
    <div role="alert" className="border-b border-border bg-[#FDECEC] px-6 py-2 text-body-sm text-[#B02E2E] dark:bg-[#3A1F1F] dark:text-[#FF9B9B]">
      SLA 초과 신고 <span className="tnum font-semibold">{summary.reports_overdue_p0_p2}</span>건 (P0~P2) — 즉시 판정이 필요해요.{" "}
      <Link href="/admin/reports?overdue=1" className="underline underline-offset-4">
        초과 건 보기
      </Link>
    </div>
  );
}
