import Link from "next/link";
import type { ReactNode } from "react";
import AdSlot from "@/components/AdSlot";
import { site } from "@/site.config";
import type { AnyRate } from "@/data/rates-2026";
import { toolBySlug } from "@/tools/registry";

export type GuideMeta = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  keywords: string[];
  updated: string;
  relatedTools: string[];
};

export function guideMetadata(g: GuideMeta) {
  const path = `/guide/${g.slug}/`;
  return {
    title: g.title,
    description: g.description,
    keywords: [...g.keywords],
    alternates: { canonical: path },
    openGraph: {
      type: "article" as const,
      locale: site.locale,
      siteName: site.name,
      url: path,
      title: `${g.title} | ${site.name}`,
      description: g.description,
    },
  };
}

export function guideJsonLd(g: GuideMeta) {
  const url = `${site.url}/guide/${g.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.h1,
      description: g.description,
      inLanguage: "ko-KR",
      dateModified: g.updated,
      mainEntityOfPage: url,
      publisher: { "@type": "Organization", name: site.name, url: site.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: `${site.url}/` },
        { "@type": "ListItem", position: 2, name: "가이드", item: `${site.url}/guide/` },
        { "@type": "ListItem", position: 3, name: g.h1, item: url },
      ],
    },
  ];
}

/** 요율 표 한 줄 */
export function RateRow({ rate, valueText }: { rate: AnyRate; valueText: string }) {
  return (
    <tr>
      <th scope="row" className="px-3 py-2 text-left font-normal text-slate-700">
        {rate.label}
        {rate.verified ? null : (
          <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
            확인 필요
          </span>
        )}
      </th>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{valueText}</td>
      <td className="px-3 py-2 text-right text-xs text-slate-500">{rate.effectiveDate}</td>
      <td className="px-3 py-2 text-right">
        <a
          href={rate.source}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-xs text-teal-700 hover:underline"
        >
          출처 ↗
        </a>
      </td>
    </tr>
  );
}

export function RateTable({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[320px] text-sm">
        {caption ? (
          <caption className="px-3 py-2 text-left text-sm font-semibold text-slate-800">
            {caption}
          </caption>
        ) : null}
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">항목</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">값</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">적용일</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">근거</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-9 mb-3 text-xl font-bold tracking-tight text-slate-900">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="my-3 text-[15px] leading-relaxed text-slate-700">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
      {children}
    </ul>
  );
}

export default function GuideShell({ meta, children }: { meta: GuideMeta; children: ReactNode }) {
  const tools = meta.relatedTools.map(toolBySlug).filter((t) => t !== undefined);
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <nav aria-label="경로" className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:underline">홈</Link>
        <span className="mx-1.5">/</span>
        <Link href="/guide/" className="hover:underline">가이드</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-700">{meta.h1}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{meta.h1}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{meta.description}</p>
        <p className="mt-2 text-xs text-slate-500">최종 확인 {meta.updated}</p>
      </header>

      <div>{children}</div>

      <div className="my-10">
        <AdSlot />
      </div>

      {tools.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">이 글과 함께 쓰는 계산기</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}/`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <span className="block font-semibold text-slate-800">{t.h1}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">{t.description}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
