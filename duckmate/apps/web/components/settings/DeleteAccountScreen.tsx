"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { Button, Checkbox, Label, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, useToast } from "@duckmate/ui";
import { requestDelete } from "@/lib/account/actions";
import { DELETE_COPY, RETENTION_ITEMS } from "./copy";
import { track } from "./track";

export function DeleteAccountScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [ack, setAck] = useState(false);
  const [open, setOpen] = useState(false);

  const confirm = () =>
    start(async () => {
      const r = await requestDelete();
      setOpen(false);
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      track("account_delete_requested");
      router.replace(r.data.redirectTo);
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="delete-account-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings/data" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">계정 삭제</h1>
      </header>

      <p className="text-body">{DELETE_COPY.graceNotice}</p>

      <section className="mt-5 rounded-lg border border-border bg-card p-4">
        <h2 className="text-h3">삭제되는 것</h2>
        <p className="text-body-sm mt-1 text-muted-foreground">프로필·사진·취미·퀴즈·매칭·대화·좋아요·알림 설정. 상대에게는 "탈퇴한 사용자"로 보여요.</p>
        <h2 className="text-h3 mt-4">법령에 따라 보관되는 것</h2>
        <ul className="mt-2 space-y-2">
          {RETENTION_ITEMS.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2 text-body-sm">
              <span>{r.label}</span>
              <span className="tnum shrink-0 text-muted-foreground">{r.period}</span>
            </li>
          ))}
        </ul>
        <p className="text-caption mt-3 text-muted-foreground">
          자세한 보존 기준은{" "}
          <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
            개인정보처리방침
          </Link>
          에 있어요. 삭제 전에{" "}
          <Link href="/settings/data" className="text-primary underline underline-offset-4">
            내 데이터 다운로드
          </Link>
          를 받아 둘 수 있어요.
        </p>
      </section>

      <div className="mt-5 flex items-start gap-3">
        <Checkbox id="delete-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} data-testid="delete-ack" />
        <Label htmlFor="delete-ack" className="text-body">
          {DELETE_COPY.ack}
        </Label>
      </div>

      <Button variant="destructive" className="mt-6 w-full" disabled={!ack} onClick={() => setOpen(true)} data-testid="delete-request">
        {DELETE_COPY.confirm}
      </Button>
      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link href="/settings">{DELETE_COPY.cancel}</Link>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{DELETE_COPY.title}</SheetTitle>
            <SheetDescription>{DELETE_COPY.body}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="destructive" className="w-full" onClick={confirm} loading={pending} data-testid="delete-confirm">
              {DELETE_COPY.confirm}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
