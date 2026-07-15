"use client";

import { useState } from "react";
import { track } from "@/lib/track";

/** 결과 화면에서 노출. 로그인 강요 없이 이메일만 받는다(R1). */
export default function NotifyOptin({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(false);
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, slug }),
    });
    const d = await res.json();
    if (d?.ok) {
      setDone(true);
      track("notify_optin", { slug });
    } else setErr(true);
  };

  if (done) {
    return (
      <p className="rounded-xl bg-brand/5 px-4 py-3 text-center text-sm text-ink/70">
        알림 신청 완료 · 결과가 크게 바뀌면 알려드릴게요.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-sm text-ink/50 underline underline-offset-2 hover:text-ink/70"
      >
        이 설문 결과가 바뀌면 알림 받기
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일 (알림용, 이것만 받아요)"
        className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
        {err ? "다시" : "신청"}
      </button>
    </form>
  );
}
