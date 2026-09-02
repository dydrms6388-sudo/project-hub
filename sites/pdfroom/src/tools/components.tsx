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
 * pdf-lib / pdf.js / qpdf-wasm 같은 대형 의존성은 각 구현 안에서 다시
 * `await import(...)` 로 받으므로, 이 dynamic import 만으로는 아직 내려오지 않는다.
 * 새 도구를 추가하면 registry.ts 와 이 맵 두 곳 모두에 등록해야 한다.
 */
export const componentMap: Record<string, ComponentType> = {
  merge: dynamic(() => import("./impl/merge"), { ssr: false, loading: Loading }),
  split: dynamic(() => import("./impl/split"), { ssr: false, loading: Loading }),
  rotate: dynamic(() => import("./impl/rotate"), { ssr: false, loading: Loading }),
  "delete-pages": dynamic(() => import("./impl/delete-pages"), { ssr: false, loading: Loading }),
  compress: dynamic(() => import("./impl/compress"), { ssr: false, loading: Loading }),
  "img-to-pdf": dynamic(() => import("./impl/img-to-pdf"), { ssr: false, loading: Loading }),
  "pdf-to-img": dynamic(() => import("./impl/pdf-to-img"), { ssr: false, loading: Loading }),
  watermark: dynamic(() => import("./impl/watermark"), { ssr: false, loading: Loading }),
  "page-numbers": dynamic(() => import("./impl/page-numbers"), { ssr: false, loading: Loading }),
  "extract-text": dynamic(() => import("./impl/extract-text"), { ssr: false, loading: Loading }),
  protect: dynamic(() => import("./impl/protect"), { ssr: false, loading: Loading }),
  unlock: dynamic(() => import("./impl/unlock"), { ssr: false, loading: Loading }),
};
