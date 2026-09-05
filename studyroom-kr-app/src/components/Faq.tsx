import type { Faq as FaqT } from "@/tools/registry";

export function Faq({ items }: { items: FaqT[] }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      {items.map((f) => (
        <details key={f.q} className="group px-4 py-3">
          <summary className="cursor-pointer list-none text-[15px] font-medium text-ink marker:content-none">
            <span className="mr-2 text-muted group-open:hidden">+</span>
            <span className="mr-2 hidden text-muted group-open:inline">−</span>
            {f.q}
          </summary>
          <p className="mt-2 pl-5 text-[15px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
