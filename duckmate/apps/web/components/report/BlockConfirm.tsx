"use client";

/**
 * BlockConfirm — 차단 확인 모달 (C3 §7.4 BlockConfirmDialog). E2(프로필 ⋮)·E3(채팅 헤더 ⋮)·E4(신고 완료) 공용.
 *
 * 계약:
 *   <BlockConfirm open onOpenChange={…} targetId nickname surface="chat"|"profile" onBlocked={() => router.replace("/chat")} />
 * - 문구는 BLOCK_COPY(lib/moderation/constants) 그대로. [차단하기] = data-testid="block-confirm".
 * - 성공 시 track('block_submitted', {surface}) + toast + onBlocked(). 실패는 toast(redirectTo 있으면 이동).
 * - 액션 호출은 여기서만(blockProfile). 호출부는 열고 닫기만 담당한다.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from "@duckmate/ui";
import { blockProfile } from "@/lib/moderation/actions";
import { BLOCK_COPY } from "@/lib/moderation/constants";
import { track } from "@/components/settings/track";

export type BlockConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  /** 표시용. 없으면 "이 사용자" */
  nickname?: string | null;
  surface: "profile" | "chat";
  onBlocked?: () => void;
};

export function BlockConfirm({ open, onOpenChange, targetId, nickname, surface, onBlocked }: BlockConfirmProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const r = await blockProfile({ targetId });
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      track("block_submitted", { surface });
      toast({ title: "차단했어요", variant: "success" });
      onOpenChange(false);
      onBlocked?.();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="block-dialog">
        <DialogHeader>
          <DialogTitle>{BLOCK_COPY.title(nickname ?? "이 사용자")}</DialogTitle>
          <DialogDescription asChild>
            <ul className="text-body-sm mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {BLOCK_COPY.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending} data-testid="block-cancel">
            {BLOCK_COPY.cancel}
          </Button>
          <Button variant="destructive" onClick={confirm} loading={pending} data-testid="block-confirm">
            {BLOCK_COPY.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
