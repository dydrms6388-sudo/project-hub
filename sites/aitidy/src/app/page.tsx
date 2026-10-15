import Link from "next/link";
import { site } from "@/site.config";
import { toolsByCategory } from "@/tools/registry";

const GUIDES = [
  {
    href: "/guide/chatgpt-table-to-excel/",
    title: "ChatGPT 표를 엑셀로 옮기는 가장 확실한 방법",
    desc: "칸이 안 나뉘는 이유, 한글 깨짐, 숫자가 문자로 들어가는 문제까지 경로별로 정리했습니다.",
  },
  {
    href: "/guide/markdown-basics/",
    title: "마크다운이 뭐길래 — AI 답변에 **, ###가 붙는 이유",
    desc: "기호 하나하나의 의미와, 붙여넣을 곳(한글·카톡·노션·엑셀)별 처리 기준.",
  },
];

export default function Home() {
  const groups = toolsByCategory();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        AI 답변, 붙여넣기 좋게 정리하기
      </h1>
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

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold text-slate-900">가이드</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50/40"
            >
              <span className="block font-semibold text-slate-800">📄 {g.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-slate-500">{g.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
