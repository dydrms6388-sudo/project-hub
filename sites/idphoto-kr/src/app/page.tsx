import Link from "next/link";
import { site } from "@/site.config";
import { specs, specPixels } from "@/data/specs";
import { toolBySlug, toolsByCategory } from "@/tools/registry";

export default function Home() {
  const groups = toolsByCategory();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{site.name}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">{site.description}</p>
      <p className="mt-2 text-sm text-slate-500">
        🔒 설치·회원가입 없이 브라우저에서 바로 동작합니다. 사진은 서버로 전송되지 않습니다.
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

      <section className="mt-12">
        <h2 className="mb-3 text-lg font-bold text-slate-900">규격 한눈에 비교</h2>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-slate-600">
          인쇄 크기(mm)를 300dpi 픽셀로 옮길 때는 <strong>px = mm × 300 ÷ 25.4</strong> 를 씁니다.
          예를 들어 35mm 는 35 × 300 ÷ 25.4 = 413.4 → 413px 입니다. 아래 표의 픽셀 값은 모두 이
          식으로 계산한 값입니다.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">규격</th>
                <th className="px-3 py-2 font-medium">크기 (mm)</th>
                <th className="px-3 py-2 font-medium">300dpi (px)</th>
                <th className="px-3 py-2 font-medium">머리 길이</th>
                <th className="px-3 py-2 font-medium">수치 확인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {specs.map((s) => {
                const p = specPixels(s);
                const t = toolBySlug(s.slug);
                return (
                  <tr key={s.slug}>
                    <td className="px-3 py-2">
                      <Link href={`/tools/${s.slug}/`} className="font-medium text-blue-700 hover:underline">
                        {t?.h1 ?? s.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {s.mm.w} × {s.mm.h}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                      {p.w} × {p.h}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                      {s.head.min}~{s.head.max} mm
                    </td>
                    <td className="px-3 py-2">
                      {s.verified ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          공식 출처 확인
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                          확인 필요
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          &quot;확인 필요&quot; 는 법령·고시로 정해진 규격이 없거나(이력서·반명함·학생증) 공개된
          출처마다 값이 달라 확정하지 못한 항목입니다. 해당 페이지에 이유를 그대로 적어 두었으니,
          제출처가 안내한 규격이 있으면 그 값을 우선하세요. 최종 적합 여부는 접수 기관이 판단합니다.
        </p>
      </section>
    </div>
  );
}
