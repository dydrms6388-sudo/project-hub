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
 * ffmpeg.wasm 은 각 impl 안에서 다시 await import 되므로, 이 dynamic import 로도
 * 엔진 바이너리가 초기 번들에 들어가지 않는다.
 */
export const componentMap: Record<string, ComponentType> = {
  "to-vertical": dynamic(() => import("./impl/to-vertical"), { ssr: false, loading: Loading }),
  "burn-subtitle": dynamic(() => import("./impl/burn-subtitle"), { ssr: false, loading: Loading }),
  trim: dynamic(() => import("./impl/trim"), { ssr: false, loading: Loading }),
  compress: dynamic(() => import("./impl/compress"), { ssr: false, loading: Loading }),
  "to-gif": dynamic(() => import("./impl/to-gif"), { ssr: false, loading: Loading }),
  "extract-audio": dynamic(() => import("./impl/extract-audio"), { ssr: false, loading: Loading }),
  "remove-silence": dynamic(() => import("./impl/remove-silence"), { ssr: false, loading: Loading }),
  speed: dynamic(() => import("./impl/speed"), { ssr: false, loading: Loading }),
  merge: dynamic(() => import("./impl/merge"), { ssr: false, loading: Loading }),
  thumbnail: dynamic(() => import("./impl/thumbnail"), { ssr: false, loading: Loading }),
  "subtitle-convert": dynamic(() => import("./impl/subtitle-convert"), { ssr: false, loading: Loading }),
  "audio-convert": dynamic(() => import("./impl/audio-convert"), { ssr: false, loading: Loading }),
};
