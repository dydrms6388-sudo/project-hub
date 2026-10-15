import type { ReactNode } from "react";
import { categories } from "@/site.config";
import type { ToolMeta } from "@/tools/registry";
import { AdSlot } from "./AdSlot";
import { Faq } from "./Faq";
import { RelatedTools } from "./RelatedTools";

export function ToolShell({ tool, children }: { tool: ToolMeta; children: ReactNode }) {
  const cat = categories[tool.category];
  return (
    <article className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <span
          className="inline-block rounded px-2 py-0.5 text-xs font-medium"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{tool.h1}</h1>
        <p className="mt-2 text-[15px] text-muted">{tool.description}</p>
        {tool.pcRecommended && (
          <p className="mt-2 inline-block rounded bg-paper px-2 py-1 text-xs text-muted">
            PC 브라우저 권장 · 모바일에서는 느릴 수 있습니다
          </p>
        )}
      </header>

      <section aria-label="도구" className="rounded-xl border border-line bg-white p-4 md:p-6">
        {children}
      </section>

      <AdSlot slot="tool-top" />

      <Section title="사용법">
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink">
          {tool.howto.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </Section>

      <Section title="원리와 근거">
        {tool.principle.split("\n\n").map((p, i) => (
          <p key={i} className="mb-3 text-[15px] leading-relaxed text-ink">{p}</p>
        ))}
      </Section>

      <Section title="자주 묻는 질문">
        <Faq items={tool.faq} />
      </Section>

      {tool.related.length > 0 && (
        <Section title="관련 도구">
          <RelatedTools slugs={tool.related} />
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
