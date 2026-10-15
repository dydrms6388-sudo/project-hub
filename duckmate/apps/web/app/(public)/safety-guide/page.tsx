import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_NAME } from "@/config/company";
import { LegalFooterBlock } from "@/components/legal/LegalFooterBlock";
import { OFFLINE_MEETING_GUIDE, SAFETY_GUIDE } from "@/components/safety/copy";

/**
 * /safety-guide — 만남 안전 가이드 (12_flows §5.2·§11 "E5 정적 페이지", 05_trust_safety §10 확정본 + 커뮤니티 가이드라인 요약). H2 신설.
 * 채팅의 오프라인 만남 배너 [만남 안전 가이드 전체 보기] 가 여기로 온다(이전에는 404). 비로그인 O · 인덱싱 O · sitemap 포함 · 정적(SSG).
 * 규범 원문은 /legal/community(커뮤니티 가이드라인) — 이 페이지는 요약·행동 지침만 담고 새 규칙을 만들지 않는다.
 */
export const metadata: Metadata = {
  title: "만남 안전 가이드",
  description: `${SERVICE_NAME}에서 대화하고 처음 만날 때 지키면 좋은 안전 수칙과 신고·차단 방법을 안내합니다.`,
  robots: { index: true, follow: true },
  alternates: { canonical: "/safety-guide" },
};

/** 채팅 안에서 자동으로 적용되는 보호 (커뮤니티 가이드라인 §2 요약) */
const AUTO_PROTECTIONS = [
  "매칭 후 72시간 동안 휴대폰번호·메신저 ID·SNS·링크·이메일·계좌번호는 [연락처 숨김]으로 가려져요. 양쪽 모두 사진인증을 마친 뒤 72시간이 지나면 풀려요.",
  "금전·투자 관련 표현이 감지되면 상대 화면에 주의 배너가 떠요.",
  "채팅 사진은 양쪽 사진인증 + 매칭 24시간 후부터 보낼 수 있고, 받는 사람 화면에는 흐리게 표시된 뒤 선택해서 봐요.",
  "신고하면 최근 대화 기록이 자동으로 보존되고, 심각한 경우엔 사람이 보기 전에 시스템이 먼저 채팅을 멈춰요.",
];

/** 커뮤니티 가이드라인 §1 "우리가 지키는 것" 요약 */
const COMMUNITY_RULES = [
  { title: "본인으로 참여해요", body: "실제 나이·성별·취미, 내 얼굴 사진. 캐릭터·취미 사진은 보조 사진으로만." },
  { title: "상대가 원하지 않는 이야기는 하지 않아요", body: "성적인 말, 외모 이야기, 개인정보 캐묻기 모두 포함이에요." },
  { title: "돈 이야기는 하지 않아요", body: "송금·투자·상품권 요구는 대화가 아니라 신호예요." },
  { title: "여기서 충분히 대화한 뒤에 옮겨요", body: "매칭 후 3일 동안은 연락처가 자동으로 가려져요." },
  { title: "불편하면 신고·차단해요", body: "상대에게 알림이 가지 않고, 24시간 안에 확인해요." },
];

const SIGNALS = [
  "갑자기 급한 사정(병원비·사업 자금)을 이야기하며 돈을 빌려 달라고 해요.",
  "투자·코인·부업 앱을 깔라고 하거나 수익을 보장한다고 해요.",
  "연락처를 가리는 기간인데 변형 표기(공일공…, 인스타 아이디)로 밖에서 이야기하자고 해요.",
  "만난 적도 없는데 실명·직장·주소·신분증 같은 개인정보를 물어요.",
];

export default function SafetyGuidePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-safe">
      <header className="flex h-14 items-center justify-between">
        <Link href="/" className="text-label font-bold text-primary">
          {SERVICE_NAME}
        </Link>
        <Link href="/legal/community" className="text-body-sm text-muted-foreground underline-offset-4 hover:underline">
          커뮤니티 가이드라인
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-10 outline-none" data-testid="safety-guide">
        <p className="text-label mt-4 text-primary">안전</p>
        <h1 className="text-h1 mt-1">만남 안전 가이드</h1>
        <p className="text-body mt-3 text-muted-foreground">안전 안내는 경고가 아니라 동행이에요. 대화를 시작할 때, 그리고 처음 만나는 날 이렇게 해 보세요.</p>

        <section className="mt-8" aria-labelledby="sg-chat">
          <h2 id="sg-chat" className="text-h3">
            대화 전에 3가지만
          </h2>
          <ol className="mt-3 space-y-3">
            {SAFETY_GUIDE.items.map((t, i) => (
              <li key={t} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-body">{t}</span>
              </li>
            ))}
          </ol>
          <p className="text-body-sm mt-2 text-muted-foreground">{SAFETY_GUIDE.footer}</p>
        </section>

        <section className="mt-8" aria-labelledby="sg-meet">
          <h2 id="sg-meet" className="text-h3">
            {OFFLINE_MEETING_GUIDE.title}
          </h2>
          <ul className="mt-3 space-y-2">
            {OFFLINE_MEETING_GUIDE.items.map((t) => (
              <li key={t} className="flex gap-3 rounded-md bg-muted px-3 py-3 text-body">
                <span aria-hidden="true" className="text-primary">
                  •
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm mt-2 text-muted-foreground">만남은 두 사람이 정해요. {SERVICE_NAME}는 만남을 재촉하지 않고, 제안 카드로만 이야기를 꺼내요.</p>
        </section>

        <section className="mt-8" aria-labelledby="sg-signal">
          <h2 id="sg-signal" className="text-h3">
            이런 신호가 보이면 바로 신고해요
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-body">
            {SIGNALS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="text-body-sm mt-3 text-muted-foreground">
            신고는 대화방 상단 🚩 버튼 한 번이면 돼요. 신고하는 순간 최근 대화가 운영팀에 자동으로 전달되고, 원하면 차단까지 같이 할 수 있어요. 차단해도 상대에게 알림이 가지 않아요.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="sg-auto">
          <h2 id="sg-auto" className="text-h3">
            채팅에서 자동으로 지켜 주는 것
          </h2>
          <ul className="mt-3 space-y-2">
            {AUTO_PROTECTIONS.map((t) => (
              <li key={t} className="rounded-md border border-border bg-card px-3 py-3 text-body-sm">
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="sg-rules">
          <h2 id="sg-rules" className="text-h3">
            우리가 지키는 것
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {COMMUNITY_RULES.map((r) => (
              <li key={r.title} className="px-4 py-3">
                <p className="text-body font-medium">{r.title}</p>
                <p className="text-body-sm mt-0.5 text-muted-foreground">{r.body}</p>
              </li>
            ))}
          </ul>
          <p className="text-body-sm mt-3 text-muted-foreground">
            금지행위 14가지와 제재 기준 전체는{" "}
            <Link href="/legal/community" className="text-primary underline underline-offset-4">
              커뮤니티 가이드라인
            </Link>
            에, 청소년 보호 기준은{" "}
            <Link href="/legal/youth" className="text-primary underline underline-offset-4">
              청소년보호정책
            </Link>
            에 있어요.
          </p>
        </section>
      </main>
      <LegalFooterBlock compact />
    </div>
  );
}
