"use client";

import Link from "next/link";
import { CompatGauge, VerifyBadge, cn } from "@duckmate/ui";
import type { ChatRoom } from "@/lib/chat/types";
import { ArrowLeftIcon, FlagIcon, MoreIcon } from "./icons";
import { PartnerAvatar } from "./PartnerAvatar";
import { reportHref } from "./model";

const ICON_BTN = "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ChatHeader({ room, compat, onOpenMenu, onOpenProfile }: { room: ChatRoom; compat?: number | null; onOpenMenu: () => void; onOpenProfile: () => void }) {
  const nickname = room.partner_nickname ?? "탈퇴한 사용자";
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-1 border-b border-border bg-background/95 px-1 py-1 backdrop-blur">
      <Link href="/chat" aria-label="채팅 목록으로" className={ICON_BTN}>
        <ArrowLeftIcon size={22} />
      </Link>
      <button type="button" onClick={onOpenProfile} className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <PartnerAvatar partnerId={room.partner_id} nickname={room.partner_nickname} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <h1 className={cn("truncate text-h3", !room.partner_nickname && "text-muted-foreground")} data-testid="chat-partner-name">
              {nickname}
            </h1>
            <VerifyBadge level={room.partner_verify_level} />
          </span>
          {typeof compat === "number" ? <CompatGauge value={compat} size="sm" layout="bar" className="w-28" /> : null}
        </span>
      </button>
      <Link href={reportHref(room.partner_id, room.match_id)} aria-label="신고하기" data-testid="chat-report" className={ICON_BTN}>
        <FlagIcon size={20} />
      </Link>
      <button type="button" onClick={onOpenMenu} aria-label="더보기" data-testid="chat-menu" className={ICON_BTN}>
        <MoreIcon size={20} />
      </button>
    </header>
  );
}
