"use client";

/**
 * 첫 매칭 안전 가이드 모달 — 05_trust_safety §10.1 문구 그대로, [확인했어요] 필수(닫기 X 없음), 1회.
 * 확인 → api.markSafetySeen() (profiles.safety_modal_seen_at). 실패해도 화면은 진행한다(다음 진입 시 재노출).
 */
import * as React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@duckmate/ui";
import type { DiscoverApi } from "./types";

export const SAFETY_GUIDE = {
  title: "매칭을 축하해요! 대화 전에 3가지만 기억해 주세요.",
  items: [
    "연락처는 매칭 3일 후부터 주고받을 수 있어요. 그 전엔 여기서 충분히 대화해 보세요.",
    "돈 이야기(송금, 투자, 상품권)가 나오면 그건 대화가 아니라 신호예요. 바로 신고해 주세요.",
    "불편하면 언제든 차단할 수 있어요. 상대에게 알림이 가지 않아요.",
  ],
  footer: "신고는 24시간 안에 확인해요.",
  confirm: "확인했어요",
} as const;

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
