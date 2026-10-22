"use client";

import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { unblockAction } from "@/app/actions/social";
import { EmptyState } from "@/components/app/page-header";

type Item = { blocked_id: string; nickname: string | null; created_at: string };

export function BlockedList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!items.length) {
    return (
      <EmptyState
        icon={<UserX className="size-6" />}
        title="차단한 사용자가 없어요"
        description="차단한 사람은 서로의 프로필을 볼 수 없어요."
      />
    );
  }
  return (
    <ul className="bg-card divide-y divide-white/5 rounded-2xl px-4 ring-1 ring-white/5">
      {items.map((b) => (
        <li key={b.blocked_id} className="flex items-center gap-3 py-3" data-testid="blocked-item">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{b.nickname ?? "알 수 없는 사용자"}</p>
            <p className="text-muted-foreground text-xs">
              {new Date(b.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 차단
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unblockAction(b.blocked_id);
                if (!r.ok) return void toast.error(r.error);
                toast.success("차단을 해제했어요.");
                router.refresh();
              })
            }
            className="bg-secondary hover:bg-secondary/70 h-9 rounded-full px-4 text-sm font-semibold"
          >
            차단 해제
          </button>
        </li>
      ))}
    </ul>
  );
}
