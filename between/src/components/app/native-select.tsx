import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** iOS/Android 네이티브 선택 휠을 쓰는 select (모바일에서 가장 자연스러움) */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-11 w-full appearance-none rounded-xl border pr-9 pl-3.5 text-[15px] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:opacity-50",
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
