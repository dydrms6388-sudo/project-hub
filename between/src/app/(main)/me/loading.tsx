import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-16">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}
