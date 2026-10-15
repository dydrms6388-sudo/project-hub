"use client";

/**
 * S6-a 덕질 카드 — /onboarding/card (12_flows §2 S6-a, 10_brand #10). DuckCard 실시간 미리보기 + 최애(rank1 fav_note) + 요즘 빠진 것(40자, 예시 칩).
 * saveCard({nowInto, favNote}) → photos.
 */
import * as React from "react";
import { Button, DuckCard, HobbyChip, Input, Label, type DuckCardHobby } from "@duckmate/ui";
import { NOW_INTO_MAX, FAV_NOTE_MAX } from "@duckmate/db";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { saveCard } from "@/lib/onboarding/actions";
import { cardSchema } from "@/lib/onboarding/schemas";
import { checkText, textRuleMessage } from "@/lib/onboarding/text-rules";
import { useOnboardingDraft } from "@/stores/onboardingDraft";
import { COPY } from "./copy";
import { FieldError, OnboardingFrame } from "./OnboardingFrame";
import { useActionResult } from "./useActionResult";

export interface CardScreenProps {
  profileId: string;
  nickname: string;
  ageBand: string;
  region: string;
  /** rank 순 Top3 (+나머지) */
  hobbies: Array<DuckCardHobby & { hobbyId: number; rank: number; favNote: string | null }>;
  initialNowInto: string | null;
}

export function CardScreen({ profileId, nickname, ageBand, region, hobbies, initialNowInto }: CardScreenProps) {
  const timer = useStepTimer();
  const draft = useOnboardingDraft((s) => s.card);
  const setDraft = useOnboardingDraft((s) => s.setCard);
  const { handle, run, pending, go } = useActionResult();
  const rank1 = hobbies.find((h) => h.rank === 1);
  const [favNote, setFavNote] = React.useState(draft?.favNote ?? rank1?.favNote ?? "");
  const [nowInto, setNowInto] = React.useState(draft?.nowInto ?? initialNowInto ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const nowRef = React.useRef<HTMLInputElement>(null);

  const canSubmit = nowInto.trim().length >= 1 && nowInto.trim().length <= NOW_INTO_MAX;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = cardSchema.safeParse({ nowInto, favNote });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setErrors({ [String(issue?.path[0] ?? "nowInto")]: issue?.message ?? "" });
      nowRef.current?.focus();
      return;
    }
    const hitNow = checkText(parsed.data.nowInto);
    if (hitNow) {
      setErrors({ nowInto: textRuleMessage(hitNow, "요즘 빠진 것") });
      nowRef.current?.focus();
      return;
    }
    if (parsed.data.favNote) {
      const hitFav = checkText(parsed.data.favNote);
      if (hitFav) {
        setErrors({ favNote: textRuleMessage(hitFav, "최애") });
        return;
      }
    }
    setErrors({});
    setDraft({ nowInto, favNote });
    const res = await run(() => saveCard(parsed.data));
    handle(res, {
      onSuccess: ({ redirectTo }) => {
        track("onboarding_step_completed", { step: "card", duration_ms: timer.elapsed(), has_fav_note: Boolean(parsed.data.favNote) });
        setDraft(null);
        go(redirectTo);
      },
      onFieldError: (field, message) => setErrors({ [field]: message }),
    });
  };

  return (
    <OnboardingFrame
      step={6}
      backHref="/onboarding/quiz"
      headline={COPY.card.headline}
      sub={COPY.card.sub}
      testId="card-screen"
      footer={
        <Button type="submit" form="card-form" size="lg" disabled={!canSubmit} loading={pending} data-testid="onb-next">
          {COPY.card.next}
        </Button>
      }
    >
      <section aria-label={COPY.card.preview}>
        <p className="mb-2 text-caption text-muted-foreground">{COPY.card.preview}</p>
        <DuckCard
          profileId={profileId}
          nickname={nickname}
          ageBand={ageBand}
          region={region}
          verifyLevel={1}
          hobbies={hobbies.slice(0, 3)}
          favorite={favNote.trim() || null}
          nowInto={nowInto.trim() || null}
          compact
          data-testid="card-preview"
        />
      </section>

      <form id="card-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div>
          <Label htmlFor="fav-note" hint={COPY.card.favNoteHint}>
            {COPY.card.favNote}
            {rank1 ? <span className="ml-1 text-caption text-muted-foreground">({rank1.label})</span> : null}
          </Label>
          <Input
            id="fav-note"
            maxLength={FAV_NOTE_MAX}
            value={favNote}
            invalid={Boolean(errors["favNote"])}
            aria-describedby={errors["favNote"] ? "fav-error" : undefined}
            data-testid="card-fav-note"
            className="mt-1.5"
            onChange={(e) => setFavNote(e.target.value)}
          />
          <FieldError id="fav-error" message={errors["favNote"]} />
        </div>
        <div>
          <Label htmlFor="now-into" required hint={`${nowInto.trim().length}/${NOW_INTO_MAX}`}>
            {COPY.card.nowInto}
          </Label>
          <Input
            ref={nowRef}
            id="now-into"
            maxLength={NOW_INTO_MAX}
            value={nowInto}
            invalid={Boolean(errors["nowInto"])}
            aria-describedby={errors["nowInto"] ? "now-error" : "now-examples"}
            data-testid="card-now-into"
            className="mt-1.5"
            onChange={(e) => setNowInto(e.target.value)}
          />
          <FieldError id="now-error" message={errors["nowInto"]} />
          <div id="now-examples" className="mt-2">
            <span className="text-caption text-muted-foreground">{COPY.card.examples}: </span>
            <ul className="mt-1 flex flex-wrap gap-2">
              {COPY.card.exampleChips.map((ex) => (
                <li key={ex}>
                  <HobbyChip label={ex} glyph="none" size="sm" selected={nowInto === ex} data-testid="card-example-chip" onClick={() => setNowInto(ex)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </OnboardingFrame>
  );
}
