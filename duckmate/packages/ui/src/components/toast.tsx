"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Toast — 간단 provider + hook. 앱 루트에 <ToastProvider> 1회, 어디서든 useToast().toast({...}).
 * 톤: 압박·죄책감 카피 금지, 사실만("5개까지 고를 수 있어요").
 */
export type ToastVariant = "default" | "success" | "error";

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** ms, 기본 4000 */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: string;
  open: boolean;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 <ToastProvider> 안에서만 쓸 수 있어요.");
  return ctx;
}

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
  default: Info,
  success: CircleCheck,
  error: CircleX,
};

export interface ToastProviderProps {
  children: React.ReactNode;
  /** 뷰포트 위치 클래스 덮어쓰기 */
  viewportClassName?: string;
}

export function ToastProvider({ children, viewportClassName }: ToastProviderProps) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const toast = React.useCallback((opts: ToastOptions) => {
    const id = `t${++counter.current}`;
    setItems((prev) => [...prev.slice(-2), { ...opts, id, open: true }]);
    return id;
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="down" duration={4000}>
        {children}
        {items.map((t) => {
          const variant = t.variant ?? "default";
          const Icon = ICONS[variant];
          return (
            <ToastPrimitive.Root
              key={t.id}
              open={t.open}
              duration={t.duration}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(t.id);
                  window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 200);
                }
              }}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-md border border-border bg-card p-4 text-card-foreground shadow-lg",
                "data-[state=open]:animate-toast-in data-[state=closed]:animate-fade-out data-[swipe=end]:animate-fade-out",
                variant === "success" && "border-success/40",
                variant === "error" && "border-destructive/40",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  variant === "default" && "text-info",
                  variant === "success" && "text-success",
                  variant === "error" && "text-destructive",
                )}
                aria-hidden="true"
              />
              <div className="flex-1">
                <ToastPrimitive.Title className="text-label text-foreground">{t.title}</ToastPrimitive.Title>
                {t.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-body-sm text-muted-foreground">{t.description}</ToastPrimitive.Description>
                ) : null}
              </div>
              {t.action ? (
                <ToastPrimitive.Action altText={t.action.label} asChild>
                  <button type="button" onClick={t.action.onClick} className="text-button-sm text-primary underline-offset-4 hover:underline">
                    {t.action.label}
                  </button>
                </ToastPrimitive.Action>
              ) : null}
              <ToastPrimitive.Close aria-label="닫기" className="-m-2 inline-flex size-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted">
                <X className="size-4" aria-hidden="true" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          className={cn(
            "fixed bottom-0 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] outline-none pointer-events-none",
            viewportClassName,
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
