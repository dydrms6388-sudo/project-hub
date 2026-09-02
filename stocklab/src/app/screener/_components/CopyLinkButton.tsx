"use client";
import { useState } from "react";

/** 현재 페이지 URL(필터 상태 포함)을 클립보드로 복사하는 소형 버튼 */
export function CopyLinkButton({ label = "조건 링크 복사" }: { label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("done");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button type="button" onClick={copy} className="btn-ghost h-9 text-xs" aria-live="polite">
      {state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : label}
    </button>
  );
}
