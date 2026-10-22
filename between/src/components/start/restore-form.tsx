"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { emailRestoreAction, restoreAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RestoreForm({ provider }: { provider: "local" | "supabase" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      if (provider === "local") {
        const r = await restoreAction({ code: value });
        if (!r.ok) return void toast.error(r.error);
        toast.success("계정을 복구했어요.");
        router.replace(r.data.redirect);
        router.refresh();
      } else {
        const r = await emailRestoreAction({ email: value });
        if (!r.ok) return void toast.error(r.error);
        setSent(true);
      }
    });
  };

  if (sent) {
    return (
      <p className="bg-card mt-8 rounded-2xl p-4 text-sm ring-1 ring-white/5">
        연결된 이메일이 있다면 로그인 링크를 보냈어요. 메일함을 확인해 주세요.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="restore">{provider === "local" ? "복구 코드" : "연결한 이메일"}</Label>
        <Input
          id="restore"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={provider === "local" ? "off" : "email"}
          inputMode={provider === "local" ? "text" : "email"}
          placeholder={provider === "local" ? "XXXXX-XXXXX-XXXXX-XXXXX" : "you@example.com"}
          className={provider === "local" ? "h-12 rounded-xl font-mono tracking-wider uppercase" : "h-12 rounded-xl"}
          data-testid="restore-input"
        />
      </div>
      <Button
        type="submit"
        disabled={pending || value.length < 5}
        className="bg-brand h-12 w-full rounded-2xl font-bold text-white"
      >
        {pending && <Loader2 className="animate-spin" />}
        {provider === "local" ? "복구하기" : "로그인 링크 받기"}
      </Button>
    </form>
  );
}
