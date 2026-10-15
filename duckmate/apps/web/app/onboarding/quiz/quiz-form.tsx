"use client";

// =============================================================================
// E1 · 퀴즈 진행 — 문항당 1탭, 선택 즉시 다음 문항, ← 이전으로 수정 가능.
// 문항별 진행 바 + "정답 없음 · 재미용" 상시 고지(콘텐츠 정책).
// 10문항 모두 응답하면 saveQuizAnswers 로 일괄 저장(D2 §2: 정확히 10개).
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Progress } from "@duckmate/ui";
import { saveQuizAnswers } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

export interface QuizItem {
  id: number;
  text: string;
  options: string[];
}

export function QuizForm({
  questions,
  initialAnswers,
}: {
  questions: QuizItem[];
  initialAnswers: Record<number, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<number, number>>(initialAnswers);
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => initialAnswers[q.id] === undefined);
    return firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  });
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const total = questions.length;
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;

  function submit(all: Record<number, number>) {
    startTransition(async () => {
      const res = await saveQuizAnswers({
        answers: questions.map((q) => ({ questionId: q.id, choice: all[q.id] ?? 0 })),
      });
      if (!res.ok) {
        const to = redirectForActionError(res.code, res.message);
        if (to) {
          router.replace(to);
          return;
        }
        setError(messageForActionError(res.code, res.message));
        return;
      }
      window.dispatchEvent(
        new CustomEvent("duckmate:analytics", { detail: { event: "quiz_complete" } })
      );
      router.replace("/onboarding/duckcard");
      router.refresh();
    });
  }

  function choose(choice: number) {
    if (!question) return;
    setError(null);
    const next = { ...answers, [question.id]: choice };
    setAnswers(next);

    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    const complete = questions.every((q) => next[q.id] !== undefined);
    if (!complete) {
      const missing = questions.findIndex((q) => next[q.id] === undefined);
      setIndex(missing);
      return;
    }
    submit(next);
  }

  if (!question) return null;

  return (
    <div className="mt-5 flex flex-col gap-4" data-testid="quiz-form">
      <div className="flex items-center justify-between">
        <span className="text-body-sm font-semibold" data-testid="quiz-progress-label">
          문항 {index + 1}/{total}
        </span>
        <span className="text-caption text-ink-muted">응답 {answeredCount}개</span>
      </div>
      <Progress value={index + 1} max={total} label={`퀴즈 ${total}문항 중 ${index + 1}번째`} />

      <h2 className="mt-2 text-h2" data-testid="quiz-question">
        Q{index + 1}. {question.text}
      </h2>

      <ul className="flex flex-col gap-2" data-testid="quiz-options">
        {question.options.map((label, i) => {
          const selected = answers[question.id] === i;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={selected}
                disabled={pending}
                className={[
                  "w-full rounded-2xl border px-4 py-4 text-left text-body transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  "disabled:pointer-events-none disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary-tint font-semibold text-primary-tint-fg"
                    : "border-line bg-surface-raised text-ink hover:border-primary",
                ].join(" ")}
                data-testid={`quiz-option-${i}`}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0 || pending}
          data-testid="quiz-prev"
        >
          ← 이전
        </Button>
        <span className="text-caption text-ink-muted">정답은 없어요 · 재미와 추천용이에요</span>
      </div>

      <p
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>
    </div>
  );
}
