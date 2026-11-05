import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { getOnboardingSnapshot } from "@/lib/onboarding/actions";
import { QuizScreen } from "@/components/onboarding/QuizScreen";
import { loadQuiz } from "@/components/onboarding/data";

export const metadata: Metadata = { title: "궁합 퀴즈" };
export const dynamic = "force-dynamic";

export default async function QuizPage() {
  await requireGate({ kind: "onboarding", step: "quiz" });
  const [questions, snap] = await Promise.all([loadQuiz(), getOnboardingSnapshot()]);
  return <QuizScreen questions={questions} answered={snap.ok ? snap.data.quizAnswered : []} />;
}
