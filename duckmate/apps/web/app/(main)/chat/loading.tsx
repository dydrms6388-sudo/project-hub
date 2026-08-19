// E3 · /chat 스켈레톤 (12_flows §8.4 — 화면별 스켈레톤 우선, 전면 오류 페이지 금지)

import { Skeleton } from "@duckmate/ui";

export default function ChatListLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">대화를 불러오는 중이에요</span>
      <Skeleton className="h-8 w-24" />
      <div className="flex gap-3">
        <Skeleton className="h-32 w-32 rounded-2xl" />
        <Skeleton className="h-32 w-32 rounded-2xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}
