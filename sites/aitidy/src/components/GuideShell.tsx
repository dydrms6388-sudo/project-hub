import Link from "next/link";
import AdSlot from "./AdSlot";
import { toolBySlug } from "@/tools/registry";

export function ToolLink({ slug }: { slug: string }) {
  const t = toolBySlug(slug);
  if (!t) return null;
  return (
    <Link
      href={`/tools/${t.slug}/`}
      className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50/40"
    >
      <span className="block font-semibold text-slate-800">🔧 {t.h1}</span>
      <span className="mt-1 block text-sm leading-relaxed text-slate-500">{t.description}</span>
    </Link>
  );
}

export default function GuideShell({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <nav aria-label="경로" className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          홈
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-700">가이드</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{lead}</p>
        <p className="mt-2 text-xs text-slate-400">최종 수정 {updated}</p>
      </header>

      <div className="guide space-y-4 text-[15px] leading-relaxed text-slate-700">{children}</div>

      <div className="mt-10">
        <AdSlot />
      </div>
    </article>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="!mt-9 mb-3 text-xl font-bold text-slate-900">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="!mt-6 mb-2 text-base font-bold text-slate-900">{children}</h3>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-800">
      <code>{children}</code>
    </pre>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50/60 p-3 text-sm leading-relaxed text-slate-700">
      {children}
    </div>
  );
}
