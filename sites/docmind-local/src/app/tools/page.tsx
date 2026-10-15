import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/site.config";
import { toolsByCategory } from "@/tools/registry";

export const metadata: Metadata = {
  title: "전체 도구",
  description: `${site.name}의 모든 도구 목록입니다.`,
  alternates: { canonical: "/tools/" },
};

export default function ToolsIndex() {
  const groups = toolsByCategory();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">전체 도구</h1>
      {groups.map((g) => (
        <section key={g.category} className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">{g.category}</h2>
          <ul className="space-y-2">
            {g.items.map((t) => (
              <li key={t.slug}>
                <Link href={`/tools/${t.slug}/`} className="text-blue-700 hover:underline">
                  {t.h1}
                </Link>
                <span className="ml-2 text-sm text-slate-500">{t.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
