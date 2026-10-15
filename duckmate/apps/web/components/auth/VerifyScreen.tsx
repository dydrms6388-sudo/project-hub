"use client";

/**
 * S7 본인인증 게이트 — /verify (12_flows §2 S7, 15_auth §0-10, 10_brand #12·#13). 진행 바 없음.
 *  [인증하기] → startIdentityVerification()
 *    - {kind:"token"}(mock): 개발 환경이면 simulate 모달(success/fail/minor/duplicate) → completeIdentityVerification({token, simulate})
 *                           프로덕션 mock 이면 곧바로 complete(allowlist 판정, 실패 시 "초대된 번호만" 안내)
 *    - {kind:"redirect"}(portone): window.location 이동
 *    - {kind:"already"}: redirectTo
 *  결과: OK → verify_succeeded → /home(E2) / MINOR → redirectTo /suspended / DUPLICATE_CI·BLOCKED_CI·NOT_ALLOWLISTED·IDENTITY_FAILED → 인라인 화면.
 *  푸시 권한 요청은 여기서 하지 않는다(20_notifications §0-4: 첫 /home 진입 소프트 배너).
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Circle, CircleCheck, ShieldCheck } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, SafetyBanner, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@duckmate/ui";
import { completeIdentityVerification, startIdentityVerification } from "@/lib/identity/actions";
import { track } from "@/lib/analytics/track";
import { useTrackView } from "@/lib/analytics/useTrack";
import type { ActionFailure } from "@/lib/auth/errors";
import { COPY } from "@/components/onboarding/copy";
import { useActionResult } from "@/components/onboarding/useActionResult";
import { LogoutButton } from "./LogoutButton";

export type SimulateKind = "success" | "fail" | "minor" | "duplicate";

export interface VerifyScreenProps {
  /** 개발·테스트 환경(NODE_ENV≠production) → simulate 셀렉트 노출 */
  devMode: boolean;
  verifier: "mock" | "portone";
  /** /api/identity/callback 이 되돌린 오류(portone NOT_CONFIGURED 등) */
  callbackError?: string | null;
}

type Outcome = { kind: "not_allowlisted" | "duplicate" | "blocked" | "failed" | "not_configured"; message: string };

