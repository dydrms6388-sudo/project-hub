"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import type { CommentItem } from "@/lib/comments";

/** 참여 계단 2단계: 한 줄 의견(선택). 스캔 통과분은 즉시 목록에 반영. */
export default function CommentBox({ slug, initial }: { slug: string; initial: CommentItem[] }) {
  const [comments, setComments] = useState<CommentItem[]>(initial);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, body: text }),
      });
      const d = await res.json();
      if (d?.ok) {
        track("view", { slug, meta: { comment: true } });
        if (d.status === "approved") {
          setComments((c) => [
            { id: `tmp-${c.length}`, body: d.body ?? text, created_at: "" },
            ...c,
          ]);
          setNote("의견이 등록됐어요.");
        } else {
          setNote("검토 후 표시됩니다.");
        }
        setText("");
      } else if (d?.error === "moderation") {
        setNote(`등록할 수 없어요: ${d.reason}`);
      } else if (d?.error === "rate_limited") {
        setNote("오늘 작성 한도를 넘었어요.");
      } else {
        setNote("잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setNote("네트워크 오류예요.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="한 줄 의견 (선택) — 실명·연락처는 빼주세요"
          className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          남기기
        </button>
      </form>
      {note && <p className="text-xs text-ink/50">{note}</p>}
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-black/5 bg-white px-4 py-2 text-sm text-ink/80">
              {c.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
