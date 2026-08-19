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

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-bold text-slate-900">업로드가 없다는 말의 뜻</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            이 사이트에는 파일을 받는 서버가 없습니다. PDF 를 다루는 코드(pdf-lib, 그리고 pdf.js·qpdf
            를 WebAssembly 로 컴파일한 모듈)가 브라우저로 내려와 실행되고, 선택한 파일은 메모리에서만
            처리됩니다. 개발자 도구의 네트워크 탭을 열어 두고 작업해 보면 파일이 전송되는 요청이 없다는
            것을 직접 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-bold text-slate-900">한글이 깨지지 않는 이유</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            PDF 가 뷰어에 강제하는 기본 글꼴 14종에는 한글 글리프가 없습니다. 그래서 글꼴을 문서에 넣지
            않고 한글을 그리면 네모나 빈칸이 됩니다. 워터마크·페이지 번호 도구는 한글 서브셋 폰트를
            문서에 직접 임베딩하고, 폰트에 없는 글자가 있으면 조용히 넘어가지 않고 알려 드립니다.
          </p>
        </div>
      </section>

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
