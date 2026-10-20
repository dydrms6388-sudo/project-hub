"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteContactAction, upsertContactAction } from "@/app/actions/profile";
import { ContactIcon } from "@/components/icons/brand";
import { Input } from "@/components/ui/input";
import { CONTACT_KINDS, type ContactKind } from "@/lib/domain/options";
import type { Contact } from "@/lib/types";
import { validateContact } from "@/lib/validation/contact";
import { NativeSelect } from "./native-select";

const PLACEHOLDER: Record<ContactKind, string> = {
  kakao_openchat: "https://open.kakao.com/o/…",
  line: "LINE ID 또는 https://line.me/ti/p/…",
  instagram: "Instagram 아이디 (예: between_kr)",
  telegram: "Telegram 아이디 (예: between_kr)",
  link: "기타 https:// 링크",
};

export function ContactsManager({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className="divide-y divide-white/5">
      {CONTACT_KINDS.map((k) => (
        <ContactRow key={k.value} kind={k.value} label={k.label} current={contacts.find((c) => c.kind === k.value)} />
      ))}
    </ul>
  );
}

function ContactRow({ kind, label, current }: { kind: ContactKind; label: string; current?: Contact }) {
  const router = useRouter();
  const [value, setValue] = useState(current?.value ?? "");
  const [visibility, setVisibility] = useState<"public" | "matches">(current?.visibility ?? "matches");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== (current?.value ?? "") || visibility !== (current?.visibility ?? "matches");
  const inputId = `contact-${kind}`;

  function save() {
    const local = validateContact(kind, value);
    if (!local.ok) return setError(local.error);
    setError(null);
    start(async () => {
      const r = await upsertContactAction({ kind, value, visibility });
      if (!r.ok) return setError(r.error);
      setValue(r.data.url);
      toast.success(`${label} 연락 방법을 저장했어요.`);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteContactAction(kind);
      if (!r.ok) return void toast.error(r.error);
      setValue("");
      setVisibility("matches");
      toast.success(`${label} 연락 방법을 삭제했어요.`);
      router.refresh();
    });
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid={`contact-${kind}`}>
      <div className="flex items-center gap-3">
        <ContactIcon kind={kind} className="size-8" />
        <label htmlFor={inputId} className="flex-1 text-sm font-semibold">
          {label}
        </label>
        {current && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`${label} 삭제`}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={PLACEHOLDER[kind]}
          inputMode={kind === "kakao_openchat" || kind === "link" ? "url" : "text"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={300}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className="h-11 flex-1 rounded-xl"
        />
        <div className="flex gap-2">
          <div className="w-36">
            <NativeSelect
              aria-label={`${label} 공개 범위`}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "matches")}
            >
              <option value="matches">매칭 상대만</option>
              <option value="public">전체 공개</option>
            </NativeSelect>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={pending || !value.trim() || !dirty}
            className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-bold text-white disabled:opacity-40"
            data-testid={`contact-save-${kind}`}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "저장"}
          </button>
        </div>
      </div>
      {error && (
        <p id={`${inputId}-err`} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
