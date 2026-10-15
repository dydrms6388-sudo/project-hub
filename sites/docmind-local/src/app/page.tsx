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
        🔒 문서는 업로드되지 않습니다. AI 모델을 브라우저로 내려받아 내 PC의 그래픽카드에서 직접
        실행합니다.
      </p>
      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
        💻 <b>PC 크롬·엣지 권장.</b> WebGPU 를 지원하는 브라우저에서만 동작하며, 최초 1회 약 1GB
        모델 다운로드가 필요합니다.{" "}
        <Link href="/browser-support/" className="font-semibold underline">
          지원 브라우저 확인하기
        </Link>
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
