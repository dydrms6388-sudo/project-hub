import { formatKoreanDate } from "@/lib/kst";
import type { UsageResult } from "@/lib/types";
import { CopyLinkButton } from "./CopyLinkButton";

/** 결과 상단 요약 줄: N개 조건 충족 · 데이터 기준일 · 남은 조회 */
export function ResultSummary({ count, asOf, usage, limit }: { count: number; asOf: string | null; usage: UsageResult; limit: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted" role="status">
        <strong className="text-fg tnum">{count.toLocaleString("ko-KR")}개</strong> 조건 충족
        {count >= limit && <span> (상위 {limit}개 표시)</span>}
        <span aria-hidden> · </span>
        데이터 기준일 {asOf ? <time dateTime={asOf}>{formatKoreanDate(asOf)}</time> : "–"}
        <span aria-hidden> · </span>
        남은 조회 <span className="tnum">{usage.remaining}</span>회
      </p>
      <CopyLinkButton />
    </div>
  );
}
