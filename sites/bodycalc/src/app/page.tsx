import Link from "next/link";
import { guides } from "@/lib/routes";
import { site } from "@/site.config";
import { MEDICAL_DISCLAIMER } from "@/lib/health";
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

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { t: "산식이 보입니다", d: "모든 계산기에 공식 원문과 내 숫자를 대입한 과정, 그리고 그 식의 한계를 함께 적었습니다." },
          { t: "출처를 답니다", d: "WHO·EFSA·ACOG·논문 DOI 등 값의 근거를 링크로 남깁니다. 확인 못 한 값에는 배지를 붙입니다." },
          { t: "처방하지 않습니다", d: "목표 체중이나 섭취 열량을 제시하지 않습니다. 극단값이 나오면 전문가 상담을 안내합니다." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-800">{c.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.d}</p>
          </div>
        ))}
      </div>

      <p
        role="note"
        className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
      >
        <span className="font-bold">의료 조언이 아닙니다 · </span>
        {MEDICAL_DISCLAIMER}
      </p>

      {groups.map((g) => (
        <section key={g.category} className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{g.category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}/`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/40"
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

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold text-slate-900">읽을거리</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <Link
              key={g.path}
              href={g.path}
              className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-400 hover:bg-teal-50/40"
            >
              <span className="block font-semibold text-slate-800">{g.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-500">{g.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
