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
 * 무거운 라이브러리(heic2any / exifr / piexifjs / browser-image-compression / pdf-lib)는
 * 각 구현 파일 안에서 사용자가 버튼을 누른 뒤 await import 로 받는다.
 * 새 도구를 추가하면 registry.ts 와 이 맵 두 곳 모두에 등록해야 한다.
 */
export const componentMap: Record<string, ComponentType> = {
  "heic-to-jpg": dynamic(() => import("./impl/heic-to-jpg"), { ssr: false, loading: Loading }),
  "exif-viewer": dynamic(() => import("./impl/exif-viewer"), { ssr: false, loading: Loading }),
  "exif-remove": dynamic(() => import("./impl/exif-remove"), { ssr: false, loading: Loading }),
  "batch-resize": dynamic(() => import("./impl/batch-resize"), { ssr: false, loading: Loading }),
  "image-compress": dynamic(() => import("./impl/image-compress"), { ssr: false, loading: Loading }),
  "webp-convert": dynamic(() => import("./impl/webp-convert"), { ssr: false, loading: Loading }),
  "rename-batch": dynamic(() => import("./impl/rename-batch"), { ssr: false, loading: Loading }),
  "live-photo-still": dynamic(() => import("./impl/live-photo-still"), {
    ssr: false,
    loading: Loading,
  }),
  "png-to-jpg": dynamic(() => import("./impl/png-to-jpg"), { ssr: false, loading: Loading }),
  "image-to-pdf": dynamic(() => import("./impl/image-to-pdf"), { ssr: false, loading: Loading }),
};
