import Link from "next/link";
import { site } from "@/site.config";
import { toolsByCategory } from "@/tools/registry";

export default function Home() {
  const groups = toolsByCategory();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        조작할 수 없는 랜덤, {site.name}
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
                className="rounded-xl border border-slate-200 p-4 transition hover:border-violet-400 hover:bg-violet-50/40"
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

      <section className="mt-14 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">이 사이트의 결과는 왜 공정한가요?</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">
          <p>
            보통의 추첨 사이트는 서버가 결과를 정해 내려 줍니다. 그래서 진행자가 결과를 미리 봤는지, 마음에 드는
            결과가 나올 때까지 다시 돌렸는지 참가자는 확인할 방법이 없습니다.
          </p>
          <p>
            픽페어는 구조가 다릅니다. 결과를 만들면 <b>seed(8자리 16진수)</b>와 압축된 입력값이 주소창의{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[13px] text-violet-700">#</code> 뒤에 담깁니다. 그
            링크를 열면 브라우저가 mulberry32 난수 생성기로 같은 계산을 처음부터 다시 수행하므로,{" "}
            <b>같은 링크는 언제 어디서 열어도 같은 결과</b>가 됩니다. 결과를 저장하거나 고르는 서버가 아예 없습니다.
          </p>
          <p>
            덤으로 개인정보도 남지 않습니다. URL 의 <code className="rounded bg-white px-1 py-0.5 text-[13px] text-violet-700">#</code>{" "}
            뒤(프래그먼트)는 규격상 서버로 전송되지 않기 때문에, 참가자 이름은 브라우저 밖으로 나가지 않습니다.
          </p>
        </div>

        <h3 className="mt-5 text-base font-bold text-slate-900">직접 확인하는 방법</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
          <li>아무 도구에서 결과를 뽑고 &lsquo;결과 링크 공유&rsquo;로 링크를 복사합니다.</li>
          <li>그 링크를 다른 사람의 휴대폰이나 시크릿 창에서 엽니다. 같은 결과가 나오는지 봅니다.</li>
          <li>
            더 확실하게 하려면, 뽑은 직후 <b>결과를 보기 전에</b> 링크를 단체 대화방에 먼저 올리고 다 함께 여세요.
            진행자가 결과를 보고 다시 뽑는 일이 불가능해집니다.
          </li>
        </ol>

        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          한계도 밝힙니다. mulberry32 는 빠르고 고른 난수를 만드는 알고리즘이지 암호학적으로 안전한 난수는
          아닙니다. seed 를 미리 아는 사람은 결과를 계산할 수 있으므로 seed 는 뽑기 직전에 만들어집니다. 금전이나
          법적 효력이 걸린 추첨에는 공인된 추첨 절차를 사용하세요.
        </p>
      </section>
    </div>
  );
}
