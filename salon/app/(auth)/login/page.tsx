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
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ paddingTop: 40 }}>
      <h1>로그인</h1>
      <p className="sub">등록된 이메일로 로그인 링크를 보내드려요.</p>
      {sent ? (
        <div className="notice">
          메일함을 확인해주세요. 로그인 링크를 보냈습니다.
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
            />
          </div>
          {error && <div className="notice">{error}</div>}
          <button className="btn btn-block" disabled={busy}>
            {busy ? "보내는 중…" : "로그인 링크 보내기"}
          </button>
        </form>
      )}
    </div>
  );
}
