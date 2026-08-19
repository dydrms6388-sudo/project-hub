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
      계산기를 불러오는 중…
    </div>
  );
}

/**
 * slug → 컴포넌트 맵.
 * 계산기는 전부 localStorage/Date 를 쓰는 클라이언트 전용이라 ssr:false 로 마운트한다.
 * 새 계산기를 추가하면 registry.ts 와 이 맵 두 곳 모두에 등록해야 한다.
 */
export const componentMap: Record<string, ComponentType> = {
  bmi: dynamic(() => import("./impl/bmi"), { ssr: false, loading: Loading }),
  "bmr-tdee": dynamic(() => import("./impl/bmr-tdee"), { ssr: false, loading: Loading }),
  protein: dynamic(() => import("./impl/protein"), { ssr: false, loading: Loading }),
  water: dynamic(() => import("./impl/water"), { ssr: false, loading: Loading }),
  caffeine: dynamic(() => import("./impl/caffeine"), { ssr: false, loading: Loading }),
  "sleep-cycle": dynamic(() => import("./impl/sleep-cycle"), { ssr: false, loading: Loading }),
  "body-fat": dynamic(() => import("./impl/body-fat"), { ssr: false, loading: Loading }),
  "korean-age": dynamic(() => import("./impl/korean-age"), { ssr: false, loading: Loading }),
  "calorie-burn": dynamic(() => import("./impl/calorie-burn"), { ssr: false, loading: Loading }),
  "ideal-weight": dynamic(() => import("./impl/ideal-weight"), { ssr: false, loading: Loading }),
  "pregnancy-due": dynamic(() => import("./impl/pregnancy-due"), { ssr: false, loading: Loading }),
  "heart-rate": dynamic(() => import("./impl/heart-rate"), { ssr: false, loading: Loading }),
};
