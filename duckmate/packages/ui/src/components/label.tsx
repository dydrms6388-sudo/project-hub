import * as React from "react";
import { cn } from "../lib/cn";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** 필수 표시(시각 + sr-only 텍스트) */
  required?: boolean;
  /** 우측 보조 텍스트 (예: "2~10자") */
  hint?: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, hint, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("flex items-baseline justify-between gap-2 text-label text-foreground peer-disabled:opacity-50", className)}
      {...props}
    >
      <span>
        {children}
        {required ? (
          <span className="ml-0.5 text-coral-700 dark:text-coral-300" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(필수)</span> : null}
      </span>
      {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
    </label>
  ),
);
Label.displayName = "Label";