export function VerifyScreen({ devMode, verifier, callbackError }: VerifyScreenProps) {
  const router = useRouter();
  const { handle, run, pending } = useActionResult();
  const [token, setToken] = React.useState<string | null>(null);
  const [simulate, setSimulate] = React.useState<SimulateKind>("success");
  const [outcome, setOutcome] = React.useState<Outcome | null>(() =>
    callbackError ? { kind: callbackError === "NOT_CONFIGURED" ? "not_configured" : "failed", message: callbackError === "NOT_CONFIGURED" ? COPY.verify.notConfigured : COPY.verify.failed } : null,
  );
  useTrackView("verify_gate_viewed", { provider: verifier });

  const onFailure = (f: ActionFailure): true => {
    track("verify_failed", { provider: verifier, code: f.code });
    switch (f.code) {
      case "NOT_ALLOWLISTED":
        setOutcome({ kind: "not_allowlisted", message: f.message });
        break;
      case "DUPLICATE_CI":
        setOutcome({ kind: "duplicate", message: f.message });
        break;
      case "BLOCKED_CI":
        setOutcome({ kind: "blocked", message: f.message });
        break;
      case "NOT_ENTITLED":
        setOutcome({ kind: "not_configured", message: f.message });
        break;
      default:
        setOutcome({ kind: "failed", message: f.message || COPY.verify.failed });
    }
    return true;
  };

  const complete = async (tok: string, sim: SimulateKind | null) => {
    const payload: Record<string, unknown> = { token: tok };
    if (sim && sim !== "success") payload["simulate"] = sim;
    const res = await run(() => completeIdentityVerification(payload));
    handle(res, {
      onSuccess: ({ redirectTo, verifyLevel }) => {
        track("verify_succeeded", { provider: verifier, level_after: verifyLevel });
        window.location.assign(redirectTo); // (app) layout 게이트 재평가 — 풀 내비게이션
      },
      onRedirect: (_to, failure) => {
        if (failure) track("verify_failed", { provider: verifier, code: failure.code });
        return false;
      },
      onFailure,
    });
  };

  const start = async () => {
    setOutcome(null);
    const res = await run(() => startIdentityVerification());
    handle(res, {
      onSuccess: (data) => {
        if (data.kind === "already") {
          router.replace(data.redirectTo);
          return;
        }
        if (data.kind === "redirect") {
          window.location.assign(data.redirectUrl);
          return;
        }
        if (devMode) setToken(data.token);
        else void complete(data.token, null);
      },
      onFailure,
    });
  };

  if (outcome && outcome.kind !== "failed" && outcome.kind !== "not_configured") {
    const meta =
      outcome.kind === "not_allowlisted" ? COPY.verify.notAllowlisted : outcome.kind === "duplicate" ? COPY.verify.duplicate : COPY.verify.blocked;
    return (
      <Frame testId={`verify-${outcome.kind}`}>
        <h1 className="text-h1 text-foreground">{meta.headline}</h1>
        <p className="mt-2 text-body text-muted-foreground">{meta.sub}</p>
        <div className="mt-8 flex flex-col gap-2">
          {outcome.kind === "duplicate" ? <LogoutButton label={meta.cta} /> : <Button variant="outline" onClick={() => setOutcome(null)} data-testid="verify-back">{meta.cta}</Button>}
          <Button asChild variant="ghost">
            <Link href="/me/edit">{COPY.verify.later}</Link>
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame testId="verify-screen">
      <h1 className="text-h1 text-foreground">{COPY.verify.headline}</h1>
      <p className="mt-2 text-body text-muted-foreground">{COPY.verify.sub}</p>

      <ol className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label="인증 단계">
        <Step icon={CircleCheck} done label={COPY.verify.steps.phone} />
        <Step icon={ShieldCheck} current label={COPY.verify.steps.identity} />
        <Step icon={Circle} label={COPY.verify.steps.photo} muted />
      </ol>

      {outcome ? (
        <SafetyBanner variant="warn" className="mt-4" data-testid="verify-error">
          {outcome.message}
        </SafetyBanner>
      ) : null}
      {!devMode && verifier === "mock" ? (
        <p className="mt-4 text-caption text-muted-foreground" data-testid="verify-prod-mock-note">
          {COPY.verify.prodMockNote}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-2">
        <Button size="lg" loading={pending} data-testid="verify-start" onClick={start}>
          {pending ? COPY.verify.processing : COPY.verify.start}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/me/edit" data-testid="verify-later">
            {COPY.verify.later}
          </Link>
        </Button>
      </div>

      {/* 개발용 simulate 모달 */}
      <Dialog open={token !== null} onOpenChange={(o) => !o && setToken(null)}>
        <DialogContent data-testid="verify-mock-dialog">
          <DialogHeader>
            <DialogTitle>{COPY.verify.mock.title}</DialogTitle>
            <DialogDescription>{COPY.verify.mock.body}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="simulate">결과</Label>
          <Select value={simulate} onValueChange={(v) => setSimulate(v as SimulateKind)}>
            <SelectTrigger id="simulate" data-testid="verify-simulate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COPY.verify.mock.simulate) as SimulateKind[]).map((k) => (
                <SelectItem key={k} value={k} data-testid={`verify-simulate-${k}`}>
                  {COPY.verify.mock.simulate[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              loading={pending}
              data-testid="verify-simulate-confirm"
              onClick={() => {
                if (token) void complete(token, simulate);
                setToken(null);
              }}
            >
              {COPY.verify.mock.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Frame>
  );
}

function Frame({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pt-12 pb-8" data-testid={testId}>
      {children}
    </div>
  );
}

function Step({ icon: Icon, label, done, current, muted }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>; label: string; done?: boolean; current?: boolean; muted?: boolean }) {
  return (
    <li className={cn("flex items-center gap-3 text-body", muted ? "text-muted-foreground" : "text-foreground", current && "font-semibold")} aria-current={current ? "step" : undefined}>
      <Icon size={22} strokeWidth={1.75} aria-hidden className={cn(done && "text-success", current && "text-primary", muted && "text-sand-500")} />
      <span>{label}</span>
      {done ? <span className="sr-only">(완료)</span> : null}
      {current ? <BadgeCheck size={16} strokeWidth={2} aria-hidden className="ml-auto text-primary opacity-0" /> : null}
    </li>
  );
}
