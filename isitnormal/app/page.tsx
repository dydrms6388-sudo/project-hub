import Link from "next/link";
import VoteCard from "@/components/VoteCard";
import { CATEGORIES, getFeatured } from "@/lib/surveys";
import { SEED_TARGET_TOTAL } from "@/content/categories";

export default function HomePage() {
  const featured = getFeatured(8);
  const today = featured[0];

  return (
    <div className="space-y-10">
      {/* 히어로 — 3초 안에 뭐하는 곳인지 (B1) */}
      <section className="pt-2">
        <h1 className="text-2xl font-extrabold leading-snug text-ink">
          우리집만 이래?
          <br />
          <span className="text-brand">익명 투표로 1탭에</span> 확인하세요.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/60">
          로그인 없이 한 번 누르면, 내가 다수인지 소수파인지 바로 나옵니다. 지금
          카테고리 12개에 {SEED_TARGET_TOTAL}개 설문이 열려 있어요.
        </p>
      </section>

      {/* 오늘의 질문 — 성질 급한 사람도 1탭 참여 (B2) */}
      {today && (
        <section>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">
            오늘의 질문
          </div>
          <h2 className="mb-3 text-lg font-bold text-ink">{today.title}</h2>
          <p className="mb-4 text-sm leading-relaxed text-ink/70">{today.body}</p>
          <VoteCard slug={today.slug} options={today.options} />
          <div className="mt-2 text-right">
            <Link
              href={`/q/${today.slug}`}
              className="text-xs text-ink/40 underline underline-offset-2 hover:text-ink/60"
            >
              이 설문 자세히 보기
            </Link>
          </div>
        </section>
      )}

      <div className="ad-slot" aria-hidden="true">
        광고 영역 (승인 후 노출)
      </div>

      {/* 카테고리 12 */}
      <section id="categories">
        <h2 className="mb-4 text-lg font-bold text-ink">카테고리</h2>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 transition hover:border-brand hover:shadow-sm"
            >
              <span className="text-2xl" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="text-sm font-semibold text-ink">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 새 설문 강제 노출 (S4) */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-ink">지금 뜨는 설문</h2>
        <ul className="space-y-2">
          {featured.slice(1).map((s) => (
            <li key={s.slug}>
              <Link
                href={`/q/${s.slug}`}
                className="block rounded-xl border border-black/5 bg-white px-4 py-3 text-sm font-medium text-ink transition hover:border-brand"
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
