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
 * 무거운 라이브러리(xlsx, diff)는 각 컴포넌트 안에서 다시 await import 되므로
 * 이 맵을 통해 페이지에 진입해도 실제 동작 전에는 내려받지 않는다.
 */
export const componentMap: Record<string, ComponentType> = {
  "markdown-remove": dynamic(() => import("./impl/markdown-remove"), { ssr: false, loading: Loading }),
  "table-to-excel": dynamic(() => import("./impl/table-to-excel"), { ssr: false, loading: Loading }),
  "kakao-format": dynamic(() => import("./impl/kakao-format"), { ssr: false, loading: Loading }),
  "notion-paste": dynamic(() => import("./impl/notion-paste"), { ssr: false, loading: Loading }),
  "code-extract": dynamic(() => import("./impl/code-extract"), { ssr: false, loading: Loading }),
  "emoji-remove": dynamic(() => import("./impl/emoji-remove"), { ssr: false, loading: Loading }),
  "text-diff": dynamic(() => import("./impl/text-diff"), { ssr: false, loading: Loading }),
  "word-count": dynamic(() => import("./impl/word-count"), { ssr: false, loading: Loading }),
  "json-pretty": dynamic(() => import("./impl/json-pretty"), { ssr: false, loading: Loading }),
  "prompt-cleaner": dynamic(() => import("./impl/prompt-cleaner"), { ssr: false, loading: Loading }),
};
