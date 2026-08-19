// =============================================================================
// E2 · 로딩 스켈레톤 (12_flows §8.4 "화면별 스켈레톤 → 실패 시 인라인 재시도")
// 컨테이너에 aria-busy·role="status" 를 붙이고 개별 블록은 aria-hidden (Skeleton 내장).
// =============================================================================

import { Skeleton } from "@duckmate/ui";

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** 덕질카드 1장 (탐색 큐·상세 상단) */
export function DuckCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Frame label="홈을 불러오는 중이에요">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </Frame>
  );
}

export function DiscoverSkeleton() {
  return (
    <Frame label="오늘의 추천을 불러오는 중이에요">
      <Skeleton className="h-5 w-32" />
      <DuckCardSkeleton />
      <div className="flex items-center justify-center gap-3">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-13 w-32 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>
    </Frame>
  );
}

export function LikesSkeleton() {
  return (
    <Frame label="받은 관심을 불러오는 중이에요">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    </Frame>
  );
}
