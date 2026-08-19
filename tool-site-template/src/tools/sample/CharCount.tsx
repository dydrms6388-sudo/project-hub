"use client";
import { useMemo, useState } from "react";

const STORAGE_KEY = "tool:char-count:last";

export default function CharCount() {
  const [text, setText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  });

  const stats = useMemo(() => {
    const chars = Array.from(text).length;
    const noSpace = Array.from(text.replace(/\s/g, "")).length;
    const bytes = new TextEncoder().encode(text).length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split(/\r?\n/).length : 0;
    const pages = Math.ceil(chars / 200);
    return { chars, noSpace, bytes, words, lines, pages };
  }, [text]);

  function onChange(v: string) {
    setText(v);
    try { window.localStorage.setItem(STORAGE_KEY, v); } catch {}
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="여기에 텍스트를 붙여넣으세요"
        aria-label="글자수를 셀 텍스트"
        className="min-h-[260px] w-full resize-y rounded-lg border border-line bg-white p-4 text-[15px] leading-relaxed outline-none focus:border-ink"
      />
      <dl className="grid grid-cols-2 gap-2 self-start md:grid-cols-1">
        <Stat label="공백 포함" value={stats.chars} />
        <Stat label="공백 제외" value={stats.noSpace} />
        <Stat label="바이트 (UTF-8)" value={stats.bytes} />
        <Stat label="단어" value={stats.words} />
        <Stat label="줄" value={stats.lines} />
        <Stat label="원고지 (200자)" value={stats.pages} unit="매" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="col-span-2 mt-1 rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-ink md:col-span-1"
        >
          지우기
        </button>
      </dl>
    </div>
  );
}

function Stat({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-xl tabular-nums text-ink">
        {value.toLocaleString("ko-KR")}
        {unit && <span className="ml-1 text-sm text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
