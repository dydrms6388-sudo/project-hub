"use client";

// =============================================================================
// E1 · 덕질카드 입력 — 최애(40자) · 요즘 빠진 것(80자), 각각 생략 가능.
// 연락처/SNS 패턴은 서버가 CONTACT_INFO_BLOCKED 로 거부한다(정책 프리체크).
// '나중에 채우기' = advanceOnboardingStep (스킵 허용 스텝) + 품질 안내 1줄.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@duckmate/ui";
import { advanceOnboardingStep, saveDuckCard } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

const FAV_MAX = 40;
const OBSESSION_MAX = 80;

export function DuckCardForm({
  initialFavNote,
  initialObsession,
}: {
  initialFavNote: string;
  initialObsession: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [favNote, setFavNote] = useState(initialFavNote);
  const [obsession, setObsession] = useState(initialObsession);
  const [error, setError] = useState<string | null>(null);

  function goNext() {
    window.dispatchEvent(
      new CustomEvent("duckmate:analytics", { detail: { event: "duckcard_complete" } })
    );
    router.replace("/onboarding/photo");
    router.refresh();
  }

  function handleError(code: Parameters<typeof messageForActionError>[0], message: string) {
    const to = redirectForActionError(code, message);
    if (to) {
      router.replace(to);
      return;
    }
    setError(messageForActionError(code, message));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveDuckCard({
        favNote: favNote.trim() === "" ? null : favNote.trim(),
        currentObsession: obsession.trim() === "" ? null : obsession.trim(),
      });
      if (!res.ok) {
        handleError(res.code, res.message);
        return;
      }
      goNext();
    });
  }

  function onSkip() {
    setError(null);
    startTransition(async () => {
      const res = await advanceOnboardingStep();
      if (!res.ok) {
        handleError(res.code, res.message);
        return;
      }
      goNext();
    });
  }

  const invalid = error !== null;

  return (
    <form className="mt-5 flex flex-col gap-5" onSubmit={onSubmit} noValidate data-testid="duckcard-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="duckcard-fav" className="text-body-sm font-semibold">
          최애
        </label>
        <Input
          id="duckcard-fav"
          maxLength={FAV_MAX}
          placeholder="예: 최애 작품·선수·아이돌"
          value={favNote}
          invalid={invalid}
          aria-describedby="duckcard-fav-help duckcard-error"
          onChange={(e) => setFavNote(e.target.value)}
          data-testid="duckcard-fav"
        />
        <p id="duckcard-fav-help" className="text-caption text-ink-muted">
          {favNote.length}/{FAV_MAX}자 · 연락처·SNS 계정은 적을 수 없어요.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="duckcard-obsession" className="text-body-sm font-semibold">
          요즘 빠진 것
        </label>
        <Textarea
          id="duckcard-obsession"
          maxLength={OBSESSION_MAX}
          placeholder="예: 신작 정주행 중이에요"
          value={obsession}
          invalid={invalid}
          aria-describedby="duckcard-obsession-help duckcard-error"
          onChange={(e) => setObsession(e.target.value)}
          data-testid="duckcard-obsession"
        />
        <p id="duckcard-obsession-help" className="text-caption text-ink-muted">
          {obsession.length}/{OBSESSION_MAX}자
        </p>
      </div>

      <p
        id="duckcard-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={pending} data-testid="duckcard-submit">
          카드 완성
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={pending}
          data-testid="duckcard-skip"
        >
          나중에 채우기
        </Button>
        <p className="text-caption text-ink-muted">
          카드를 채우면 궁합 이유가 풍부해져요. 나중에 홈에서 이어서 채울 수도 있어요.
        </p>
      </div>
    </form>
  );
}
