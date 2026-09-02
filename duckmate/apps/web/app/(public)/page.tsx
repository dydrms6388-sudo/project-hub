/**
 * 랜딩 `/` — 비로그인 공식 페이지(인덱싱 O). 로그인 상태면 있어야 할 곳(homeFor)으로.
 * 10_brand #1 카피. "시작하기" → S1 연령 확인, "이미 회원이에요" → /login (12_flows §9 플로우차트).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@duckmate/ui";
import { homeFor } from "@/lib/auth/gate";
import { gatePublic } from "@/components/auth/public-gate";
import { LegalFooterWeb } from "@/components/auth/LegalFooterWeb";
import { COPY, SERVICE_NAME } from "@/components/onboarding/copy";

export const metadata: Metadata = {
  // absolute: 루트 템플릿 `%s · 덕메이트` 가 붙어 서비스명이 두 번 나오던 것을 방지(E6)
  title: { absolute: `${SERVICE_NAME} — ${COPY.landing.headline}` },
  description: COPY.landing.sub,
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { user, state } = await gatePublic({ kind: "public" });
  if (user && state) redirect(homeFor(state));
  const companyUrl = process.env.NEXT_PUBLIC_COMPANY_URL;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background" data-testid="landing">
      <header className="flex items-center justify-between px-5 pt-5">
        <span className="text-h3 text-primary">{SERVICE_NAME}</span>
        <Link href="/login" className="text-body-sm text-muted-foreground underline-offset-4 hover:underline" data-testid="landing-login">
          {COPY.landing.login}
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col px-5 pt-14 pb-10 outline-none">
        <h1 className="text-display text-foreground">{COPY.landing.headline}</h1>
        <p className="mt-4 text-body text-muted-foreground">{COPY.landing.sub}</p>
        <div className="mt-8 flex flex-col gap-2">
          <Button asChild size="lg">
            <Link href="/onboarding/age" data-testid="landing-start">
              {COPY.landing.cta}
            </Link>
          </Button>
        </div>
        <ul className="mt-12 flex flex-col gap-4" aria-label="특징">
          {COPY.landing.features.map((f) => (
            <li key={f.title} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-h3 text-foreground">{f.title}</h2>
              <p className="mt-1 text-body-sm text-muted-foreground">{f.body}</p>
            </li>
          ))}
        </ul>
        {companyUrl ? (
          <p className="mt-8 text-body-sm">
            <a href={companyUrl} className="text-muted-foreground underline-offset-4 hover:underline" rel="noopener">
              {COPY.landing.company} →
            </a>
          </p>
        ) : null}
      </main>
      <LegalFooterWeb />
    </div>
  );
}
