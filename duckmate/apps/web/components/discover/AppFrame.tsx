"use client";

/**
 * (app) 공용 프레임 — AppShell 하단 탭 4개(홈/채팅/프로필/설정, Next Link) + 제재/모드 배너 + safe-area.
 *  - active 탭·풀스크린(hideTabs) 판정은 pathname: /chat/[id]·/match/[id] 는 탭 숨김
 *  - L1(verifyLevel<2): 탭 대신 상단 "본인인증하고 추천 받기" 고정 배너(12_flows §1)
 *  - 제재 level 1: 경고 모달 1회(acknowledgeSanction) / level 2: 상단 배너(채팅·좋아요 제한, 해제 시각)
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPORT_REASONS, type Enums } from "@duckmate/db";
import { AppShell, Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, SafetyBanner, TooltipProvider, type AppTab } from "@duckmate/ui";
import { acknowledgeSanction } from "@/lib/moderation/actions";

export type SanctionInfo = {
  level: number;
  endsAt: string | null;
  reasonCode: Enums["report_reason"] | null;
  pendingWarning: { id: string; reasonCode: Enums["report_reason"] | null } | null;
};

export type AppFrameProps = {
  verifyLevel: number;
  mode: Enums["profile_mode"];
  chatBadge: number;
  sanction: SanctionInfo | null;
  children: React.ReactNode;
  /** 개발 라우트: pathname 강제 */
  pathnameOverride?: string;
};

export function activeTabOf(pathname: string): AppTab {
  if (pathname.startsWith("/chat") || pathname.startsWith("/match")) return "chat";
  if (pathname.startsWith("/me") || pathname.startsWith("/profile")) return "me";
  if (pathname.startsWith("/settings") || pathname.startsWith("/report") || pathname.startsWith("/appeal")) return "settings";
  return "home";
}

/** 대화방·매칭 화면은 풀스크린 */
export function isFullscreenPath(pathname: string): boolean {
  return /^\/chat\/[^/]+/.test(pathname) || /^\/match\/[^/]+/.test(pathname);
}

function reasonLabel(code: Enums["report_reason"] | null): string {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? "커뮤니티 가이드 위반";
}

function kstTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3_600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

export function AppFrame({ verifyLevel, mode, chatBadge, sanction, children, pathnameOverride }: AppFrameProps) {
  const realPath = usePathname();
  const pathname = pathnameOverride ?? realPath ?? "/home";
  const active = activeTabOf(pathname);
  const hideTabs = verifyLevel < 2 || isFullscreenPath(pathname);

  const [warnOpen, setWarnOpen] = React.useState(Boolean(sanction?.pendingWarning));
  const [ackBusy, setAckBusy] = React.useState(false);
  const ack = async () => {
    if (!sanction?.pendingWarning) return setWarnOpen(false);
    setAckBusy(true);
    await acknowledgeSanction({ sanctionId: sanction.pendingWarning.id });
    setAckBusy(false);
    setWarnOpen(false);
  };

  const header =
    verifyLevel < 2 ? (
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2" data-testid="frame-l1-banner">
        <p className="min-w-0 flex-1 text-body-sm text-foreground">본인인증하고 추천 받기</p>
        <Button asChild size="sm">
          <Link href="/verify">인증하기</Link>
        </Button>
      </div>
    ) : sanction && sanction.level === 2 ? (
      <div className="mx-auto max-w-lg px-4 pt-2" data-testid="frame-sanction-banner">
        <SafetyBanner variant="warn" title="채팅·좋아요가 24시간 제한됐어요">
          사유: {reasonLabel(sanction.reasonCode)}
          {sanction.endsAt ? (
            <>
              {" · "}해제 <span className="tnum">{kstTime(sanction.endsAt)}</span>
            </>
          ) : null}
        </SafetyBanner>
      </div>
    ) : mode === "dating" && !isFullscreenPath(pathname) ? (
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-1.5" data-testid="frame-mode-banner">
        <Badge variant="primary" size="sm">데이팅 모드</Badge>
        <span className="text-caption text-muted-foreground">친구 모드 매칭·대화는 그대로 유지돼요</span>
      </div>
    ) : undefined;

  return (
    <TooltipProvider>
      <AppShell
        active={active}
        badges={{ chat: chatBadge }}
        hideTabs={hideTabs}
        header={header}
        renderLink={(item, p) => (
          <Link href={item.href} className={p.className} aria-current={p["aria-current"]} data-testid={`tab-${item.id}`}>
            {p.children}
          </Link>
        )}
        mainClassName="mx-auto w-full max-w-lg"
      >
        {children}
      </AppShell>
      {sanction?.pendingWarning ? (
        <Dialog open={warnOpen}>
          <DialogContent showClose={false} data-testid="frame-warning-modal">
            <DialogHeader>
              <DialogTitle>경고를 받았어요</DialogTitle>
              <DialogDescription>
                사유: {reasonLabel(sanction.pendingWarning.reasonCode)}. 같은 일이 반복되면 이용이 제한될 수 있어요. 이의신청은 정지 시에만 할 수 있어요.
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-6 w-full" onClick={ack} loading={ackBusy}>
              확인했어요
            </Button>
          </DialogContent>
        </Dialog>
      ) : null}
    </TooltipProvider>
  );
}
