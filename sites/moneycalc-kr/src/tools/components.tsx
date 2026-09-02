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

const d = (loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, { ssr: false, loading: Loading });

/**
 * slug → 컴포넌트 맵.
 * 새 계산기를 추가하면 registry.ts 와 이 맵 두 곳 모두에 등록해야 한다.
 */
export const componentMap: Record<string, ComponentType> = {
  "net-salary": d(() => import("./impl/net-salary")),
  severance: d(() => import("./impl/severance")),
  "annual-leave": d(() => import("./impl/annual-leave")),
  "hourly-wage": d(() => import("./impl/hourly-wage")),
  "loan-payment": d(() => import("./impl/loan-payment")),
  "jeonse-monthly": d(() => import("./impl/jeonse-monthly")),
  "rent-vs-buy": d(() => import("./impl/rent-vs-buy")),
  "savings-goal": d(() => import("./impl/savings-goal")),
  compound: d(() => import("./impl/compound")),
  "subscription-score": d(() => import("./impl/subscription-score")),
  "gift-tax": d(() => import("./impl/gift-tax")),
  "capital-gains-simple": d(() => import("./impl/capital-gains-simple")),
  "car-tax": d(() => import("./impl/car-tax")),
  "freelancer-tax": d(() => import("./impl/freelancer-tax")),
};
