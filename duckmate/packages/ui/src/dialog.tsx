"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Dialog — 네이티브 <dialog> 기반 모달.
 * - ESC 닫기·포커스 트랩은 showModal() 네이티브 동작 사용.
 * - 백드롭 클릭 닫기(기본 on) — 파괴적 확인(탈퇴 등)에서는 dismissOnBackdrop=false.
 * - 닫기 버튼은 항상 노출 (다크패턴 금지: 빠져나갈 길을 숨기지 않는다).
 */
export interface DialogProps {
  open: boolean;
  /** ESC·백드롭·닫기 버튼 등 모든 닫힘 경로에서 호출 — 부모가 open 을 false 로 */
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** 백드롭 클릭으로 닫기 허용 (기본 true) */
  dismissOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  dismissOnBackdrop = true,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,28rem)] rounded-2xl bg-transparent p-0",
        "backdrop:bg-brand-900/60",
        "open:animate-reveal-pop motion-reduce:animate-none",
        className,
      )}
    >
      <div className="rounded-2xl border border-line bg-surface-raised p-6 text-ink shadow-xl">
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 id={titleId} className="text-h2">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={cn(
              "-mr-2 -mt-2 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted",
              "hover:bg-primary/10 hover:text-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            )}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
