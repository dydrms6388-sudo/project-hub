"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { DialogOverlay } from "./dialog";

/**
 * Sheet — Dialog 기반 하단 시트. 상단 radius 20px, 260ms slide-up, safe-area.
 * PRD §0-34: 닫기는 헤더 X + 하단 텍스트 둘 다, 터치 영역 ≥ 44pt → `bottomCloseLabel` 기본 "닫기".
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** 하단 닫기 텍스트 버튼 라벨. null 이면 미표시 */
  bottomCloseLabel?: string | null;
  showClose?: boolean;
  /** 드래그 핸들 표시 */
  handle?: boolean;
}

export const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, bottomCloseLabel = "닫기", showClose = true, handle = true, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-xl border-t border-border bg-card text-card-foreground shadow-xl",
          "data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down focus:outline-none pb-safe",
          className,
        )}
        {...props}
      >
        {handle ? <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-sand-300 dark:bg-input" aria-hidden="true" /> : null}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3">{children}</div>
        {bottomCloseLabel ? (
          <DialogPrimitive.Close className="mx-5 mb-3 inline-flex h-12 items-center justify-center rounded-md text-button text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {bottomCloseLabel}
          </DialogPrimitive.Close>
        ) : null}
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="닫기"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 pr-10 pb-3", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn("text-h3 text-foreground", className)} {...props} />);
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-body-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

export const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-4 flex flex-col gap-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";
