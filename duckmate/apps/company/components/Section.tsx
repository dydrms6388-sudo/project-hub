import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@duckmate/ui";
import { Container } from "./Container";

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  id?: string;
  /** 작은 상단 라벨 */
  eyebrow?: string;
  title?: ReactNode;
  lead?: ReactNode;
  /** 제목을 시각적으로 숨김(aria-labelledby 는 유지) */
  hideTitle?: boolean;
  children: ReactNode;
}

/** 페이지 섹션: 제목 h2 + aria-labelledby, 상하 여백 통일. */
export function Section({ id, eyebrow, title, lead, hideTitle, className, children, ...props }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn("py-12 md:py-16", className)} {...props}>
      <Container>
        {title ? (
          <header className={cn("mb-8 max-w-2xl", hideTitle && "sr-only")}>
            {eyebrow ? <p className="text-label text-primary">{eyebrow}</p> : null}
            <h2 id={headingId} className="text-h1 mt-1">
              {title}
            </h2>
            {lead ? <p className="text-body mt-3 text-muted-foreground">{lead}</p> : null}
          </header>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
