import { cn } from "@/lib/utils";

/** iOS 설정 화면 같은 그룹 카드 */
export function Section({
  title,
  description,
  children,
  className,
  id,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mb-5", className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {title && (
        <h2 id={id ? `${id}-title` : undefined} className="text-muted-foreground mb-2 px-1 text-[13px] font-semibold">
          {title}
        </h2>
      )}
      <div className="bg-card rounded-2xl p-4 ring-1 ring-white/5">{children}</div>
      {description && <p className="text-muted-foreground mt-2 px-1 text-xs leading-relaxed">{description}</p>}
    </section>
  );
}
