// =============================================================================
// E1 · /onboarding/mode — 모드 선택 (7/7) [F-ONB-09] · 이벤트 onboarding_complete
// 퀴즈 intent 축 결과로 "추천" 배지만 표시(강제 아님 — A2 §4).
// 데이팅 모드는 Lv2 필요: saveMode 가 VERIFY_LEVEL_REQUIRED 를 주면 friend 로
// 재호출하고 /verify CTA 를 노출한다(가입 흐름을 끊지 않는다 — 12_flows §2.7).
// =============================================================================

import type { QuizAnswer, QuizQuestion } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { ModeForm } from "./mode-form";

export default async function ModePage() {
  const profile = await requireOnboardingStep("mode");
  const supabase = await createClient();

  const { data: intentQuestions } = await supabase
    .from("quiz_questions")
    .select("id, options")
    .eq("category", "intent");

  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("question_id, choice")
    .eq("profile_id", profile.id);

  const optionsById = new Map<number, { value: number }[]>(
    ((intentQuestions ?? []) as Pick<QuizQuestion, "id" | "options">[]).map((q) => [
      q.id,
      (q.options ?? []).map((o) => ({ value: o.value })),
    ])
  );

  const values = ((answers ?? []) as Pick<QuizAnswer, "question_id" | "choice">[])
    .map((a) => optionsById.get(a.question_id)?.[a.choice]?.value)
    .filter((v): v is number => typeof v === "number");

  const intentAvg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const recommended: "friend" | "dating" = intentAvg > 0 ? "dating" : "friend";

  return (
    <section data-testid="onboarding-step-mode">
      <h1 className="text-h1">어떻게 시작할까요?</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        언제든 설정에서 바꿀 수 있어요.
      </p>

      <ModeForm recommended={recommended} verifyLevel={profile.verify_level} />
    </section>
  );
}
