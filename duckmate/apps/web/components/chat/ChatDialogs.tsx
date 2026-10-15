"use client";

/**
 * 대화방 시트·모달: 헤더 메뉴 / 차단 확인(C3 §7.4 BLOCK_COPY) / 나가기 확인 / 상대 프로필 미리보기 / 이미지 확대.
 */
import Link from "next/link";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, VerifyBadge, VERIFY_LABELS } from "@duckmate/ui";
import type { ChatRoom } from "@/lib/chat/types";
import { BLOCK_COPY } from "@/lib/moderation/constants";
import { PartnerAvatar } from "./PartnerAvatar";
import { dateTimeLabel, isEnded, reportHref } from "./model";

const ROW = "flex h-12 w-full items-center rounded-md px-3 text-left text-body text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ChatMenuSheet({ open, onOpenChange, room, onProfile, onBlock, onLeave }: { open: boolean; onOpenChange: (o: boolean) => void; room: ChatRoom; onProfile: () => void; onBlock: () => void; onLeave: () => void }) {
  const ended = isEnded(room.status);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>대화 메뉴</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1" aria-label="대화 메뉴">
          <button type="button" className={ROW} onClick={onProfile}>
            프로필 보기
          </button>
          <Link href={reportHref(room.partner_id, room.match_id)} className={ROW} data-testid="chat-menu-report">
            신고하기
          </Link>
          {room.status !== "blocked" ? (
            <button type="button" className={`${ROW} text-destructive`} onClick={onBlock} data-testid="chat-block">
              차단하기
            </button>
          ) : null}
          {!ended ? (
            <button type="button" className={`${ROW} text-muted-foreground`} onClick={onLeave} data-testid="chat-leave">
              대화 나가기
            </button>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function BlockConfirmDialog({ open, onOpenChange, nickname, loading, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; nickname: string; loading: boolean; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="chat-block-dialog">
        <DialogHeader>
          <DialogTitle>{BLOCK_COPY.title(nickname)}</DialogTitle>
          <DialogDescription asChild>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-body-sm text-muted-foreground">
              {BLOCK_COPY.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {BLOCK_COPY.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} data-testid="chat-block-confirm">
            {BLOCK_COPY.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveConfirmDialog({ open, onOpenChange, loading, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; loading: boolean; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="chat-leave-dialog">
        <DialogHeader>
          <DialogTitle>대화를 나갈까요?</DialogTitle>
          <DialogDescription>나가면 이 대화는 종료되고 다시 시작할 수 없어요. 상대는 남은 대화를 읽을 수 있어요.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} data-testid="chat-leave-confirm">
            나가기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MODE_LABEL = { friend: "친구 모드", dating: "데이팅 모드" } as const;

/** 상대 프로필 미리보기 — get_chat_list 가 주는 공개 필드만(닉네임·인증·연령대·지역·모드·매칭 시각) */
export function PartnerProfileSheet({ open, onOpenChange, room }: { open: boolean; onOpenChange: (o: boolean) => void; room: ChatRoom }) {
  const nickname = room.partner_nickname ?? "탈퇴한 사용자";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="chat-profile-sheet">
        <SheetHeader>
          <SheetTitle>{nickname}</SheetTitle>
          <SheetDescription>{[room.partner_age_band, room.partner_sigungu].filter(Boolean).join(" · ") || "공개된 정보가 없어요"}</SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-4">
          <PartnerAvatar partnerId={room.partner_id} nickname={room.partner_nickname} size="xl" />
          <dl className="flex flex-col gap-1.5 text-body-sm">
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground">인증</dt>
              <dd>{room.partner_verify_level >= 2 ? <VerifyBadge level={room.partner_verify_level} size="md" /> : VERIFY_LABELS[room.partner_verify_level]}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground">모드</dt>
              <dd>{MODE_LABEL[room.mode]}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground">매칭</dt>
              <dd>{dateTimeLabel(room.matched_at)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 text-caption text-muted-foreground">덕질 카드 전체는 매칭 화면에서 볼 수 있어요.</p>
        <div className="mt-3">
          <Button variant="outline" asChild className="w-full">
            <Link href={`/match/${room.match_id}`}>매칭 화면 보기</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ImageZoomSheet({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Sheet open={url !== null} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent className="max-h-[95dvh]" aria-describedby={undefined} data-testid="chat-image-zoom">
        <SheetHeader>
          <SheetTitle>사진</SheetTitle>
        </SheetHeader>
        {url ? <img src={url} alt="대화 사진 원본" className="max-h-[70dvh] w-full rounded-md object-contain" /> : null}
      </SheetContent>
    </Sheet>
  );
}
