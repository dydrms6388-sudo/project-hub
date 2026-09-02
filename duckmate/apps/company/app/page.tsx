import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import { SafetyPledge } from "@/components/safety-pledge";
import { COMPANY_URL, webUrl } from "@/config/site";

export const metadata: Metadata = {
  // 회사 사이트는 인덱싱 허용 (C4 D-5 / §5.1) — noindex 금지
  robots: { index: true, follow: true },
  // 홈만 title 템플릿 미적용 (C4 §5.2)
  title: {
    absolute: `${BRAND_NAME} — 같은 걸 좋아하는 사람이랑 만나는 앱`,
  },
  description:
    "외모 스와이프가 아니라 취향으로 만나는 데이팅·취미친구 앱. 본인인증 필수, 신고 24시간 처리.",
  alternates: { canonical: COMPANY_URL },
};

/** 핵심 섹션 3개 — 카피 원본: 13_company_site.md §2.1 */
const FEATURES = [
  {
    id: "taste-first",
    eyebrow: "핵심 ①",
    title: "취향이 먼저입니다",
    body: [
      `${BRAND_NAME}에서 프로필의 첫 화면은 사진이 아니라 덕질 카드입니다.`,
      "좋아하는 것 세 가지, 최애, 요즘 빠진 것으로 서로를 소개하고, 취미 궁합·취향 퀴즈·활동 시간대를 계산해 “왜 잘 맞는지”를 이유와 함께 보여드립니다.",
      "매칭이 되면 “이번 주말에 같이 보드게임 어때요?” — 같이 할 수 있는 것부터 제안합니다.",
    ],
    note: "궁합 계산 결과는 재미로 보는 참고 지표입니다.",
  },
  {
    id: "no-paywall",
    eyebrow: "핵심 ②",
    title: "대화를 돈으로 잠그지 않습니다",
    body: [
      "무료 회원도 매일 새로운 추천을 받고, 매칭되고, 대화할 수 있습니다.",
      "유료 기능은 추천 수와 편의 기능을 넓혀줄 뿐, 매칭된 상대와의 대화 시작에 결제를 요구하지 않습니다.",
      "자동갱신은 미리 알려드리고, 해지는 두 번의 탭이면 충분합니다.",
    ],
    note: "결제 기능은 준비 중이며, 오픈 시 요금과 해지 방법을 사전에 안내합니다.",
  },
];

export default function CompanyHome() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5">
      {/* Hero — 미션 한 줄 (C4 §2.1) */}
      <section className="py-16 sm:py-20">
        <h1 className="text-display text-ink">
          같은 걸 좋아하는 사람이랑 만나는 앱, {BRAND_NAME}.
        </h1>
        <p className="mt-4 text-h3 font-normal text-ink">
          외모 스와이프 말고, 취향으로 시작하는 만남을 만듭니다.
        </p>
        <p className="mt-3 text-body text-ink-muted">
          내 취미 Top 3, 최애, 요즘 빠진 것 — {BRAND_NAME}의 첫인상은 사진이 아니라 덕질
          카드입니다.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={webUrl("/", "home")}
            className="inline-flex h-13 items-center justify-center rounded-full bg-primary px-8 text-body font-semibold text-primary-fg hover:bg-primary-strong"
          >
            {BRAND_NAME} 시작하기
          </a>
          <a
            href="#safety"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-6 text-body font-semibold text-ink hover:bg-primary/10"
          >
            안전 정책 보기
          </a>
        </div>
      </section>

      {/* 핵심 섹션 ①② */}
      {FEATURES.map((f) => (
        <section
          key={f.id}
          id={f.id}
          className="scroll-mt-20 border-t border-line py-14"
          aria-labelledby={`${f.id}-title`}
        >
          <p className="text-caption text-accent-text">{f.eyebrow}</p>
          <h2 id={`${f.id}-title`} className="mt-2 text-h1 text-ink">
            {f.title}
          </h2>
          {f.body.map((line) => (
            <p key={line} className="mt-3 text-body text-ink-muted">
              {line}
            </p>
          ))}
          <p className="mt-4 text-caption text-ink-muted">{f.note}</p>
        </section>
      ))}

      {/* 핵심 섹션 ③ — 안전 (#safety) */}
      <div className="border-t border-line">
        <SafetyPledge />
      </div>

      {/* 클로징 CTA */}
      <section className="border-t border-line py-16">
        <h2 className="text-h1 text-ink">취향이 맞는 사람과의 첫 대화, 오늘 시작해 보세요.</h2>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={webUrl("/", "home-closing")}
            className="inline-flex h-13 items-center justify-center rounded-full bg-primary px-8 text-body font-semibold text-primary-fg hover:bg-primary-strong"
          >
            {BRAND_NAME} 시작하기
          </a>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-6 text-body font-semibold text-ink hover:bg-primary/10"
          >
            제휴·언론 문의
          </Link>
        </div>
      </section>
    </main>
  );
}
