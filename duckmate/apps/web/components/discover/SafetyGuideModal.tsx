"use client";

/**
 * 첫 매칭 안전 가이드 모달 — 05_trust_safety §10.1 문구 그대로, [확인했어요] 필수(닫기 X 없음), 1회.
 * 확인 → api.markSafetySeen() (profiles.safety_modal_seen_at). 실패해도 화면은 진행한다(다음 진입 시 재노출).
 */
import * as React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@duckmate/ui";
import { SAFETY_GUIDE } from "@/components/safety/copy";
import type { DiscoverApi } from "./types";

/** 카피 단일 소스는 `components/safety/copy.ts`(H2: `/safety-guide` 정적 페이지와 공유). 호환 re-export */
export { SAFETY_GUIDE };

export function SafetyGuideModal({ open, api, onDone }: { open: boolean; api: DiscoverApi; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.markSafetySeen();
    } finally {
      setBusy(false);
      onDone();
    }
  };
  return (
    <Dialog open={open}>
      <DialogContent showClose={false} data-testid="safety-modal" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-h2">{SAFETY_GUIDE.title}</DialogTitle>
          <DialogDescription className="sr-only">첫 매칭 안전 안내</DialogDescription>
        </DialogHeader>
        <ol className="mt-3 space-y-3 text-body text-foreground">
          {SAFETY_GUIDE.items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="tnum shrink-0 text-muted-foreground">{i + 1}.</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-body-sm text-muted-foreground">{SAFETY_GUIDE.footer}</p>
        <Button className="mt-6 w-full" onClick={confirm} loading={busy} data-testid="safety-confirm">
          {SAFETY_GUIDE.confirm}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
