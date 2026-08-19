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
 * 여기서 dynamic import 되므로 페이지 진입 전에는 로드되지 않는다.
 * Whisper 엔진(@huggingface/transformers)은 한 단계 더 안쪽 —
 * src/workers/whisper.worker.ts 안의 await import() — 에서만 받아온다.
 */
export const componentMap: Record<string, ComponentType> = {
  transcribe: dynamic(() => import("./impl/transcribe"), { ssr: false, loading: Loading }),
  live: dynamic(() => import("./impl/live"), { ssr: false, loading: Loading }),
  "video-subtitle": dynamic(() => import("./impl/video-subtitle"), { ssr: false, loading: Loading }),
  lecture: dynamic(() => import("./impl/lecture"), { ssr: false, loading: Loading }),
  meeting: dynamic(() => import("./impl/meeting"), { ssr: false, loading: Loading }),
  "compare-models": dynamic(() => import("./impl/compare-models"), { ssr: false, loading: Loading }),
};
