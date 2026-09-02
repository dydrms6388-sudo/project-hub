import Link from "next/link";
import { DisabledButton, LinkButton } from "@/components/LinkButton";
import { SERVICE_NAME, appUrl, companyUrl } from "@/config/company";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { JsonLd } from "@/components/JsonLd";
import { MockDaily, MockDuckCard, MockSuggestions } from "@/components/HomeMockups";

/** 카피는 13_company_site §3.1 그대로. "덕메이트" 리터럴은 SERVICE_NAME 으로만. 미검증 수치·외모/인기 라벨·압박 표현 없음. */

const DIFFERENCES = [
  {
    title: "외모 점수는 없어요",
    body: "매칭 점수에 사진은 0%. 취미 겹침 40%, 궁합 퀴즈 35%, 활동 시간대 15%, 서로의 관심 10%로 계산해요.",
  },
  {
    title: "친구 모드와 데이팅 모드를 나눴어요",
    body: "기본은 취미 친구 모드. 데이팅 모드는 본인인증에 사진 인증까지 마친 사람끼리만, 서로 같은 모드일 때만 보여요.",
  },
  {
    title: "첫 대화가 어렵지 않아요",
    body: "매칭 즉시 두 사람의 취미와 시간대로 만든 제안 카드 3장. “이번 주말 오전에 같이 뛰어볼까요?”처럼요.",
  },
];

/** 안전 요약 3항목 (Phase 1부터 노출). FAQPage JSON-LD 원문으로도 사용. */
const SAFETY = [
  {
    q: "본인인증 없이는 보이지 않아요",
    a: "휴대폰 인증만으로는 프로필이 공개되지 않아요. 추천·좋아요·채팅은 본인인증을 마친 회원끼리만.",
    href: "/legal/youth/",
    link: "청소년보호정책",
  },
  {
    q: "신고는 24시간 안에 1차 조치해요",
    a: "신고하는 순간 대화 기록이 자동으로 보존되고, 심각한 경우엔 사람이 보기 전에 시스템이 먼저 채팅을 멈춰요.",
    href: "/legal/privacy/",
    link: "개인정보처리방침",
  },
  {
    q: "위치는 '구'까지만, GPS는 받지 않아요",
    a: "실시간 위치·반경 노출 없음. 연락처는 매칭 3일 후부터 주고받을 수 있어요.",
    href: "/legal/location/",
    link: "위치정보 이용약관",
  },
];

export default function HomePage() {
  const start = appUrl("/onboarding/age");
  const StartButton = ({ size = "lg", variant }: { size?: "md" | "lg"; variant?: "default" | "accent" }) =>
    start ? (
      <LinkButton href={start} rel="noopener" size={size} variant={variant}>
        {SERVICE_NAME} 시작하기
      </LinkButton>
    ) : (
      <DisabledButton size={size} variant={variant} title="앱 주소가 아직 설정되지 않았어요">
        {SERVICE_NAME} 준비 중
      </DisabledButton>
    );

  return (
    <>
      {/* 히어로: primary-900 딥 바이올렛 블록 허용(10_brand 결정 23) */}
      <section aria-labelledby="hero-title" className="bg-violet-900 text-sand-50">
        <Container className="py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-label text-violet-200">같은 취미로 시작하는 친구·데이팅</p>
            <h1 id="hero-title" className="text-display mt-3 text-sand-0">
              같은 걸 좋아하는 사람이랑 만나는 앱
            </h1>
            <p className="text-body mt-5 text-violet-100 md:text-[18px] md:leading-7">
              외모 스와이프 대신 덕질 궁합. 취미 Top3와 최애로 나를 소개하고, 매칭되면 &ldquo;같이 할 수 있는 것&rdquo;까지 앱이 골라줘요. 만 19세 이상, 본인인증을 마친 사람끼리만.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StartButton variant="accent" />
              <LinkButton href="#safety" size="lg" variant="outline" className="border-violet-500 bg-transparent text-sand-50 hover:bg-violet-800">
                안전 정책 보기
              </LinkButton>
            </div>
            <p className="text-caption mt-6 text-violet-200">수도권 우선 오픈 · 친구 모드는 성별 무관 · 미인증 회원 간 DM 없음</p>
          </div>
        </Container>
      </section>

      <Section id="how" eyebrow="이렇게 돼요" title="사진 대신 취향, 인사 대신 제안" lead="덕질 카드로 소개하고, 하루 다섯 명을 받고, 매칭되면 같이 할 것부터 골라요.">
        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          <MockDuckCard />
          <MockSuggestions />
          <MockDaily />
        </div>
      </Section>

      <Section id="different" eyebrow="다른 점" title="다른 데이팅 앱과 세 가지가 달라요" className="bg-muted/40">
        <ul className="grid gap-4 md:grid-cols-3">
          {DIFFERENCES.map((d) => (
            <li key={d.title} className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-h3">{d.title}</h3>
              <p className="text-body mt-2 text-muted-foreground">{d.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="safety" eyebrow="안전" title="매칭 알고리즘보다 신고·차단을 먼저 만들었어요">
        <ul className="grid gap-4 md:grid-cols-3">
          {SAFETY.map((s) => (
            <li key={s.q} className="flex flex-col rounded-lg border border-border bg-card p-5">
              <h3 className="text-h3">{s.q}</h3>
              <p className="text-body mt-2 flex-1 text-muted-foreground">{s.a}</p>
              <Link href={s.href} className="text-label mt-4 text-primary underline-offset-4 hover:underline">
                {s.link} 보기
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-body-sm mt-6 text-muted-foreground">
          <Link href="/legal/privacy/" className="text-primary underline underline-offset-4">
            안전 정책 자세히 보기
          </Link>
        </p>
      </Section>

      <Section id="pricing" eyebrow="요금" title="요금제는 준비 중이에요" className="bg-muted/40">
        <div className="max-w-2xl rounded-lg border border-dashed border-border bg-card p-5">
          <p className="text-body text-foreground">지금은 모든 기능이 무료예요. 유료가 생겨도 매칭·채팅·신고·차단은 계속 무료로 둘 거예요.</p>
        </div>
      </Section>

      <section aria-labelledby="cta-title" className="py-16 md:py-20">
        <Container className="text-center">
          <h2 id="cta-title" className="text-h1">
            취향이 맞으면, 첫 대화는 어렵지 않아요.
          </h2>
          <p className="text-body mt-3 text-muted-foreground">3분이면 덕질 카드가 완성돼요. 사진은 나중에 올려도 괜찮아요.</p>
          <div className="mt-8 flex justify-center">
            <StartButton />
          </div>
          <p className="text-caption mt-4 text-muted-foreground">
            <Link href="/legal/youth/" className="underline underline-offset-4">
              만 19세 이상만 이용할 수 있어요
            </Link>
          </p>
        </Container>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: companyUrl("/#safety"),
          mainEntity: SAFETY.map((s) => ({
            "@type": "Question",
            name: s.q,
            acceptedAnswer: { "@type": "Answer", text: s.a },
          })),
        }}
      />
    </>
  );
}
