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
 * lz-string / canvas-confetti / html-to-image 는 각 컴포넌트 안에서 await import 로 더 늦게 로드된다.
 */
export const componentMap: Record<string, ComponentType> = {
  ladder: dynamic(() => import("./impl/ladder"), { ssr: false, loading: Loading }),
  roulette: dynamic(() => import("./impl/roulette"), { ssr: false, loading: Loading }),
  "team-split": dynamic(() => import("./impl/team-split"), { ssr: false, loading: Loading }),
  order: dynamic(() => import("./impl/order"), { ssr: false, loading: Loading }),
  dice: dynamic(() => import("./impl/dice"), { ssr: false, loading: Loading }),
  "number-pick": dynamic(() => import("./impl/number-pick"), { ssr: false, loading: Loading }),
  seat: dynamic(() => import("./impl/seat"), { ssr: false, loading: Loading }),
  "yes-no": dynamic(() => import("./impl/yes-no"), { ssr: false, loading: Loading }),
  penalty: dynamic(() => import("./impl/penalty"), { ssr: false, loading: Loading }),
  "name-draw": dynamic(() => import("./impl/name-draw"), { ssr: false, loading: Loading }),
};
