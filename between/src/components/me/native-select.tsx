import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** 모바일(iOS)에서 네이티브 휠 피커가 뜨는 select */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "border-input bg-secondary/40 focus-visible:ring-ring h-11 w-full appearance-none rounded-xl border pr-9 pl-3 text-[15px] outline-none focus-visible:ring-2 disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      </div>
    );
  },
);
