"use client";

// =============================================================================
// E1 · 휴대폰 인증 폼 (번호 입력 → 인증번호 6자리)
// - "인증번호 받기" = POST /api/auth/verify-identity {action:"request"} (D2 §4)
// - 확인 = confirmPhoneVerification Server Action → Lv1 승급 + 스텝 전진
// - 유효 3분 · 재전송 60초 쿨다운 · 5회 실패 시 10분 잠금 (현재는 클라이언트 표시
//   기준. 서버 강제는 SMS 어댑터 도입 시 함께 붙는다 — D2 미결 2)
// =============================================================================

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input } from "@duckmate/ui";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";
import { confirmPhoneVerification } from "./actions";

const OTP_TTL_SEC = 180;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;
const LOCK_SEC = 600;

function formatPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PhoneForm({ stubMode }: { stubMode: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phoneDigits, setPhoneDigits] = useState("");
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ttl, setTtl] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTtl((v) => (v > 0 ? v - 1 : 0));
      setCooldown((v) => (v > 0 ? v - 1 : 0));
      setLockLeft(lockUntil > 0 ? Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)) : 0);
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const locked = lockLeft > 0;
  const phoneValid = /^01[016789]\d{7,8}$/.test(phoneDigits);

  async function requestCode() {
    setError(null);
    setNotice(null);
    if (!phoneValid) {
      setError("휴대폰 번호를 다시 확인해 주세요. (예: 010-1234-5678)");
      return;
    }
    try {
      const res = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        token?: string;
        redirectUrl?: string;
        message?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.message ?? "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setToken(body.token);
      setSent(true);
      setTtl(OTP_TTL_SEC);
      setCooldown(RESEND_COOLDOWN_SEC);
      setCode("");
      setNotice(`${formatPhone(phoneDigits)} 로 인증번호를 보냈어요.`);
      window.setTimeout(() => document.getElementById("phone-code")?.focus(), 0);
    } catch {
      setError("연결이 불안정해요. 다시 시도해 주세요.");
    }
  }

  function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (locked) return;
    if (ttl === 0) {
      setError("인증번호 유효시간이 지났어요. 다시 받아 주세요.");
      return;
    }

    startTransition(async () => {
      const res = await confirmPhoneVerification({ phone: phoneDigits, code, token });
      if (!res.ok) {
        const to = redirectForActionError(res.code, res.message);
        if (to) {
          router.replace(to);
          return;
        }
        const left = attemptsLeft - 1;
        setAttemptsLeft(left);
        if (left <= 0) {
          setLockUntil(Date.now() + LOCK_SEC * 1000);
          setAttemptsLeft(MAX_ATTEMPTS);
          setError("여러 번 틀려서 10분 뒤에 다시 시도할 수 있어요.");
          return;
        }
        setError(`${messageForActionError(res.code, res.message)} (남은 시도 ${left}회)`);
        return;
      }
      router.replace("/onboarding/hobbies");
      router.refresh();
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-4" data-testid="phone-form">
      {stubMode ? (
        <Card className="bg-warning-tint" data-testid="phone-stub-notice">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Stub 모드</Badge>
          </div>
          <p className="mt-2 text-body-sm">
            지금은 문자 발송 연동 전이라 테스트 어댑터가 인증을 대신 처리해요. 인증번호는
            아무 숫자 6자리를 입력하면 통과돼요.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone-number" className="text-body-sm font-semibold">
          휴대폰 번호
        </label>
        <Input
          id="phone-number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-1234-5678"
          value={formatPhone(phoneDigits)}
          disabled={sent}
          invalid={error !== null && !sent}
          aria-describedby="phone-help"
          onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
          data-testid="phone-input"
        />
        <p id="phone-help" className="text-caption text-ink-muted">
          이미 가입된 번호라면 기존 계정으로 로그인해 주세요.
        </p>
      </div>

      {!sent ? (
        <Button size="lg" onClick={requestCode} disabled={!phoneValid} data-testid="phone-request">
          인증번호 받기
        </Button>
      ) : (
        <form onSubmit={onConfirm} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone-code" className="text-body-sm font-semibold">
              인증번호 6자리
            </label>
            <Input
              id="phone-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              disabled={locked}
              invalid={error !== null}
              aria-describedby="phone-code-help phone-error"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              data-testid="phone-code"
            />
            <p id="phone-code-help" className="text-caption text-ink-muted" aria-live="polite">
              {locked
                ? `다시 시도할 수 있을 때까지 ${mmss(lockLeft)} 남았어요.`
                : ttl > 0
                  ? `남은 시간 ${mmss(ttl)} · 남은 시도 ${attemptsLeft}회`
                  : "유효시간이 지났어요. 인증번호를 다시 받아 주세요."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={code.length !== 6 || locked}
              data-testid="phone-submit"
            >
              인증 완료
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={requestCode}
              disabled={cooldown > 0 || locked}
              data-testid="phone-resend"
            >
              {cooldown > 0 ? `재전송 (${cooldown}초 후)` : "재전송"}
            </Button>
          </div>
        </form>
      )}

      <p
        id="phone-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>
      <p role="status" aria-live="polite" className="text-body-sm text-ink-muted">
        {notice}
      </p>
    </div>
  );
}
