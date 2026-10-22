import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "bg-background/85 pt-safe sticky top-0 z-30 -mx-4 mb-3 flex items-center justify-between gap-3 px-4 backdrop-blur-xl",
        className,
      )}
    >
      <h1 className="py-3 text-[22px] font-bold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="bg-secondary text-primary flex size-14 items-center justify-center rounded-full">{icon}</div>
      )}
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="text-muted-foreground max-w-xs text-sm">{description}</p>}
      {action}
    </div>
  );
}
