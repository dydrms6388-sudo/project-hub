"use client";

/**
 * 차단 확인 모달 (12_flows §7.4 문구). 확인 → blockProfile(D5 apply_block: 매칭 종료·좋아요 삭제·오늘 추천 삭제까지 트리거).
 * E3/E4 도 그대로 재사용 가능(api.block 만 주입).
 */
import * as React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from "@duckmate/ui";
import { mapFailure } from "./errors";
import { trackEvent } from "./track";
import type { DiscoverApi } from "./types";

export function BlockConfirmDialog({
  open,
  onOpenChange,
  targetId,
  nickname,
  api,
  surface = "profile",
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  nickname: string;
  api: DiscoverApi;
  surface?: "profile" | "chat";
  onBlocked?: (targetId: string) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    setBusy(true);
    const r = await api.block({ targetId });
    setBusy(false);
    if (!r.ok) {
      const ux = mapFailure(r, { surface: "block" });
      if (ux.kind === "redirect") window.location.assign(ux.to);
      else toast({ title: ux.kind === "refresh" ? (ux.message ?? "다시 시도해 주세요") : ux.message, variant: "error" });
      return;
    }
    trackEvent("block_submitted", { surface });
    onOpenChange(false);
    toast({ title: "차단했어요", description: "상대에게 알림이 가지 않아요" });
    onBlocked?.(targetId);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="block-dialog">
        <DialogHeader>
          <DialogTitle>{nickname} 님을 차단할까요?</DialogTitle>
          <DialogDescription className="sr-only">차단 안내</DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-1.5 text-body-sm text-foreground">
          <li>· 서로의 프로필·추천·채팅에 더 이상 보이지 않아요</li>
          <li>· 진행 중인 매칭이 종료돼요</li>
          <li>· 상대에게 알림이 가지 않아요</li>
          <li>· 설정 &gt; 차단 관리에서 해제할 수 있지만 대화는 복구되지 않아요</li>
        </ul>
        <DialogFooter className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
            취소
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirm} loading={busy} data-testid="block-confirm">
            차단하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
