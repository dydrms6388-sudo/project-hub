"use client";

// E1 · 로그인 폼 — signIn Server Action 호출 후 code 로 UI 분기 (D2 §2).
// 접근성: label htmlFor 연결 · 에러 aria-live="assertive" · 실패 시 aria-describedby.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@duckmate/ui";
import { signIn } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn({ email: email.trim(), password });
      if (!res.ok) {
        const to = redirectForActionError(res.code, res.message);
        setError(messageForActionError(res.code, res.message));
        if (to && to !== "/login") router.replace(to);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  const invalid = error !== null;

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate data-testid="login-form">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-body-sm font-semibold">
          이메일
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          invalid={invalid}
          aria-describedby={invalid ? "login-error" : undefined}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="login-email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-body-sm font-semibold">
          비밀번호
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          invalid={invalid}
          aria-describedby={invalid ? "login-error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="login-password"
        />
      </div>

      <p
        id="login-error"
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <Button type="submit" size="lg" loading={pending} data-testid="login-submit">
        로그인
      </Button>
    </form>
  );
}
