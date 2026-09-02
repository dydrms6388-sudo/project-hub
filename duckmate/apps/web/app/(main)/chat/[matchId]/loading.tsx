// E3 · 대화방 스켈레톤 (12_flows §8.4)

import { Skeleton } from "@duckmate/ui";

export default function ChatRoomLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">대화를 불러오는 중이에요</span>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="flex flex-col gap-3 py-4">
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
        <Skeleton className="h-10 w-3/5 rounded-2xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
