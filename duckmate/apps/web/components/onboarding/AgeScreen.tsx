"use client";

/**
 * S1 연령 확인 — /onboarding/age (12_flows §2 S1, 10_brand #2·#3).
 *  - 비로그인: 생년월일 → 성인이면 sessionStorage 드래프트 저장 → /onboarding/phone. 미성년은 같은 라우트의 안내 상태(계정·이벤트 없음).
 *  - 로그인(드래프트 없이 OTP 만 한 재방문자, has_birth_date=false): 동의 체크와 함께 submitBirthDate 호출 → 서버 redirectTo.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@duckmate/ui";
import { submitBirthDate } from "@/app/(auth)/actions";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { useOnboardingDraft } from "@/stores/onboardingDraft";
import { ageBandOf, isAdultKst, isoToParts, partsToIso, validateBirthDate, type BirthParts } from "./age";
import { ConsentChecklist, EMPTY_CONSENTS, consentsComplete, toConsentPayload, type ConsentValue } from "./ConsentChecklist";
import { COPY } from "./copy";
import { FieldError, OnboardingFrame } from "./OnboardingFrame";
import { useActionResult } from "./useActionResult";

export function AgeScreen({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const timer = useStepTimer();
  const draftBirth = useOnboardingDraft((s) => s.birthDate);
  const setBirthDate = useOnboardingDraft((s) => s.setBirthDate);
  const [parts, setParts] = React.useState<BirthParts>(() => isoToParts(draftBirth));
  const [error, setError] = React.useState<string | null>(null);
  const [minor, setMinor] = React.useState(false);
  const [consents, setConsents] = React.useState<ConsentValue>(EMPTY_CONSENTS);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const { handle, run, pending } = useActionResult();
  const errorId = "birth-error";
  const yearRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);

  const filled = parts.year.length === 4 && parts.month.length >= 1 && parts.day.length >= 1;
  const canSubmit = filled && (!loggedIn || consentsComplete(consents));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const iso = partsToIso(parts);
    const msg = validateBirthDate(iso);
    if (msg) {
      setError(msg);
      yearRef.current?.focus();
      return;
    }
    setError(null);
    if (!isAdultKst(iso)) {
      setMinor(true);
      return;
    }
    if (!loggedIn) {
      setBirthDate(iso);
      track("onboarding_step_completed", { step: "age_gate", duration_ms: timer.elapsed() });
      router.push("/onboarding/phone");
      return;
    }
    if (!consentsComplete(consents)) {
      setConsentError(COPY.phone.consentsRequired);
      return;
    }
    setConsentError(null);
    const res = await run(() => submitBirthDate({ birthDate: iso, consents: toConsentPayload(consents) }));
    handle(res, {
      onSuccess: ({ redirectTo }) => {
        track("onboarding_step_completed", { step: "age_gate", duration_ms: timer.elapsed() });
        router.replace(redirectTo);
      },
      onFieldError: (field, message) => {
        if (field === "consents") setConsentError(message);
        else setError(message);
      },
    });
  };

  if (minor) {
    return (
      <OnboardingFrame step={1} hideProgress headline={COPY.age.minor.headline} sub={COPY.age.minor.sub} testId="age-minor">
        <div className="flex flex-1 flex-col justify-end">
          <Link href="/" className="text-body-sm text-muted-foreground underline-offset-4 hover:underline">
            {COPY.age.minor.back}
          </Link>
        </div>
      </OnboardingFrame>
    );
  }

  const num = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

  return (
    <OnboardingFrame
      step={1}
      headline={COPY.age.headline}
      sub={COPY.age.sub}
      testId="age-screen"
      footer={
        <>
          <Button type="submit" form="age-form" size="lg" disabled={!canSubmit} loading={pending} data-testid="onb-next">
            {COPY.age.cta}
          </Button>
          {!loggedIn ? (
            <Link href="/login" className="py-2 text-center text-body-sm text-muted-foreground underline-offset-4 hover:underline" data-testid="age-login-link">
              {COPY.age.loginLink} →
            </Link>
          ) : null}
        </>
      }
    >
      <form id="age-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <fieldset aria-describedby={error ? errorId : "birth-hint"}>
          <legend className="mb-2 text-label text-foreground">생년월일</legend>
          <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2">
            <div>
              <Label htmlFor="birth-year" className="sr-only">연도</Label>
              <Input
                ref={yearRef}
                id="birth-year"
                inputMode="numeric"
                autoComplete="bday-year"
                placeholder="YYYY"
                maxLength={4}
                value={parts.year}
                invalid={Boolean(error)}
                data-testid="birth-year"
                className="tnum text-center"
                onChange={(e) => {
                  const v = num(e.target.value, 4);
                  setParts((p) => ({ ...p, year: v }));
                  if (v.length === 4) monthRef.current?.focus();
                }}
              />
            </div>
            <div>
              <Label htmlFor="birth-month" className="sr-only">월</Label>
              <Input
                ref={monthRef}
                id="birth-month"
                inputMode="numeric"
                autoComplete="bday-month"
                placeholder="MM"
                maxLength={2}
                value={parts.month}
                invalid={Boolean(error)}
                data-testid="birth-month"
                className="tnum text-center"
                onChange={(e) => {
                  const v = num(e.target.value, 2);
                  setParts((p) => ({ ...p, month: v }));
                  if (v.length === 2) dayRef.current?.focus();
                }}
              />
            </div>
            <div>
              <Label htmlFor="birth-day" className="sr-only">일</Label>
              <Input
                ref={dayRef}
                id="birth-day"
                inputMode="numeric"
                autoComplete="bday-day"
                placeholder="DD"
                maxLength={2}
                value={parts.day}
                invalid={Boolean(error)}
                data-testid="birth-day"
                className="tnum text-center"
                onChange={(e) => setParts((p) => ({ ...p, day: num(e.target.value, 2) }))}
              />
            </div>
          </div>
          <FieldError id={errorId} message={error} />
          <p id="birth-hint" className="mt-2 text-caption text-muted-foreground">
            {COPY.age.hint}
            {filled && !error && validateBirthDate(partsToIso(parts)) === null ? <span className="ml-1">· {ageBandOf(partsToIso(parts))}로 보여요</span> : null}
          </p>
        </fieldset>
        {loggedIn ? <ConsentChecklist value={consents} onChange={setConsents} error={consentError} /> : null}
      </form>
    </OnboardingFrame>
  );
}
