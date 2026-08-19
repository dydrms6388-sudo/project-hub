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
 * 무거운 라이브러리는 여기서 dynamic import 되므로 페이지 진입 전에는 로드되지 않는다.
 * 새 도구를 추가하면 registry.ts 와 이 맵 두 곳 모두에 등록해야 한다.
 */
export const componentMap: Record<string, ComponentType> = {
  sample: dynamic(() => import("./impl/sample"), { ssr: false, loading: Loading }),
};
