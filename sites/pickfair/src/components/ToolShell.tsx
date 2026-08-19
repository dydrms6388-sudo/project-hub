import Link from "next/link";
import AdSlot from "./AdSlot";
import Faq from "./Faq";
import ToolMount from "./ToolMount";
import { toolBySlug, type ToolMeta } from "@/tools/registry";

/**
 * 모든 도구 페이지 공통 골격.
 * H1 → 도구 → 광고 → 사용법 → 원리/근거 → FAQ → 관련 도구
 */
export default function ToolShell({ tool }: { tool: ToolMeta }) {
  const related = tool.related.map(toolBySlug).filter((t): t is ToolMeta => Boolean(t));

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <nav aria-label="경로" className="mb-3 text-xs text-slate-500">
        <Link href="/" className="hover:underline">홈</Link>
        <span className="mx-1.5">/</span>
        <Link href="/tools/" className="hover:underline">도구</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-700">{tool.h1}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{tool.h1}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{tool.description}</p>
        {tool.heavy ? (
          <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            💻 PC 크롬/엣지 권장 — 모바일에서는 느리거나 실패할 수 있습니다
          </p>
        ) : null}
      </header>

      <section aria-label="도구" className="mb-8">
        <ToolMount slug={tool.slug} />
      </section>

      {/* 광고는 결과 아래 1개만 */}
      <div className="mb-10">
        <AdSlot />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-slate-900">사용법</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
          {tool.howto.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-slate-900">원리와 근거</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
          {tool.principle.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        {tool.sources && tool.sources.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            <li className="font-medium text-slate-700">출처</li>
            {tool.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-violet-700 hover:underline"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-slate-900">자주 묻는 질문</h2>
        <Faq items={tool.faq} />
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">관련 도구</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/tools/${r.slug}/`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-violet-400 hover:bg-violet-50/40"
              >
                <span className="block font-semibold text-slate-800">{r.h1}</span>
                <span className="mt-1 block text-sm text-slate-500">{r.description}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
