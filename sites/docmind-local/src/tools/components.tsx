"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function Loading() {
  return (
    <div
      className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
      role="status"
      aria-live="polite"
    >
      도구를 불러오는 중…
    </div>
  );
}

/**
 * slug → 컴포넌트 맵.
 * 여기서 dynamic import 되므로 도구 페이지에 들어가기 전에는 로드되지 않는다.
 * 그리고 web-llm / transformers / pdfjs / mammoth 는 이 컴포넌트들 안에서 다시
 * await import 되므로, 사용자가 버튼을 누르기 전까지는 내려받지 않는다.
 */
export const componentMap: Record<string, ComponentType> = {
  summarize: dynamic(() => import("./impl/summarize"), { ssr: false, loading: Loading }),
  ask: dynamic(() => import("./impl/ask"), { ssr: false, loading: Loading }),
  keypoints: dynamic(() => import("./impl/keypoints"), { ssr: false, loading: Loading }),
  "translate-summary": dynamic(() => import("./impl/translate-summary"), {
    ssr: false,
    loading: Loading,
  }),
  compare: dynamic(() => import("./impl/compare"), { ssr: false, loading: Loading }),
};
