"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { CATEGORIES } from "@/content/categories";

export default function UgcForm() {
  const [v, setV] = useState({
    categorySlug: CATEGORIES[0].slug as string,
    title: "",
    body: "",
    optionA: "",
    optionB: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    setErr("");
    try {
      const res = await fetch("/api/ugc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json();
      if (d?.ok) {
        track("ugc_submit", { meta: { category: v.categorySlug } });
        setState("done");
      } else if (d?.error === "moderation") {
        setErr(`게시할 수 없는 내용이 포함됐어요: ${d.reason}. 개인정보·연락처·특정인 정보를 빼고 다시 시도해 주세요.`);
        setState("error");
      } else if (d?.error === "rate_limited") {
        setErr("오늘 작성 한도(3건)를 넘었어요. 내일 다시 시도해 주세요.");
        setState("error");
      } else if (d?.error === "too_short") {
        setErr("제목·내용·선택지를 조금 더 채워주세요.");
        setState("error");
      } else {
        setErr("접수에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setState("error");
      }
    } catch {
      setErr("네트워크 오류예요. 다시 시도해 주세요.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5 text-sm text-ink/80">
        설문이 접수되었어요. 검토를 거쳐 문제가 없으면 공개됩니다. 개인이 특정되는 표현은
        자동으로 가려지거나 반려될 수 있어요.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">카테고리</label>
        <select
          value={v.categorySlug}
          onChange={(e) => set("categorySlug", e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">질문 제목</label>
        <input
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="예: 라면 국물, 밥 말아 먹는 편인가요?"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">설명</label>
        <textarea
          value={v.body}
          onChange={(e) => set("body", e.target.value)}
          rows={4}
          placeholder="어떤 상황인지, 왜 궁금한지 적어주세요. 실명·연락처·특정 회사명은 넣지 마세요."
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">선택지 A</label>
          <input
            value={v.optionA}
            onChange={(e) => set("optionA", e.target.value)}
            placeholder="그렇다"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">선택지 B</label>
          <input
            value={v.optionB}
            onChange={(e) => set("optionB", e.target.value)}
            placeholder="아니다"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
      </div>
      {state === "error" && <p className="text-sm text-red-500">{err}</p>}
      <p className="text-xs leading-relaxed text-ink/50">
        작성 시 커뮤니티 가이드에 동의하는 것으로 봅니다. 실명·전화번호·계좌·주소 등 개인을
        특정할 수 있는 정보는 자동으로 가려지거나 반려됩니다.
      </p>
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {state === "loading" ? "보내는 중…" : "설문 올리기"}
      </button>
    </form>
  );
}
