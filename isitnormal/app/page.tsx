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

      {/* 서비스 설명 — 고유 본문 (B1: 3초 안에 뭐하는 곳인지) */}
      <section className="space-y-4 border-t border-black/5 pt-8 text-[15px] leading-relaxed text-ink/75">
        <h2 className="text-lg font-bold text-ink">정상인가요는 어떤 곳인가요</h2>
        <p>
          정상인가요는 "이거 우리집만 이래?" 싶은 사소한 궁금증을 익명 투표로 확인하는 통계
          커뮤니티입니다. 수건을 며칠 쓰는지, 라면에 계란을 넣는지, 잘 때 양말을 신는지처럼
          밖에서는 좀처럼 물어보지 않는 생활 습관을 12개 카테고리로 나눠 다룹니다. 로그인도,
          이름도 필요 없습니다. 마음에 걸리는 질문에 한 번 눌러보면, 내가 다수 쪽인지
          소수파인지가 그 자리에서 비율로 나옵니다.
        </p>
        <p>
          투표하기 전에는 결과를 보여주지 않습니다. 남들 답을 먼저 보면 내 진짜 생각이
          흐려지기 때문입니다. 대신 결과가 궁금하기만 한 분을 위해 "결과만 보기"는 언제나
          열어둡니다. 통계는 오직 실제로 참여한 사람들의 표를 실시간으로 집계한 값이며, 아직
          30명이 모이지 않은 설문은 비율 대신 "집계 중"으로 표시합니다. 어디서 가져온 숫자나
          지어낸 통계는 쓰지 않습니다.
        </p>
        <p>
          여기서는 어떤 습관이 옳거나 그르다고 판정하지 않습니다. 소수파로 나와도 잘못된 게
          아니라 그저 흔치 않은 쪽일 뿐입니다. 오히려 "나만 이런 줄 알았는데 생각보다 동지가
          많네" 하고 안심하거나, "어 내가 이렇게까지 소수였어?" 하고 웃게 되는 그 순간이
          정상인가요를 쓰는 이유입니다. 결과가 재미있으면 카드로 만들어 친구에게 물어볼 수도
          있습니다. 나와 같은 편이 몇 명인지, 지금 한 표로 확인해 보세요.
        </p>
      </section>
    </div>
  );
}
