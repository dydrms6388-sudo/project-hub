"use client";

import { ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ContactIcon } from "@/components/icons/brand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CONTACT_KINDS, labelOf } from "@/lib/domain/options";
import type { Contact } from "@/lib/types";
import { safeHref } from "@/lib/validation/contact";

/** 외부 메신저 연결. 서버에서 정규화된 https URL 만 저장되며, 렌더 직전 한 번 더 검사한다. */
export function ContactLinks({ contacts, nickname }: { contacts: Contact[]; nickname: string }) {
  const [pending, setPending] = useState<Contact | null>(null);
  const href = pending ? safeHref(pending.value) : null;

  return (
    <>
      <ul className="grid gap-2">
        {contacts.map((c) => {
          if (!safeHref(c.value)) return null;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPending(c)}
                className="flex w-full items-center gap-3 rounded-xl bg-secondary/70 p-2.5 text-left transition-colors hover:bg-secondary"
                data-testid={`contact-${c.kind}`}
              >
                <ContactIcon kind={c.kind} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{labelOf(CONTACT_KINDS, c.kind)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{displayOf(c)}</span>
                </span>
                <ExternalLink className="size-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>외부 앱으로 이동해요</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {nickname}님의 {pending && labelOf(CONTACT_KINDS, pending.kind)}(으)로 이동합니다. BETWEEN 밖의 대화는
                  운영팀이 확인할 수 없어요.
                </p>
                <p className="flex gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-foreground/90">
                  <ShieldAlert className="size-4 shrink-0 text-destructive" />
                  송금·선입금·개인정보(주민번호, 계좌, 인증번호) 요구는 사기일 가능성이 높아요.
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">{href}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              data-testid="contact-open"
              onClick={() => {
                if (href) window.open(href, "_blank", "noopener,noreferrer");
                setPending(null);
              }}
            >
              열기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function displayOf(c: Contact): string {
  try {
    const u = new URL(c.value);
    if (c.kind === "instagram" || c.kind === "telegram") return "@" + u.pathname.replace(/^\/|\/$/g, "");
    if (c.kind === "line") return u.pathname.replace(/^\/ti\/p\/~?/, "");
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return "";
  }
}
