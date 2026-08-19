"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  label = "복사",
  className = "",
}: {
  value: string | (() => string);
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    const text = typeof value === "function" ? value() : value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API 가 막힌 환경(비 HTTPS 등) 폴백
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] ${className}`}
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
