"use client";

/**
 * S2 휴대폰 OTP + 약관 동의 (12_flows §2 S2 · 15_auth §0-2·3). `/login` 은 같은 컴포넌트를 mode="login" 으로 렌더(12_flows §0-5).
 *  - signup: 드래프트 birthDate 필수(없으면 /onboarding/age) + 동의 5필수 → verifyOtp({phone, token, birthDate, consents})
 *  - login : verifyOtp({phone, token}) → 서버 redirectTo 준수(재방문자·드래프트 없음 → /onboarding/age)
 *  - 재전송 30초 타이머, RATE_LIMITED 토스트(retryAfterSec), WebOTP(navigator.credentials) 자동 입력 시도
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@duckmate/ui";
import { requestOtp, verifyOtp } from "@/app/(auth)/actions";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { KR_MOBILE_RE } from "@/lib/auth/otp";
import { useOnboardingDraft } from "@/stores/onboardingDraft";
import { formatKrPhone } from "./phone-format";
import { ConsentChecklist, EMPTY_CONSENTS, consentsComplete, toConsentPayload, type ConsentValue } from "./ConsentChecklist";
import { COPY } from "./copy";
import { FieldError, OnboardingFrame } from "./OnboardingFrame";
import { safeNext, useActionResult } from "./useActionResult";

export type PhoneOtpMode = "signup" | "login";


export function PhoneOtpScreen({ mode, next }: { mode: PhoneOtpMode; next?: string | null }) {
  const router = useRouter();
  const timer = useStepTimer();
  const birthDate = useOnboardingDraft((s) => s.birthDate);
  const clearDraft = useOnboardingDraft((s) => s.clearAll);
  const { handle, run, pending } = useActionResult();

  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<"phone" | "code">("phone");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [token, setToken] = React.useState("");
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [resendLeft, setResendLeft] = React.useState(0);
  const [consents, setConsents] = React.useState<ConsentValue>(EMPTY_CONSENTS);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const codeRef = React.useRef<HTMLInputElement>(null);
  const phoneRef = React.useRef<HTMLInputElement>(null);

  const phoneValid = KR_MOBILE_RE.test(phoneDigits);

  // signup 인데 S1 드래프트가 없으면 연령 확인으로
  React.useEffect(() => {
    if (mode === "signup" && birthDate === null && hasHydrated()) router.replace("/onboarding/age");
  }, [mode, birthDate, router]);

  // 재전송 카운트다운
  React.useEffect(() => {
    if (resendLeft <= 0) return;
    const id = window.setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendLeft]);

  // WebOTP 자동 입력 시도 (PRD S2)
  React.useEffect(() => {
    if (phase !== "code") return;
    const ac = new AbortController();
    const nav = navigator as Navigator & { credentials?: { get?: (o: unknown) => Promise<unknown> } };
    if (typeof window !== "undefined" && "OTPCredential" in window && nav.credentials?.get) {
      nav.credentials
        .get({ otp: { transport: ["sms"] }, signal: ac.signal })
        .then((cred) => {
          const code = (cred as { code?: string } | null)?.code;
          if (code && /^\d{6}$/.test(code)) setToken(code);
        })
        .catch(() => undefined);
    }
    codeRef.current?.focus();
    return () => ac.abort();
  }, [phase]);

  const sendCode = async () => {
    if (!phoneValid) {
      setPhoneError("휴대폰 번호를 확인해 주세요");
      phoneRef.current?.focus();
      return;
    }
    setPhoneError(null);
    const res = await run(() => requestOtp({ phone: phoneDigits }));
    handle(res, {
      onSuccess: ({ phone, resendAfterSec }) => {
        setSentTo(phone);
        setPhase("code");
        setToken("");
        setTokenError(null);
        setResendLeft(resendAfterSec);
      },
      onFieldError: (_f, message) => setPhoneError(message),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === "phone") {
      await sendCode();
      return;
    }
    if (!/^\d{6}$/.test(token)) {
      setTokenError("코드 6자리를 입력해 주세요");
      codeRef.current?.focus();
      return;
    }
    if (mode === "signup") {
      if (!birthDate) {
        router.replace("/onboarding/age");
        return;
      }
      if (!consentsComplete(consents)) {
        setConsentError(COPY.phone.consentsRequired);
        return;
      }
    }
    setTokenError(null);
    setConsentError(null);
    const payload = mode === "signup" ? { phone: sentTo ?? phoneDigits, token, birthDate: birthDate ?? undefined, consents: toConsentPayload(consents) } : { phone: sentTo ?? phoneDigits, token };
    const res = await run(() => verifyOtp(payload));
    handle(res, {
      onSuccess: ({ redirectTo, isNew }) => {
        if (mode === "signup" || isNew) track("onboarding_step_completed", { step: "phone", duration_ms: timer.elapsed(), is_new: isNew });
        if (isNew || redirectTo !== "/onboarding/age") clearDraft();
        const safe = safeNext(next);
        router.replace(safe && redirectTo === "/home" ? safe : redirectTo);
        router.refresh();
      },
      onRedirect: () => {
        // AGE_BLOCKED → /blocked/age (서버가 이미 로그아웃). 드래프트는 비운다
        clearDraft();
      },
      onFieldError: (field, message) => {
        if (field === "token") {
          setTokenError(message);
          codeRef.current?.focus();
        } else if (field === "consents") setConsentError(message);
        else setPhoneError(message);
      },
    });
  };

  const isSignup = mode === "signup";
  const headline = isSignup ? COPY.phone.headline : COPY.phone.loginHeadline;

  return (
    <OnboardingFrame
      step={2}
      hideProgress={!isSignup}
      backHref={isSignup ? "/onboarding/age" : undefined}
      headline={headline}
      sub={COPY.phone.sub}
      testId={isSignup ? "phone-screen" : "login-screen"}
      footer={
        <>
          {phase === "code" ? (
            <Button type="submit" form="otp-form" size="lg" loading={pending} disabled={token.length !== 6 || (isSignup && !consentsComplete(consents))} data-testid="onb-next">
              {isSignup ? COPY.phone.submit : COPY.phone.loginSubmit}
            </Button>
          ) : (
            <Button type="submit" form="otp-form" size="lg" loading={pending} disabled={!phoneValid} data-testid="otp-request">
              {COPY.phone.request}
            </Button>
          )}
          {!isSignup ? (
            <Link href="/onboarding/age" className="py-2 text-center text-body-sm text-muted-foreground underline-offset-4 hover:underline" data-testid="login-new-link">
              {COPY.phone.newHere} →
            </Link>
          ) : null}
        </>
      }
    >
      <form id="otp-form" onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div>
          <Label htmlFor="phone" required>
            휴대폰 번호
          </Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              ref={phoneRef}
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={COPY.phone.placeholder}
              value={formatKrPhone(phoneDigits)}
              disabled={phase === "code"}
              invalid={Boolean(phoneError)}
              aria-describedby={phoneError ? "phone-error" : undefined}
              data-testid="phone-input"
              className="tnum"
              onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
            {phase === "code" ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                data-testid="otp-change-phone"
                onClick={() => {
                  setPhase("phone");
                  setToken("");
                  setTokenError(null);
                }}
              >
                {COPY.phone.changePhone}
              </Button>
            ) : null}
          </div>
          <FieldError id="phone-error" message={phoneError} />
        </div>

        {phase === "code" ? (
          <div>
            <Label htmlFor="otp" required hint={COPY.phone.codeHint}>
              {COPY.phone.codeLabel}
            </Label>
            <Input
              ref={codeRef}
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={token}
              invalid={Boolean(tokenError)}
              aria-describedby={tokenError ? "otp-error" : undefined}
              data-testid="otp-input"
              className="tnum mt-1.5 text-center text-h2 tracking-[0.4em]"
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <FieldError id="otp-error" message={tokenError} />
            <div className="mt-2 flex items-center justify-between text-caption text-muted-foreground">
              <span role="status" aria-live="polite" className="tnum">
                {resendLeft > 0 ? COPY.phone.resendIn(resendLeft) : null}
              </span>
              <Button type="button" variant="link" size="sm" disabled={resendLeft > 0 || pending} data-testid="otp-resend" onClick={sendCode}>
                {COPY.phone.resend}
              </Button>
            </div>
          </div>
        ) : null}

        {isSignup && phase === "code" ? <ConsentChecklist value={consents} onChange={setConsents} error={consentError} /> : null}
      </form>
    </OnboardingFrame>
  );
}

/** persist 미들웨어 hydrate 여부 — sessionStorage 를 읽기 전에 /onboarding/age 로 튕기지 않도록 */
function hasHydrated(): boolean {
  return useOnboardingDraft.persist.hasHydrated();
}
