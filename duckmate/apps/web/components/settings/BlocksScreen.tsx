"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, UserRoundX } from "lucide-react";
import { Button, EmptyState, HobbyAvatar, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, VerifyBadge, useToast } from "@duckmate/ui";
import { unblockProfile } from "@/lib/moderation/actions";
import { BLOCK_COPY } from "@/lib/moderation/constants";
import type { BlockListItem } from "@/lib/moderation/types";
import { formatDateKo } from "@/components/profile/format";
import { track } from "@/lib/analytics/track";

export function BlocksScreen({ blocks }: { blocks: BlockListItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<BlockListItem | null>(null);

  const unblock = (b: BlockListItem) =>
    start(async () => {
      const r = await unblockProfile({ targetId: b.blockedId });
      setTarget(null);
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      track("unblock_submitted");
      toast({ title: "차단을 해제했어요", variant: "success" });
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="blocks-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">차단 관리</h1>
        <span className="tnum text-body-sm ml-auto text-muted-foreground">{blocks.length}명</span>
      </header>

      {blocks.length === 0 ? (
        <EmptyState icon={UserRoundX} title={BLOCK_COPY.empty} description="차단은 상대에게 알려지지 않고, 서로의 추천·채팅에서 사라져요." className="mt-8" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {blocks.map((b) => (
            <li key={b.blockedId} className="flex items-center gap-3 px-4 py-3" data-testid="block-item">
              <HobbyAvatar seed={b.blockedId} category="fandom" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-body flex items-center gap-1.5 truncate">
                  {b.nickname ?? "탈퇴한 사용자"}
                  <VerifyBadge level={Math.min(3, Math.max(0, b.verifyLevel)) as 0 | 1 | 2 | 3} />
                </p>
                <p className="tnum text-caption text-muted-foreground">차단일 {formatDateKo(b.blockedAt)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTarget(b)} disabled={pending} data-testid="unblock">
                해제
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{target?.nickname ?? "이 사용자"} 님의 차단을 해제할까요?</SheetTitle>
            <SheetDescription>{BLOCK_COPY.unblockConfirm}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button className="w-full" onClick={() => target && unblock(target)} loading={pending} data-testid="unblock-confirm">
              해제하기
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
