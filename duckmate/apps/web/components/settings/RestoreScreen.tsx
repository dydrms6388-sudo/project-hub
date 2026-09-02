"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, useToast } from "@duckmate/ui";
import { signOut } from "@/app/(auth)/actions";
import { cancelDelete } from "@/lib/account/actions";
import { daysUntil, formatDateKo } from "@/components/profile/format";
import { RESTORE_COPY } from "./copy";
import { track } from "@/lib/analytics/track";

export function RestoreScreen({ requestedAt, purgeAt }: { requestedAt: string; purgeAt: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const dday = daysUntil(purgeAt);

  const restore = () =>
    start(async () => {
      const r = await cancelDelete();
      if (!r.ok) {
        if (r.redirectTo) router.replace(r.redirectTo);
        else toast({ title: r.message, variant: "error" });
        return;
      }
      track("account_delete_canceled");
      toast({ title: "다시 만나서 반가워요", variant: "success" });
      router.replace(r.data.redirectTo);
      router.refresh();
    });

  const logout = () =>
    start(async () => {
      const r = await signOut();
      router.replace(r.ok ? r.data.redirectTo : "/");
      router.refresh();
    });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-safe" data-testid="restore-screen">
      <div className="flex-1 pt-16">
        <p className="tnum text-label text-primary">D-{dday}</p>
        <h1 className="text-h1 mt-1">{RESTORE_COPY.title}</h1>
        <p className="text-body mt-3 text-muted-foreground">{RESTORE_COPY.body(formatDateKo(purgeAt))}</p>
        <p className="tnum text-body-sm mt-2 text-muted-foreground">요청일 {formatDateKo(requestedAt)}</p>
      </div>
      <Button className="w-full" onClick={restore} loading={pending} data-testid="restore-cancel-delete">
        {RESTORE_COPY.cancel}
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={logout} disabled={pending} data-testid="restore-logout">
        {RESTORE_COPY.logout}
      </Button>
    </div>
  );
}
