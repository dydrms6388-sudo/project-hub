"use client";

/**
 * S5 궁합 퀴즈 — /onboarding/quiz (12_flows §2 S5, 10_brand #9). 1문항씩, 1탭 → saveQuizAnswers upsert → 다음.
 * "나중에 할게요" 항상 노출 → finishQuiz({skipped:true}) + onboarding_step_skipped{step:quiz, answered}.
 * 10문항 완료 → finishQuiz({skipped:false}) + onboarding_step_completed{step:quiz}. 재진입: 답한 수 n → n+1 문항부터.
 */
import * as React from "react";
import { Button, Progress, RadioCard, RadioGroup } from "@duckmate/ui";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { finishQuiz, saveQuizAnswers } from "@/lib/onboarding/actions";
import { COPY } from "./copy";
import { OnboardingFrame } from "./OnboardingFrame";
import type { QuizQuestionItem } from "./quiz";
import { useActionResult } from "./useActionResult";

export interface QuizScreenProps {
  questions: QuizQuestionItem[];
  /** 이미 답한 question_id */
  answered: number[];
}

export function QuizScreen({ questions, answered }: QuizScreenProps) {
  const timer = useStepTimer();
  const { handle, run, pending, go } = useActionResult();
  const sorted = React.useMemo(() => [...questions].sort((a, b) => a.sortOrder - b.sortOrder), [questions]);
  const total = sorted.length;
  const firstUnanswered = Math.max(0, sorted.findIndex((q) => !answered.includes(q.id)));
  const [index, setIndex] = React.useState(firstUnanswered === -1 ? total : firstUnanswered);
  const [choices, setChoices] = React.useState<Record<number, number>>({});
  const [answeredCount, setAnsweredCount] = React.useState(answered.length);
  const [finishing, setFinishing] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const q = sorted[index];

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const finish = async (skipped: boolean) => {
    setFinishing(true);
    const res = await run(() => finishQuiz({ skipped }));
    setFinishing(false);
    handle(res, {
      onSuccess: ({ redirectTo, answered: n }) => {
        if (skipped) track("onboarding_step_skipped", { step: "quiz", answered: n, duration_ms: timer.elapsed() });
        else track("onboarding_step_completed", { step: "quiz", answered: n, duration_ms: timer.elapsed() });
        go(redirectTo);
      },
    });
  };

  const answer = async (questionId: number, choice: number) => {
    if (pending) return;
    setChoices((c) => ({ ...c, [questionId]: choice }));
    const res = await run(() => saveQuizAnswers({ answers: [{ questionId, choice }] }));
    handle(res, {
      onSuccess: ({ answered: n }) => {
        setAnsweredCount(n);
        if (index + 1 >= total) void finish(false);
        else setIndex(index + 1);
      },
    });
  };

  // 모든 문항을 이미 답한 상태로 재진입
  React.useEffect(() => {
    if (total > 0 && index >= total && !finishing) void finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  return (
    <OnboardingFrame
      step={5}
      backHref="/onboarding/hobbies"
      headline={
        <span className="flex items-center justify-between gap-3">
          <span>{COPY.quiz.headline}</span>
          <span className="tnum text-body-sm font-medium text-muted-foreground" aria-live="polite">
            {COPY.quiz.progress(Math.min(index + 1, total), total)}
          </span>
        </span>
      }
      sub={COPY.quiz.sub}
      testId="quiz-screen"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={index === 0 || pending} data-testid="quiz-prev" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
            ‹ {COPY.quiz.prev}
          </Button>
          <Button type="button" variant="outline" loading={finishing} disabled={pending} data-testid="quiz-later" onClick={() => finish(true)}>
            {COPY.quiz.later}
          </Button>
        </div>
      }
    >
      <Progress value={total === 0 ? 0 : Math.round((Math.min(answeredCount, total) / total) * 100)} aria-label={`답한 문항 ${answeredCount}/${total}`} />
      {q ? (
        <section aria-labelledby={`q-${q.id}`} data-testid={`quiz-q-${q.id}`}>
          <h2 id={`q-${q.id}`} ref={headingRef} tabIndex={-1} className="text-h2 text-foreground outline-none">
            {q.text}
          </h2>
          <RadioGroup className="mt-4" value={choices[q.id] !== undefined ? String(choices[q.id]) : ""} onValueChange={(v) => answer(q.id, Number(v))} aria-label={q.text}>
            {q.options.map((o) => (
              <RadioCard key={o.value} value={String(o.value)} label={o.label} disabled={pending} data-testid={`quiz-choice-${o.value}`} />
            ))}
          </RadioGroup>
        </section>
      ) : null}
    </OnboardingFrame>
  );
}
