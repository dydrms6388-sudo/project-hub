"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setHiddenAction } from "@/app/actions/profile";
import { Switch } from "@/components/ui/switch";

export function PrivacySettings({ hidden, expiresAt }: { hidden: boolean; expiresAt: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(hidden);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setValue(next);
    start(async () => {
      const r = await setHiddenAction(next);
      if (!r.ok) {
        setValue(!next);
        return void toast.error(r.error);
      }
      toast.success(next ? "프로필을 숨겼어요. 탐색·스와이프에 노출되지 않아요." : "프로필을 다시 공개했어요.");
      router.refresh();
    });
  }

  const expiry = expiresAt
    ? `${new Date(expiresAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}에 자동 숨김`
    : "자동 만료 없음";

  return (
    <div className="divide-y divide-white/5">
      <div className="flex items-center gap-3 pb-3">
        <label htmlFor="hide-profile" className="flex-1">
          <span className="block text-sm font-semibold">프로필 숨김</span>
          <span className="block text-xs text-muted-foreground">켜면 다른 사람에게 내 프로필이 보이지 않아요.</span>
        </label>
        <Switch id="hide-profile" checked={value} disabled={pending} onCheckedChange={toggle} data-testid="hide-profile" />
      </div>
      <Row href="/me/edit#exposure" title="자동 만료" detail={expiry} />
      <Row href="/me/blocked" title="차단 목록" />
      <Row href="/privacy" title="개인정보 처리방침" />
      <Row href="/safety" title="안전 가이드" />
    </div>
  );
}

function Row({ href, title, detail }: { href: string; title: string; detail?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 last:pb-0">
      <span className="flex-1 text-sm font-semibold">{title}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
