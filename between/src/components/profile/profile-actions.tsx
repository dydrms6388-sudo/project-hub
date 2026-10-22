"use client";

import { Ban, Flag, Heart, HeartOff, Loader2, MoreHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { blockAction, swipeAction, unmatchAction } from "@/app/actions/social";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "./report-dialog";

export function ProfileActions({
  targetId,
  nickname,
  mySwipe,
  matchId,
}: {
  targetId: string;
  nickname: string;
  mySwipe: "like" | "pass" | null;
  matchId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"block" | "unmatch" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const doSwipe = (kind: "like" | "pass") =>
    start(async () => {
      const r = await swipeAction({ targetId, kind });
      if (!r.ok) return void toast.error(r.error);
      if (r.data.matched) toast.success(`${nickname}님과 매칭됐어요! 연락 방법을 확인해 보세요.`);
      else if (kind === "like") toast.success("좋아요를 보냈어요.");
      router.refresh();
    });

  const doBlock = () =>
    start(async () => {
      const r = await blockAction(targetId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("차단했어요. 서로의 프로필이 더 이상 보이지 않아요.");
      router.replace("/explore");
    });

  const doUnmatch = () =>
    start(async () => {
      if (!matchId) return;
      const r = await unmatchAction(matchId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("매칭을 해제했어요.");
      router.refresh();
    });

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 md:left-1/2 md:max-w-xl md:-translate-x-1/2">
        <div className="bg-background/80 flex items-center gap-2 rounded-3xl p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-2xl"
                aria-label="더보기"
                data-testid="profile-menu"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onSelect={() => setReportOpen(true)} data-testid="menu-report">
                <Flag /> 신고하기
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("block")} data-testid="menu-block">
                <Ban /> 차단하기
              </DropdownMenuItem>
              {matchId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirm("unmatch")} data-testid="menu-unmatch">
                    <HeartOff /> 매칭 해제
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {mySwipe === null ? (
            <>
              <Button
                variant="secondary"
                className="h-12 flex-1 rounded-2xl text-base"
                disabled={pending}
                onClick={() => doSwipe("pass")}
                data-testid="detail-pass"
              >
                <X className="size-5" /> 패스
              </Button>
              <Button
                className="bg-brand shadow-accent/30 h-12 flex-[1.4] rounded-2xl text-base font-bold text-white shadow-lg"
                disabled={pending}
                onClick={() => doSwipe("like")}
                data-testid="detail-like"
              >
                {pending ? <Loader2 className="animate-spin" /> : <Heart className="size-5 fill-current" />} 좋아요
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground flex-1 text-center text-sm" data-testid="swipe-state">
              {matchId ? "매칭된 상대예요" : mySwipe === "like" ? "좋아요를 보냈어요" : "패스한 프로필이에요"}
            </p>
          )}
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetId={targetId}
        nickname={nickname}
        onDone={(blocked) => (blocked ? router.replace("/explore") : router.refresh())}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "block" ? `${nickname}님을 차단할까요?` : "매칭을 해제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "block"
                ? "서로의 프로필이 보이지 않고, 매칭과 연락처 공개도 해제돼요. 차단 목록에서 언제든 해제할 수 있어요."
                : "매칭 상대에게만 공개된 연락 방법과 사진이 더 이상 보이지 않아요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => (confirm === "block" ? doBlock() : doUnmatch())}
              data-testid="confirm-action"
            >
              {confirm === "block" ? "차단" : "해제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
