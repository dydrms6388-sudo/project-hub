import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md pt-safe" aria-busy="true" aria-label="불러오는 중">
      <div className="flex items-center justify-between py-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
      <div className="mt-5 flex justify-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="size-12 rounded-full" />
      </div>
    </div>
  );
}
