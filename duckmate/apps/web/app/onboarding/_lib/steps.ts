// =============================================================================
// E1 · 온보딩 7스텝 메타 + 재개 가드 (12_flows §결정-4 · §8.9)
//
// 3층 가드(12_flows §결정-3) 중 2층에 해당한다:
//   1층 middleware.ts  세션 유무 (오케스트레이터 소유 — 수정 금지)
//   2층 ★ 여기 + lib/auth/guards.ts(requireUser)  스텝 순서·재개
//   3층 RLS(D1) + 각 Server Action 의 checkStep
//
// 레이아웃은 경로를 모르기 때문에(진행률만 그린다) 스텝 강제는 각 page 가
// requireOnboardingStep(step) 을 호출해 수행한다. 저장된 onboarding_step 이
// 요구 스텝에 도달하지 않았으면 저장된 스텝 화면으로 되돌린다(입력 보존).
// =============================================================================

import { redirect } from "next/navigation";
import type { OnboardingStep, Profile } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { hasReachedStep, stepIndex } from "@/lib/auth/schemas";

export interface OnboardingStepMeta {
  step: Exclude<OnboardingStep, "done">;
  /** 1~7 — 진행률 표시용 */
  number: number;
  title: string;
  href: string;
}

export const ONBOARDING_UI_STEPS: readonly OnboardingStepMeta[] = [
  { step: "age", number: 1, title: "연령 확인", href: "/onboarding/age" },
  { step: "phone", number: 2, title: "휴대폰 인증", href: "/onboarding/phone" },
  { step: "hobbies", number: 3, title: "취미 선택", href: "/onboarding/hobbies" },
  { step: "quiz", number: 4, title: "궁합 퀴즈", href: "/onboarding/quiz" },
  { step: "duckcard", number: 5, title: "덕질카드", href: "/onboarding/duckcard" },
  { step: "photo", number: 6, title: "사진", href: "/onboarding/photo" },
  { step: "mode", number: 7, title: "모드 선택", href: "/onboarding/mode" },
] as const;

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_UI_STEPS.length;

export function stepMeta(step: OnboardingStep): OnboardingStepMeta | null {
  return ONBOARDING_UI_STEPS.find((s) => s.step === step) ?? null;
}

/** 진행률(1~7). done 이면 7 */
export function stepNumber(step: OnboardingStep): number {
  return stepMeta(step)?.number ?? ONBOARDING_TOTAL_STEPS;
}

/** 로그인 사용자의 프로필 (없으면 /login) */
export async function getOnboardingProfile(): Promise<Profile> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/login");
  return data as Profile;
}

/**
 * 스텝 진입 가드. 요구 스텝에 도달하지 못했으면 저장된 스텝으로 되돌리고,
 * 이미 온보딩을 마쳤으면(`done`) 홈으로 보낸다(재편집은 /me 계열 소관).
 */
export async function requireOnboardingStep(required: Exclude<OnboardingStep, "done">): Promise<Profile> {
  const profile = await getOnboardingProfile();
  if (profile.onboarding_step === "done") redirect("/home");
  if (!hasReachedStep(profile.onboarding_step, required)) {
    redirect(`/onboarding/${profile.onboarding_step}`);
  }
  return profile;
}

/** 다음 스텝 경로 (done 이면 /home) */
export function nextStepHref(step: OnboardingStep): string {
  const i = stepIndex(step);
  const next = ONBOARDING_UI_STEPS[i + 1];
  return next ? next.href : "/home";
}
