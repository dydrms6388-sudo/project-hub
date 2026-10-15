"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Enums } from "@duckmate/db";
import { Button, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, useToast } from "@duckmate/ui";
import { pauseAccount } from "@/lib/account/actions";
import { exportMyData } from "@/app/(app)/settings/data/actions";
import { DATA_COPY, PAUSE_COPY } from "./copy";
import { track } from "@/lib/analytics/track";

export function DataScreen({ status }: { status: Enums["profile_status"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [partial, setPartial] = useState<string[]>([]);

  const download = () =>
    start(async () => {
      const r = await exportMyData();
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.data.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPartial(r.data.data.partial);
      track("data_export_downloaded", { partial: r.data.data.partial.length });
      toast({ title: "다운로드를 시작했어요", variant: "success" });
    });

  const pause = () =>
    start(async () => {
      const r = await pauseAccount();
      setPauseOpen(false);
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      track("account_paused");
      router.replace(r.data.redirectTo);
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="data-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">{DATA_COPY.title}</h1>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-h3">{DATA_COPY.downloadTitle}</h2>
        <p className="text-body-sm mt-1 text-muted-foreground">{DATA_COPY.downloadBody}</p>
        <ul className="text-body-sm mt-3 list-disc space-y-1 pl-5">
          {DATA_COPY.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <Button className="mt-4 w-full" onClick={download} loading={pending} data-testid="data-download">
          <Download aria-hidden="true" /> {DATA_COPY.download}
        </Button>
        {partial.length > 0 ? <p className="text-caption mt-2 text-muted-foreground">일부 항목({partial.join(", ")})은 지금 가져오지 못했어요. 개인정보보호책임자에게 요청하면 10일 안에 보내드려요.</p> : null}
        <p className="text-caption mt-3 text-muted-foreground">{DATA_COPY.rights}</p>
      </section>

      <h2 className="text-label mt-6 px-1 text-muted-foreground">계정</h2>
      <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
        <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted" onClick={() => setPauseOpen(true)} data-testid="account-pause">
          <span className="flex-1">
            <span className="text-body block">휴면하기</span>
            <span className="text-caption block text-muted-foreground">{status === "paused" ? "지금 휴면 상태예요" : "추천·노출·알림 중단, 매칭은 보관"}</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
        </button>
        <Link href="/settings/data/delete" className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted" data-testid="account-delete">
          <span className="flex-1">
            <span className="text-body block text-destructive">계정 삭제</span>
            <span className="text-caption block text-muted-foreground">7일 유예 후 완전 삭제</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
        </Link>
      </div>

      <Sheet open={pauseOpen} onOpenChange={setPauseOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{PAUSE_COPY.title}</SheetTitle>
            <SheetDescription>{PAUSE_COPY.body}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button className="w-full" onClick={pause} loading={pending} data-testid="account-pause-confirm">
              {PAUSE_COPY.confirm}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
