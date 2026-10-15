// =============================================================================
// E1 · 온보딩 공통 프레임 [12_flows §2 공통]
// - 상단 진행률(7스텝, n/7 + 도트) — 저장된 profiles.onboarding_step 기준.
// - 재개 가드: 스텝 강제는 각 page 의 requireOnboardingStep(_lib/steps.ts)이 담당한다.
//   레이아웃은 경로를 알 수 없고, /onboarding/age 는 비로그인도 진입 가능(미들웨어
//   PUBLIC_PATHS)하기 때문에 여기서 세션을 강제하지 않는다.
// - 전면 noindex (next.config 헤더 + 여기서 재선언).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Progress } from "@duckmate/ui";
import type { OnboardingStep } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import {
  ONBOARDING_TOTAL_STEPS,
  ONBOARDING_UI_STEPS,
  stepMeta,
  stepNumber,
} from "./_lib/steps";

export const metadata: Metadata = {
  title: "시작하기",
  robots: { index: false, follow: false },
};

async function currentStep(): Promise<OnboardingStep> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "age";
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("user_id", user.id)
    .maybeSingle();
  return ((data as { onboarding_step?: OnboardingStep } | null)?.onboarding_step ?? "age");
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const step = await currentStep();
  const number = stepNumber(step);
  const meta = stepMeta(step);
  const previous = ONBOARDING_UI_STEPS.find((s) => s.number === number - 1);

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <div className="mx-auto w-full max-w-md px-5 pb-16 pt-6">
        <header className="flex flex-col gap-2" data-testid="onboarding-progress">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {ONBOARDING_UI_STEPS.map((s) => (
                <span
                  key={s.step}
                  className={
                    s.number <= number
                      ? "size-2 rounded-full bg-primary"
                      : "size-2 rounded-full bg-line"
                  }
                />
              ))}
            </div>
            <span className="text-caption text-ink-muted" data-testid="onboarding-step-count">
              {number}/{ONBOARDING_TOTAL_STEPS}
            </span>
          </div>
          <Progress
            value={number}
            max={ONBOARDING_TOTAL_STEPS}
            label={`온보딩 ${ONBOARDING_TOTAL_STEPS}단계 중 ${number}단계 ${meta?.title ?? ""}`}
          />
          {previous && number >= 3 ? (
            <Link
              href={previous.href}
              className="mt-1 w-fit text-caption text-ink-muted underline underline-offset-4"
              data-testid="onboarding-back"
            >
              ← {previous.title}로 돌아가기 (입력은 그대로 남아요)
            </Link>
          ) : null}
        </header>

        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}
