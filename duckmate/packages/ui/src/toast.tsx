"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Toast — 간단한 컨텍스트 기반. 루트 레이아웃(클라이언트 경계)에서
 * <ToastProvider> 로 감싸고 useToast().toast("...") 로 호출.
 * 카피 규칙: 시스템 알림 이모지 0개, 죄책감·재촉 문구 금지 (C1 §4).
 */
export type ToastVariant = "default" | "success" | "danger";

export interface ToastOptions {
  variant?: ToastVariant;
  /** 자동 닫힘(ms), 기본 4000 */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 <ToastProvider> 안에서만 사용할 수 있어요.");
  return ctx;
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: "border-l-primary",
  success: "border-l-success",
  danger: "border-l-danger-solid",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);

  const toast = React.useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, variant: options?.variant ?? "default" }]);
    window.setTimeout(
      () => setItems((prev) => prev.filter((t) => t.id !== id)),
      options?.duration ?? 4000,
    );
  }, []);

  const ctx = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-label="알림"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              // bg-ink/text-surface 반전 조합 — 다크모드에서도 자동 반전
              "pointer-events-auto w-full max-w-sm rounded-xl border-l-4 bg-ink px-4 py-3 text-body-sm text-surface shadow-lg",
              VARIANT_CLASS[t.variant],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
