import Link from "next/link";
import type { UsageResult } from "@/lib/types";
import { fmtKstDateTime } from "./utils";

/** 일일 무료 조회 한도 소진 안내 — 가짜 로그인/결제 유도 없음 */
export function UsageExhausted({ usage, resetHref }: { usage: UsageResult; resetHref: string }) {
  return (
    <div className="card border-warn/40" role="status" aria-live="polite">
      <p className="text-base font-semibold">오늘 무료 조회 {usage.limit}회를 모두 사용했습니다</p>
      <p className="mt-2 text-sm text-muted">
        조회 횟수는 <time dateTime={usage.resetsAt}>{fmtKstDateTime(usage.resetsAt)}</time>(KST)에 초기화됩니다.
        회원 무제한 조회 기능은 준비 중이며, 현재는 비로그인 사용자에게 하루 {usage.limit}회의 스크리닝 실행을 제공합니다.
      </p>
      <p className="mt-2 text-sm text-muted">
        폼의 조건은 그대로 유지되니, 초기화 이후 다시 실행하시면 됩니다. 조건 링크를 복사해 두시면 같은 조건을 바로 다시 열 수 있습니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={resetHref} className="btn-ghost h-9 text-xs">조건 초기화</Link>
        <Link href="/today" className="btn-ghost h-9 text-xs">오늘의 조건 충족 종목 보기</Link>
      </div>
    </div>
  );
}
