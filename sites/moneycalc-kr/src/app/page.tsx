import Link from "next/link";
import { site } from "@/site.config";
import { toolsByCategory } from "@/tools/registry";

export default function Home() {
  const groups = toolsByCategory();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{site.name}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">{site.description}</p>
      <p className="mt-2 text-sm text-slate-500">
        🔒 설치·회원가입 없이 브라우저에서 바로 동작합니다. 입력한 내용은 서버로 전송되지 않습니다.
      </p>

      {groups.map((g) => (
        <section key={g.category} className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{g.category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}/`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50/40"
              >
                <span className="block font-semibold text-slate-800">{t.h1}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                  {t.description}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
