"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "../lib/cn";

export type RadioGroupProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;
export type RadioGroupItemProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;

export const RadioGroup = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-3", className)} {...props} />
  ),
);
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, RadioGroupItemProps>(
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square size-5 rounded-full border border-input bg-card transition-colors duration-(--duration-fast)",
        "data-[state=checked]:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="block size-2.5 rounded-full bg-primary" aria-hidden="true" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  ),
);
RadioGroupItem.displayName = "RadioGroupItem";

/**
 * 카드형 라디오(퀴즈 선택지·신고 사유 등): 전체 행이 터치 영역(≥44px).
 */
export interface RadioCardProps extends RadioGroupItemProps {
  label: React.ReactNode;
  description?: React.ReactNode;
}
export const RadioCard = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, RadioCardProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const autoId = React.useId();
    const itemId = id ?? autoId;
    return (
      <label
        htmlFor={itemId}
        className={cn(
          "flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-4 py-3",
          "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-violet-50 dark:has-[[data-state=checked]]:bg-secondary",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className,
        )}
      >
        <RadioGroupItem ref={ref} id={itemId} className="mt-0.5" {...props} />
        <span className="flex flex-col gap-0.5">
          <span className="text-body text-foreground">{label}</span>
          {description ? <span className="text-body-sm text-muted-foreground">{description}</span> : null}
        </span>
      </label>
    );
  },
);
RadioCard.displayName = "RadioCard";
