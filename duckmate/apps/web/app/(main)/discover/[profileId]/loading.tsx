import { DuckCardSkeleton } from "../../_components/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">프로필을 불러오는 중이에요</span>
      <DuckCardSkeleton />
      <DuckCardSkeleton />
    </div>
  );
}
