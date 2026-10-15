"use client";

import * as React from "react";
import { Info, ShieldAlert, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type SafetyBannerVariant = "info" | "warn" | "danger";

export interface SafetyBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** info = 안전 수칙·마스킹 안내 / warn = 오프라인 만남·검수 대기 / danger = 스캠 시그널·제재 */
  variant?: SafetyBannerVariant;
  title?: React.ReactNode;
  children: React.ReactNode;
  icon?: LucideIcon;
  /** 우측 액션(예: [신고하기], [전체 보기]) */
  action?: { label: string; onClick: () => void };
  /** 닫기 버튼 */
  onDismiss?: () => void;
}

const META: Record<SafetyBannerVariant, { cls: string; Icon: LucideIcon; role: "status" | "alert" }> = {
  info: { cls: "bg-info-soft text-info", Icon: Info, role: "status" },
  warn: { cls: "bg-warning-soft text-warning", Icon: TriangleAlert, role: "status" },
  danger: { cls: "bg-[#FDECEC] text-[#B02E2E] dark:bg-[#3A1F1F] dark:text-[#FF9B9B]", Icon: ShieldAlert, role: "alert" },
};

/**
 * SafetyBanner — 안전 안내는 경고가 아니라 동행(10_brand §4.1 원칙 4). 문구는 05_trust_safety §10 확정본을 그대로.
 * 경고 이모지(🚨⚠️) 금지 → lucide 아이콘. 대비: info L22 6.86 / warn L17 5.42 / danger L20 5.61.
 */
export const SafetyBanner = React.forwardRef<HTMLDivElement, SafetyBannerProps>(
  ({ variant = "info", title, children, icon, action, onDismiss, className, ...props }, ref) => {
    const meta = META[variant];
    const Icon = icon ?? meta.Icon;
    return (
      <div ref={ref} role={meta.role} className={cn("flex items-start gap-3 rounded-md px-4 py-3", meta.cls, className)} {...props}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-label">{title}</p> : null}
          <div className={cn("text-body-sm", title && "mt-0.5")}>{children}</div>
          {action ? (
            <button type="button" onClick={action.onClick} className="mt-2 text-button-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
              {action.label}
            </button>
          ) : null}
        </div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="닫기" className="-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  },
);
SafetyBanner.displayName = "SafetyBanner";
