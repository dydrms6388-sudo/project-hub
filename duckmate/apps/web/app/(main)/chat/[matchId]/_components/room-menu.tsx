"use client";

// =============================================================================
// E3 · 대화방 ⋮ 메뉴 + 차단 확인 (A5 부록 — 신고/차단은 어디서든 2탭 이내)
//   ⋮ 1탭 → [신고][차단] 2탭. 메뉴는 ESC·바깥 클릭으로 닫히고, 닫히면 포커스가
//   ⋮ 버튼으로 돌아온다.
//   차단은 상대에게 통지하지 않는다(A5 부록) — 확인 문구에 그 사실을 명시한다.
// =============================================================================

import * as React from "react";
import { Button, Dialog } from "@duckmate/ui";
import { blockUser } from "@/lib/moderation/actions";

export interface RoomMenuProps {
  targetId: string | null;
  partnerNickname: string;
  onReport: () => void;
  onBlocked: () => void;
}

export function RoomMenu({ targetId, partnerNickname, onReport, onBlocked }: RoomMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function doBlock() {
    if (!targetId) return;
    startTransition(async () => {
      const res = await blockUser({ targetId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setConfirmOpen(false);
      onBlocked();
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="대화방 메뉴 (신고·차단)"
        data-testid="chat-menu-button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-primary/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          data-testid="chat-menu"
          className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="chat-menu-report"
            disabled={!targetId}
            onClick={() => {
              setOpen(false);
              onReport();
            }}
            className="w-full px-4 py-3 text-left text-body text-ink hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            신고하기
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="chat-menu-block"
            disabled={!targetId}
            onClick={() => {
              setOpen(false);
              setError(null);
              setConfirmOpen(true);
            }}
            className="w-full border-t border-line px-4 py-3 text-left text-body text-danger hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            차단하기
          </button>
          {!targetId ? (
            <p className="border-t border-line px-4 py-2 text-caption text-ink-muted">
              이미 대화를 종료한 상대예요.
            </p>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          buttonRef.current?.focus();
        }}
        dismissOnBackdrop={false}
        title="이 상대를 차단할까요?"
      >
        <div className="flex flex-col gap-3" data-testid="chat-block-dialog">
          <p className="text-body">
            차단하면 {partnerNickname}님과 서로 보이지 않게 되고, 이 대화방도 더 이상 열리지
            않아요. 차단 사실은 상대에게 알리지 않아요.
          </p>
          <p className="text-body-sm text-ink-muted">차단은 설정 &gt; 차단 목록에서 해제할 수 있어요.</p>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              size="lg"
              loading={pending}
              onClick={doBlock}
              data-testid="chat-block-confirm"
            >
              차단하기
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                buttonRef.current?.focus();
              }}
            >
              취소
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
