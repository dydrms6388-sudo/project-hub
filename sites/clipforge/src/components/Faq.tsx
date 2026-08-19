import type { Faq as FaqItem } from "@/tools/registry";

export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {items.map((f) => (
        <details key={f.q} className="group p-4">
          <summary className="cursor-pointer list-none font-medium text-slate-800 marker:content-none">
            <span className="mr-2 text-blue-600">Q.</span>
            {f.q}
            <span className="float-right text-slate-400 transition group-open:rotate-180">▾</span>
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
