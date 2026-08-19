// =============================================================================
// E1 · /onboarding/quiz — 궁합 퀴즈 10문항 (4/7) [F-ONB-06] · 이벤트 quiz_complete
// 5축(immersion/meeting/tempo/explore/intent) × 2문항, 4지선다 — 문항은 서버 시드
// (00005_seed)에서 조회한다. 최대 이탈 감시 구간 — 문항당 1탭 UX.
// =============================================================================

import { Card } from "@duckmate/ui";
import type { QuizAnswer, QuizQuestion } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingStep } from "../_lib/steps";
import { QuizForm, type QuizItem } from "./quiz-form";

export default async function QuizPage() {
  const profile = await requireOnboardingStep("quiz");
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("quiz_questions")
    .select("id, category, text, options, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(10);

  const { data: answered } = await supabase
    .from("quiz_answers")
    .select("question_id, choice")
    .eq("profile_id", profile.id);

  const questions: QuizItem[] = ((rows ?? []) as Pick<
    QuizQuestion,
    "id" | "category" | "text" | "options"
  >[]).map((q) => ({
    id: q.id,
    text: q.text,
    options: (q.options ?? []).map((o) => o.label),
  }));

  const initialAnswers: Record<number, number> = {};
  for (const a of (answered ?? []) as Pick<QuizAnswer, "question_id" | "choice">[]) {
    initialAnswers[a.question_id] = a.choice;
  }

  if (questions.length === 0) {
    return (
      <section data-testid="onboarding-step-quiz">
        <Card>
          <h1 className="text-h2">퀴즈를 불러오지 못했어요</h1>
          <p className="mt-2 text-body-sm text-ink-muted">
            연결이 불안정한 것 같아요. 화면을 새로고침하면 다시 시도할 수 있어요.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section data-testid="onboarding-step-quiz">
      <h1 className="text-h1">취향 궁합 퀴즈</h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        정답은 없어요. 재미와 추천용으로만 써요.
      </p>
      <QuizForm questions={questions} initialAnswers={initialAnswers} />
    </section>
  );
}
