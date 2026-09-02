import { JsonLd } from "@/components/JsonLd";

export interface FaqItem { q: string; a: string }

/** FAQ 목록 + FAQPage JSON-LD. 본문 안에서 `.prose-kr` 컨테이너와 함께 사용 */
export function Faq({ items, heading = "자주 묻는 질문" }: { items: FaqItem[]; heading?: string }) {
  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">{heading}</h2>
      <dl className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((it) => (
          <div key={it.q} className="px-4 py-3">
            <dt className="font-semibold">{it.q}</dt>
            <dd className="mt-1 text-sm leading-6 text-muted">{it.a}</dd>
          </div>
        ))}
      </dl>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({
            "@type": "Question",
            name: it.q,
            acceptedAnswer: { "@type": "Answer", text: it.a },
          })),
        }}
      />
    </section>
  );
}
