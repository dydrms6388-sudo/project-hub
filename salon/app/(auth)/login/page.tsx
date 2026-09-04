"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // 등록된 계정만 로그인 — 링크로 새 계정이 생기지 않게 한다.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ paddingTop: 40 }}>
      <h1>로그인</h1>
      <p className="sub">등록된 이메일로 로그인 링크를 보내드려요.</p>
      {sent ? (
        <div className="notice">
          메일함을 확인해주세요. 로그인 링크를 보냈습니다.
          <br />
          메일이 오지 않으면 등록된 주소가 맞는지 확인해주세요.
        </div>
      ) : (
        <form className="plain" onSubmit={sendLink}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-block" disabled={busy} aria-busy={busy}>
            {busy ? "보내는 중…" : "로그인 링크 보내기"}
          </button>
        </form>
      )}
    </div>
  );
}
