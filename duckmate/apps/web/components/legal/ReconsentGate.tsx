"use client";

/**
 * ReconsentGate — 약관 MAJOR 개정 재동의 모달 (08_legal_docs 결정 9 · 15_auth 결정 22).
 *
 * 계약(E2 `(app)/layout.tsx`):
 *   const pending = await getPendingReconsents();            // lib/legal/reconsent (server-only)
 *   <ReconsentGate pending={pending} />                       // [] 이면 아무것도 렌더하지 않음
 * - 닫기 불가(showClose=false) · 필수 문서 전부 체크해야 [동의하고 계속하기] 활성(사전 체크 금지).
 * - 성공 시 router.refresh() → layout 이 다시 판정해 모달이 사라진다.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Label, useToast } from "@duckmate/ui";
import { acceptReconsent } from "@/lib/legal/actions";
import type { PendingReconsent } from "@/lib/legal/types";

export function ReconsentGate({ pending }: { pending: PendingReconsent[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, startTransition] = useTransition();
  if (pending.length === 0) return null;
  const allChecked = pending.every((p) => checked[p.documentKey]);

  const submit = () =>
    startTransition(async () => {
      const r = await acceptReconsent({ documentKeys: pending.map((p) => p.documentKey) });
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      router.refresh();
    });

  return (
    <Dialog open>
      <DialogContent showClose={false} data-testid="reconsent-gate" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>약관이 바뀌었어요</DialogTitle>
          <DialogDescription>계속 이용하려면 개정된 문서를 확인하고 다시 동의해 주세요. 동의하지 않으면 서비스를 이용할 수 없어요.</DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-3">
          {pending.map((p) => {
            const id = `reconsent-${p.documentKey}`;
            return (
              <li key={p.documentKey} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox id={id} checked={Boolean(checked[p.documentKey])} onCheckedChange={(v) => setChecked((s) => ({ ...s, [p.documentKey]: v === true }))} />
                <div className="flex-1">
                  <Label htmlFor={id} required className="text-body">
                    [필수] {p.label} <span className="tnum text-muted-foreground">v{p.version}</span>
                  </Label>
                  <a href={p.href} target="_blank" rel="noreferrer" className="text-body-sm mt-0.5 block text-primary underline underline-offset-4">
                    전문 보기
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        <Button className="mt-4 w-full" onClick={submit} disabled={!allChecked || busy} loading={busy} data-testid="reconsent-confirm">
          동의하고 계속하기
        </Button>
      </DialogContent>
    </Dialog>
  );
}
